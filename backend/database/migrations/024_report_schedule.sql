ALTER TABLE shul_notification_settings ADD COLUMN report_time TEXT NOT NULL DEFAULT '16:00';
ALTER TABLE shul_notification_settings ADD COLUMN report_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (report_frequency IN ('daily', 'mon_thu', 'mon_wed_fri'));
ALTER TABLE shul_notification_settings ADD COLUMN report_range TEXT NOT NULL DEFAULT '3months' CHECK (report_range IN ('2weeks', '1month', '2months', '3months'));
