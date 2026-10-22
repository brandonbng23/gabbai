CREATE TABLE reading_occasions (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    occasions_json TEXT NOT NULL CHECK (json_valid(occasions_json)),
    PRIMARY KEY (shul_id, reading_date, reading_name)
) STRICT;
