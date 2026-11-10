CREATE TABLE IF NOT EXISTS reading_aliyah_notes (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah INTEGER NOT NULL CHECK (aliyah BETWEEN 1 AND 9),
    note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 60),
    PRIMARY KEY (shul_id, reading_date, reading_name, aliyah)
) STRICT;
