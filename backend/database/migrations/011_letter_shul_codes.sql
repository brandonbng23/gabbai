ALTER TABLE shul_codes RENAME TO shul_numeric_codes;

CREATE TABLE shul_codes (
    shul_id TEXT PRIMARY KEY NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE CHECK (code GLOB '[A-Z][A-Z][A-Z][A-Z]')
) STRICT;

INSERT INTO shul_codes (shul_id, code)
SELECT shul_id, code FROM shul_numeric_codes WHERE code GLOB '[A-Z][A-Z][A-Z][A-Z]';

DROP TABLE shul_numeric_codes;
