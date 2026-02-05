-- Migration: 004_add_staff_email.sql
-- Adds email column to staff table for magic link authentication

-- Add email column to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL;

-- Add constraint: email required for new staff
-- (Not enforced on existing rows until migration complete)
