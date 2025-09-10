document.getElementById('messageForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const senderName = document.getElementById('senderName').value.trim();
    const messageContent = document.getElementById('messageContent').value.trim();

    if (!senderName || !messageContent) {
        alert("Vui lòng nhập đầy đủ tên và tin nhắn!");
        return;
    }

    try {
        const response = await fetch("/send-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderName, messageContent })
        });

        const result = await response.json();  // 👈 parse JSON

        const successBox = document.getElementById('success');
        successBox.innerHTML = result.message; // 👈 chỉ lấy nội dung message
        successBox.style.display = 'block';

        this.reset();

        // 👇 Tự ẩn sau 7 giây
        setTimeout(() => {
            successBox.style.display = 'none';
        }, 7000);

    } catch (error) {
        console.error(error);
        alert("⚠️ Không thể kết nối đến server!");
    }


});
