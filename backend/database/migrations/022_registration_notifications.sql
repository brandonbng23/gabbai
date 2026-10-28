CREATE TABLE IF NOT EXISTS shul_notification_settings (
    shul_id TEXT PRIMARY KEY REFERENCES shuls(id),
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    instant_admin_user_id TEXT REFERENCES users(id)
) STRICT;
CREATE TABLE IF NOT EXISTS confirmation_email_quotas (
    shul_id TEXT NOT NULL REFERENCES shuls(id),
    identity_type TEXT NOT NULL CHECK (identity_type IN ('member', 'guest')),
    identity TEXT NOT NULL,
    local_day TEXT NOT NULL,
    requested INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (shul_id, identity_type, identity, local_day)
) STRICT;
CREATE TABLE IF NOT EXISTS notification_email_outbox (
    id TEXT PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    shul_id TEXT NOT NULL REFERENCES shuls(id),
    recipient_user_id TEXT NOT NULL REFERENCES users(id),
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('confirmation', 'instant', 'roundup')),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'accepted', 'failed', 'unknown', 'capped', 'skipped')),
    created_at TEXT NOT NULL,
    claimed_at TEXT,
    quota_day TEXT,
    provider_id TEXT,
    error_code TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS notification_email_pending ON notification_email_outbox(status, created_at);
CREATE TABLE IF NOT EXISTS notification_email_daily_usage (
    utc_day TEXT PRIMARY KEY,
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved BETWEEN 0 AND 100)
) STRICT;
CREATE TABLE IF NOT EXISTS notification_roundups (
    shul_id TEXT NOT NULL REFERENCES shuls(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    local_day TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (shul_id, user_id, local_day)
) STRICT;
