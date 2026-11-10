ALTER TABLE shuls ADD COLUMN torah_service_day TEXT NOT NULL DEFAULT 'Saturday'
    CHECK (torah_service_day IN ('Friday', 'Saturday'));
ALTER TABLE shuls ADD COLUMN torah_service_time TEXT NOT NULL DEFAULT ''
    CHECK (torah_service_time = '' OR (length(torah_service_time) = 5
        AND torah_service_time GLOB '[0-2][0-9]:[0-5][0-9]' AND torah_service_time < '24:00'));
