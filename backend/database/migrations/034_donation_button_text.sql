ALTER TABLE shuls ADD COLUMN donation_button_text TEXT NOT NULL DEFAULT 'Make a donation'
    CHECK (length(trim(donation_button_text)) BETWEEN 1 AND 60);
