CREATE TABLE reading_aliyah_counts (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah_count INTEGER NOT NULL CHECK (aliyah_count BETWEEN 1 AND 7),
    PRIMARY KEY (shul_id, reading_date, reading_name)
) STRICT;
