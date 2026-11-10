CREATE TABLE IF NOT EXISTS shul_events (
    id TEXT PRIMARY KEY NOT NULL,
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    registration_link TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE INDEX IF NOT EXISTS shul_events_schedule ON shul_events(shul_id, date, time);
