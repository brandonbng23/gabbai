CREATE TABLE shul_codes (
    shul_id TEXT PRIMARY KEY NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE CHECK (code = 'DEMO' OR code GLOB '[0-9][0-9][0-9][0-9]')
) STRICT;

INSERT INTO shul_codes (shul_id, code)
SELECT shul_id, 'DEMO' FROM users WHERE email = 'demo@example.com' COLLATE NOCASE;
