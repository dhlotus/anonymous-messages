const http = require("http");
const { Server } = require("socket.io");

const express = require("express");
const session = require("express-session");
const { chmod } = require("fs");
const sql = require("mssql");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ================== SQL CONFIG ==================
const config = {
    user: "lotus",
    password: "17112",
    server: "localhost",
    database: "anonymous_messages",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

sql.connect(config)
    .then(() => console.log("✅ Kết nối SQL thành công!"))
    .catch(err => console.error("❌ Lỗi SQL:", err));

// ================== SESSION ==================
app.use(session({
    secret: "lotus-secret-key", // khóa bí mật
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // localhost không cần https
}));

// ================== MIDDLEWARE LOGIN ==================
function requireLogin(req, res, next) {
    if (req.session && req.session.loggedIn) {
        return next();
    }
    return res.redirect("/login.html");
}

// ================== ROUTES ==================
// Trang test server
app.get("/", (req, res) => {
    res.send("✅ Server LOTUS đang chạy!");
});

// Lưu thời điểm gửi gần nhất
const lastSent = {};

app.post("/send-message", async (req, res) => {
    const { senderName, messageContent } = req.body;

    // 🔒 Chống spam theo IP hoặc tên
    const ip = req.ip;
    const key = ip;
    const now = Date.now();

    if (lastSent[key] && now - lastSent[key] < 35000) {
        const wait = Math.ceil((35000 - (now - lastSent[key])) / 1000);
        return res.status(429).send(`⏳ Đừng spam, chờ ${wait}s nữa nha!`);
    }

    // 🚨 Danh sách từ khóa xấu
    const bannedWords = [
        "lồn", "cặc", "ngu", "đb", "dm", "đm", "clm", "cc",
        "địt", "đĩ", "buồi", "bựa", "mẹ", "chó", "đéo",
        "vcl", "vl", "đần", "cmm", "cml", "dcm", "vcl", "vkl",
        "đm", "đm", "đm", "đm", "đm", "đm", "đm", "đm"
    ];

    // ✅ Hàm tạo regex nâng cao (bắt hoa/thường, ký tự chen giữa)
    const escapeRegExp = s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const buildFlexibleRegexes = (words) => {
        const sep = "[^\\p{L}\\p{N}]*"; // cho phép ký tự chen giữa
        return words.map(w => new RegExp(
            w.split("").map(ch => escapeRegExp(ch)).join(sep),
            "iu" // i = ignore case, u = unicode
        ));
    };
    const bannedRegexes = buildFlexibleRegexes(bannedWords);

    const isBadMessage = (msg) => {
        const m = msg || "";
        return bannedRegexes.some(re => re.test(m));
    };

    // ✅ Kiểm tra tin nhắn xấu
    if (isBadMessage(messageContent)) {
        return res.status(400).send("❌ Ối đừng nhập từ bậy bạ mò!");
    }

    try {
        // 💾 Lưu DB
        let pool = await sql.connect(config);
        await pool.request()
            .input("sender_name", sql.NVarChar(100), senderName || "Ẩn danh")
            .input("messages_content", sql.NVarChar(sql.MAX), messageContent)
            .query("INSERT INTO messages(sender_name, messages_content) VALUES (@sender_name, @messages_content)");

        // ⏰ Cập nhật thời điểm gửi cuối
        lastSent[key] = now;
        io.emit("newMessage", {
            sender_name: senderName || "Ẩn danh",
            messages_content: messageContent,
            created_at: new Date()
        });
        res.send(`💌 Cảm ơn ${senderName || "Ẩn danh"}, mình đã nhận được tin nhắn của bạn!`);
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Có lỗi xảy ra!");
    }
});



// Trang login (GET form tĩnh từ public/login.html)
app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/public/message.html");
});

// Xử lý login (POST)
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // 👉 Đổi username & password theo ý bạn
    if (username === "lotus" && password === "17112") {
        req.session.loggedIn = true;
        return res.redirect("/admin");
    }
    res.send("❌ Sai tài khoản hoặc mật khẩu!");
});

// Trang admin (yêu cầu login)
const path = require("path");

// Trang admin -> chỉ trả về giao diện messages.html
app.get("/admin", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/messages.html");
});
// API lấy danh sách tin nhắn (chỉ khi đã đăng nhập)
app.get("/api/messages", requireLogin, async (req, res) => {
    try {
        let pool = await sql.connect(config);
        const result = await pool.request()
            .query("SELECT id, sender_name, messages_content, created_at FROM messages ORDER BY id DESC");

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Không thể tải tin nhắn!");
    }
});

// API xóa tin nhắn
app.delete("/api/messages/:id", async (req, res) => {
    const { id } = req.params;
    try {
        let pool = await sql.connect(config);
        await pool.request()
            .input("id", sql.Int, id)
            .query("DELETE FROM messages WHERE id = @id");
        res.send("✅ Đã xóa tin nhắn!");
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Lỗi khi xóa tin nhắn!");
    }
});


// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Lỗi khi hủy session:", err);
            return res.status(500).send("Không thể đăng xuất");
        }
        res.redirect("/login.html"); // về trang login
    });
});


// ================== SERVER START ==================
const server = http.createServer(app);  // tạo server HTTP từ express
const io = new Server(server);          // gắn socket.io vào server

io.on("connection", (socket) => {
    console.log("🔌 Client đã kết nối:", socket.id);
});

server.listen(3000, () => {
    console.log("🚀 Server chạy tại http://localhost:3000");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
