-- Migration: Add MAINTENANCE service type
-- Run this in Supabase SQL Editor if you already have the database set up

ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'MAINTENANCE';

-- Also add the avg completion time function if it doesn't exist
CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS TABLE(avg_minutes NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60), 1)
  FROM tickets
  WHERE status = 'COMPLETED'
    AND completed_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
