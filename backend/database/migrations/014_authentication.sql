CREATE TABLE user_credentials (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL
) STRICT;

CREATE TABLE user_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX user_sessions_user ON user_sessions(user_id);
CREATE INDEX user_sessions_expiry ON user_sessions(expires_at);

CREATE TABLE auth_attempts (
    bucket TEXT PRIMARY KEY NOT NULL,
    started_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL
) STRICT;
