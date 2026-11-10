CREATE TABLE IF NOT EXISTS shul_link_clicks (
    shul_id TEXT PRIMARY KEY NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    event_registration_clicks INTEGER NOT NULL DEFAULT 0 CHECK (event_registration_clicks >= 0),
    donation_clicks INTEGER NOT NULL DEFAULT 0 CHECK (donation_clicks >= 0)
) STRICT;
