-- Trash belongs to each recipient, leaving other recipients' copies intact.
ALTER TABLE message_recipients ADD COLUMN deleted_at TEXT;
