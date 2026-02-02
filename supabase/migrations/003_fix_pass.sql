-- ============================================================
-- Migration 003: Fix Pass
-- Applies to databases already running 001 + 002 migrations.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- --------------------------------------------------------
-- 1A) MAINTENANCE service type (idempotent – 002 may have added it)
-- --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'MAINTENANCE'
      AND enumtypid = 'service_type'::regtype
  ) THEN
    ALTER TYPE service_type ADD VALUE 'MAINTENANCE';
  END IF;
END $$;

-- --------------------------------------------------------
-- 1C) Customer info columns on tickets
--     Required for ALL service types (name + phone).
-- --------------------------------------------------------
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- --------------------------------------------------------
-- 4A) Exclude test tickets from KPIs
--     Soft flag; default false so existing rows are unaffected.
-- --------------------------------------------------------
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS excluded_from_metrics BOOLEAN DEFAULT false;

-- Index for fast KPI filtering
CREATE INDEX IF NOT EXISTS idx_tickets_excluded
  ON tickets (excluded_from_metrics)
  WHERE excluded_from_metrics = true;

-- --------------------------------------------------------
-- 1B) Appointment rework
--     Appointments now store the underlying service_type they
--     are scheduling inside service_data->>'appointment_service'.
--     The scheduled_time column is already on the table.
--     We relax the valid_appointment constraint so that
--     scheduled_time can be set on any service_type row
--     (appointments always need it, others may optionally have it).
-- --------------------------------------------------------
-- Drop old constraint safely
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS valid_appointment;

-- Re-add a looser version: appointments MUST have scheduled_time,
-- but other types MAY have it (no-op for non-appointments).
ALTER TABLE tickets ADD CONSTRAINT valid_appointment CHECK (
  service_type != 'APPOINTMENT' OR scheduled_time IS NOT NULL
);

-- --------------------------------------------------------
-- 2B) Login must check active flag.
--     The RLS policy "Active staff visible to all" already
--     filters on active = true for SELECT, but the app does
--     its own query. We add a helper function the app can
--     call instead of raw table queries so the check is
--     guaranteed server-side.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION authenticate_staff(p_id_code TEXT)
RETURNS TABLE(
  id UUID,
  id_code TEXT,
  name TEXT,
  role staff_role,
  active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.id_code, s.name, s.role, s.active
  FROM staff s
  WHERE s.id_code = UPPER(p_id_code)
    AND s.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- 2A / 3) Technician management helpers
-- --------------------------------------------------------

-- Resolve technician ID from a staff id_code (used when
-- auto-setting completed_by from logged-in tech).
CREATE OR REPLACE FUNCTION get_technician_id_by_code(p_id_code TEXT)
RETURNS UUID AS $$
  SELECT t.id
  FROM technicians t
  JOIN staff s ON s.id = t.staff_id
  WHERE s.id_code = UPPER(p_id_code)
    AND t.active = true
    AND s.active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- --------------------------------------------------------
-- Active queue view (replaces previous version)
--   Now includes customer_name, customer_phone,
--   and excluded_from_metrics filter.
-- --------------------------------------------------------
DROP VIEW IF EXISTS active_queue;
CREATE VIEW active_queue AS
SELECT
  id,
  ticket_number,
  service_type,
  priority,
  vehicle,
  service_data,
  notes,
  customer_name,
  customer_phone,
  scheduled_time,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_waiting
FROM tickets
WHERE status = 'PENDING'
  AND excluded_from_metrics = false
  AND (
    service_type != 'APPOINTMENT'
    OR (service_type = 'APPOINTMENT' AND scheduled_time <= NOW())
  )
ORDER BY
  CASE priority
    WHEN 'HIGH' THEN 1
    WHEN 'NORMAL' THEN 2
    WHEN 'LOW' THEN 3
  END,
  created_at ASC;

-- Ensure grants
GRANT SELECT ON active_queue TO authenticated;
GRANT SELECT ON active_queue TO anon;

-- --------------------------------------------------------
-- Updated KPI function: respects excluded_from_metrics
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS TABLE(avg_minutes NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60), 1)
  FROM tickets
  WHERE status = 'COMPLETED'
    AND excluded_from_metrics = false
    AND completed_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- RLS: allow UPDATE on tickets for managers (needed for
-- excluding tickets from metrics, and general admin ops).
-- --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tickets' AND policyname = 'Managers can update tickets'
  ) THEN
    CREATE POLICY "Managers can update tickets"
      ON tickets FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM staff
          WHERE staff.id_code = current_setting('app.current_user_id', true)
          AND staff.role = 'MANAGER'
        )
      );
  END IF;
END $$;

-- RLS: allow managers to DELETE tickets (for hard-removing test data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tickets' AND policyname = 'Managers can delete tickets'
  ) THEN
    CREATE POLICY "Managers can delete tickets"
      ON tickets FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM staff
          WHERE staff.id_code = current_setting('app.current_user_id', true)
          AND staff.role = 'MANAGER'
        )
      );
  END IF;
END $$;

-- RLS: allow ALL on staff for login queries (the app reads
-- staff rows for any id_code; we need inactive ones visible
-- so the app can return "account deactivated" vs "not found").
-- We add a SELECT-only policy that allows reading ALL staff.
DROP POLICY IF EXISTS "All staff visible for auth" ON staff;
CREATE POLICY "All staff visible for auth"
  ON staff FOR SELECT
  USING (true);

-- --------------------------------------------------------
-- Done. Existing data is untouched; new columns have safe defaults.
-- --------------------------------------------------------
