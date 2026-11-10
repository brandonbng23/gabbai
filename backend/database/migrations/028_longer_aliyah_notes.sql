CREATE TABLE reading_aliyah_notes_new (
    shul_id TEXT NOT NULL REFERENCES shuls(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    reading_name TEXT NOT NULL,
    aliyah INTEGER NOT NULL CHECK (aliyah BETWEEN 1 AND 9),
    note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 120),
    PRIMARY KEY (shul_id, reading_date, reading_name, aliyah)
) STRICT;

INSERT INTO reading_aliyah_notes_new SELECT * FROM reading_aliyah_notes;
DROP TABLE reading_aliyah_notes;
ALTER TABLE reading_aliyah_notes_new RENAME TO reading_aliyah_notes;
