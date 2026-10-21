CREATE TABLE reading_locks (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah INTEGER NOT NULL CHECK (aliyah BETWEEN 0 AND 9),
    locked INTEGER NOT NULL CHECK (locked IN (0, 1)),
    PRIMARY KEY (shul_id, reading_date, reading_name, aliyah)
) STRICT;
