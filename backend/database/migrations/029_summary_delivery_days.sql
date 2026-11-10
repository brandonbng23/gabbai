ALTER TABLE shul_notification_settings ADD COLUMN report_days INTEGER NOT NULL DEFAULT 127
    CHECK (report_days BETWEEN 1 AND 127);

UPDATE shul_notification_settings SET report_days = CASE report_frequency
    WHEN 'mon_thu' THEN 18
    WHEN 'mon_wed_fri' THEN 42
    ELSE 127
END;
