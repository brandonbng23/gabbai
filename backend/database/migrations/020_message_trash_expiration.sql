-- Keep minimal expiration records so replies cannot resurrect deleted copies.
CREATE TABLE IF NOT EXISTS message_delivery_expirations (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'shul')),
    owner_id TEXT NOT NULL,
    purged_at TEXT NOT NULL,
    PRIMARY KEY (message_id, owner_type, owner_id)
) STRICT;
CREATE INDEX IF NOT EXISTS message_recipient_trash_age ON message_recipients(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS shul_message_trash_age ON shul_message_receipts(deleted_at) WHERE deleted_at IS NOT NULL;
