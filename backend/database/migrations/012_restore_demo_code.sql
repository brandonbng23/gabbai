-- Demo users can edit their email. Identify the original sample shul from its
-- immutable creation snapshot instead of relying only on the current profile.
UPDATE shul_codes SET code = 'DEMO'
WHERE shul_id = (
    SELECT shul_id FROM shul_initial_versions
    WHERE json_extract(info_json, '$.name') = 'Demo Shul'
      AND json_extract(info_json, '$.websiteUrl') = 'https://demoshul.org'
      AND json_extract(info_json, '$.email') = 'shalom@demoshul.org'
    ORDER BY captured_at, shul_id
    LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM shul_codes WHERE code = 'DEMO');
