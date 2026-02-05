-- Migration 002: Add MAINTENANCE service type, excluded_from_metrics, and fix RLS policies

-- 1. Add MAINTENANCE to service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'MAINTENANCE';

-- 2. Add excluded_from_metrics column to tickets (for admin to exclude test data from KPIs)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS excluded_from_metrics BOOLEAN DEFAULT false;

-- 3. Fix RLS policies
-- The original policies use current_setting('app.current_user_id', true) which is never set
-- from the JS client. For this internal-only app (no public access), we replace with
-- permissive policies. The app handles role checks in the frontend.

-- Drop restrictive policies on staff
DROP POLICY IF EXISTS "Active staff visible to all" ON staff;
DROP POLICY IF EXISTS "Managers can manage staff" ON staff;

-- Allow all operations on staff (internal app, no public access)
CREATE POLICY "Allow all staff operations"
  ON staff FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop restrictive policies on technicians
DROP POLICY IF EXISTS "Active technicians visible to all" ON technicians;
DROP POLICY IF EXISTS "Managers can manage technicians" ON technicians;

-- Allow all operations on technicians
CREATE POLICY "Allow all technician operations"
  ON technicians FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop restrictive policies on tickets
DROP POLICY IF EXISTS "Everyone can view pending tickets" ON tickets;
DROP POLICY IF EXISTS "Everyone can view completed tickets" ON tickets;
DROP POLICY IF EXISTS "Service writers can create tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians can complete tickets" ON tickets;

-- Allow all operations on tickets
CREATE POLICY "Allow all ticket operations"
  ON tickets FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Create index for excluded_from_metrics
CREATE INDEX IF NOT EXISTS idx_tickets_excluded ON tickets(excluded_from_metrics);

-- 5. Create the get_avg_completion_time function if it doesn't exist
CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS TABLE(avg_minutes NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60),
    0
  )::NUMERIC AS avg_minutes
  FROM tickets
  WHERE status = 'COMPLETED'
    AND completed_at IS NOT NULL
    AND (excluded_from_metrics IS NULL OR excluded_from_metrics = false);
END;
$$ LANGUAGE plpgsql;
