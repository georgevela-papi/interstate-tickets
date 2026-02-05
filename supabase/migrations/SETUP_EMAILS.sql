-- ============================================
-- STEP 1: Add emails to existing staff
-- ============================================
-- Replace the placeholder emails with actual staff emails
-- These emails will be used for magic link authentication

UPDATE staff SET email = 'frontdesk@example.com' WHERE id_code = 'SW01';
UPDATE staff SET email = 'mike@example.com' WHERE id_code = 'T01';
UPDATE staff SET email = 'jose@example.com' WHERE id_code = 'T02';
UPDATE staff SET email = 'sarah@example.com' WHERE id_code = 'T03';
UPDATE staff SET email = 'manager@example.com' WHERE id_code = 'ADMIN';

-- Verify emails were set
SELECT id_code, name, role, email FROM staff ORDER BY role, name;
