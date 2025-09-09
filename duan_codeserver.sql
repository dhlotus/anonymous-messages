--tạo cơ sở dữ liệu
/*
CREATE DATABASE anonymous_messages;
GO

CREATE TABLE messages (cd
	id INT IDENTITY(1,1) PRIMARY KEY,
	content NVARCHAR(MAX) NOT NULL,
	created_at DATETIME DEFAULT GETDATE()
);
GO

EXEC sp_rename 'messages.content', 'messages_content', 'COLUMN';

SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'messages';

*/
USE anonymous_messages;
GO

SELECT * FROM messages;



