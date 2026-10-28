CREATE TABLE IF NOT EXISTS admin_daily_report_preferences (
    shul_id TEXT NOT NULL REFERENCES shuls(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    PRIMARY KEY (shul_id, user_id)
) STRICT;
