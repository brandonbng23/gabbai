CREATE TABLE reading_readers (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah INTEGER NOT NULL CHECK (aliyah BETWEEN 1 AND 9),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (shul_id, reading_date, reading_name, aliyah)
) STRICT;
