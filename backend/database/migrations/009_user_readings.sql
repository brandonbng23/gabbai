CREATE INDEX reading_readers_user_assignments
    ON reading_readers(user_id, shul_id, reading_date, reading_name, aliyah);
