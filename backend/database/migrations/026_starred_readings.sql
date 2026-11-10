CREATE TABLE IF NOT EXISTS starred_readings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah INTEGER NOT NULL CHECK (aliyah BETWEEN 1 AND 9),
    PRIMARY KEY (user_id, shul_id, reading_date, reading_name, aliyah)
) STRICT;
