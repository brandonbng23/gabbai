ALTER TABLE reading_readers ADD COLUMN registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX reading_readers_registered_by ON reading_readers(registered_by_user_id);
