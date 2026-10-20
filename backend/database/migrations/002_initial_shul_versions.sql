CREATE TABLE shul_initial_versions (
    shul_id TEXT PRIMARY KEY NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    info_json TEXT NOT NULL CHECK (json_valid(info_json) AND json_type(info_json) = 'object'),
    settings_json TEXT NOT NULL CHECK (json_valid(settings_json) AND json_type(settings_json) = 'object'),
    source TEXT NOT NULL CHECK (source IN ('creation', 'migration')),
    captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Earlier versions did not retain history. Preserve the earliest available values.
INSERT INTO shul_initial_versions (shul_id, info_json, settings_json, source)
SELECT s.id, json_object(
    'name', s.name, 'websiteUrl', s.website_url, 'donationUrl', s.donation_url,
    'email', s.email, 'phone', s.phone, 'address', s.address
), p.settings_json, 'migration'
FROM shuls s JOIN shul_settings p ON p.shul_id = s.id;
