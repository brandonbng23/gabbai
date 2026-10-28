CREATE TABLE shul_notification_settings_new (
    shul_id TEXT PRIMARY KEY REFERENCES shuls(id),
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    instant_admin_user_id TEXT REFERENCES users(id),
    report_time TEXT NOT NULL DEFAULT '16:00',
    report_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (report_frequency IN ('daily', 'mon_thu', 'mon_wed_fri')),
    report_range TEXT NOT NULL DEFAULT '12weeks' CHECK (report_range IN ('2weeks', '4weeks', '6weeks', '8weeks', '10weeks', '12weeks'))
) STRICT;
INSERT INTO shul_notification_settings_new
SELECT shul_id, timezone, instant_admin_user_id, report_time, report_frequency,
    CASE report_range WHEN '1month' THEN '4weeks' WHEN '2months' THEN '8weeks' WHEN '3months' THEN '12weeks' ELSE report_range END
FROM shul_notification_settings;
DROP TABLE shul_notification_settings;
ALTER TABLE shul_notification_settings_new RENAME TO shul_notification_settings;
