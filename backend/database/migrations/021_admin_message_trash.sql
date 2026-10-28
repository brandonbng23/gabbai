CREATE TABLE IF NOT EXISTS shul_message_admin_states (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    deleted_at TEXT,
    purged_at TEXT,
    PRIMARY KEY (message_id, user_id)
) STRICT;
CREATE INDEX IF NOT EXISTS shul_admin_trash_age ON shul_message_admin_states(deleted_at) WHERE purged_at IS NULL AND deleted_at IS NOT NULL;

-- Preserve existing trash visibility for current admins when upgrading.
INSERT OR IGNORE INTO shul_message_admin_states (message_id, user_id, deleted_at)
SELECT r.message_id, u.id, r.deleted_at FROM shul_message_receipts r
JOIN messages m ON m.id = r.message_id JOIN users u ON u.shul_id = m.shul_id
WHERE u.role = 'admin' AND r.deleted_at IS NOT NULL;
INSERT INTO shul_message_admin_states (message_id, user_id, deleted_at, purged_at)
SELECT e.message_id, u.id, NULL, e.purged_at FROM message_delivery_expirations e
JOIN messages m ON m.id = e.message_id JOIN users u ON u.shul_id = m.shul_id
WHERE e.owner_type = 'shul' AND u.role = 'admin'
ON CONFLICT(message_id, user_id) DO UPDATE SET purged_at = excluded.purged_at;
INSERT OR IGNORE INTO shul_message_receipts (message_id)
SELECT message_id FROM message_delivery_expirations WHERE owner_type = 'shul';
UPDATE shul_message_receipts SET deleted_at = NULL;
DELETE FROM message_delivery_expirations WHERE owner_type = 'shul';
