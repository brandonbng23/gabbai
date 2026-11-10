ALTER TABLE shuls ADD COLUMN donation_headline TEXT NOT NULL DEFAULT 'Support our community'
    CHECK (length(trim(donation_headline)) BETWEEN 1 AND 100);
ALTER TABLE shuls ADD COLUMN donation_message TEXT NOT NULL DEFAULT 'Share this honor with your shul''s future. Your generosity ensures the next generation of Torah readers at your shul.'
    CHECK (length(trim(donation_message)) BETWEEN 1 AND 500);
ALTER TABLE shuls ADD COLUMN donation_highlight_enabled INTEGER NOT NULL DEFAULT 1 CHECK (donation_highlight_enabled IN (0, 1));
ALTER TABLE shuls ADD COLUMN donation_banner_enabled INTEGER NOT NULL DEFAULT 1 CHECK (donation_banner_enabled IN (0, 1));
