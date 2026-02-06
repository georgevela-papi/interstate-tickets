-- Migration: 011_simplify_auth.sql
-- Simplifies multi-tenant auth by removing profiles table
-- Uses staff table directly for authentication via JWT email
--
-- SECURITY: Maintains full tenant isolation via RLS
-- - get_my_tenant_id() returns NULL for inactive/missing staff
-- - All RLS policies continue to work unchanged

-- ============================================
-- STEP 1: New get_my_tenant_id() function
-- ============================================
-- Queries staff by email from JWT instead of profiles table
-- Returns NULL if staff not found OR staff.active = false

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id
  FROM staff
  WHERE email = LOWER(auth.jwt()->>'email')
    AND active = true
$$;

-- ============================================
-- STEP 2: Helper function for frontend
-- ============================================
-- Returns current user's staff info for UI/authorization
-- Used by login page and tenant context

CREATE OR REPLACE FUNCTION get_my_staff()
RETURNS TABLE(id UUID, tenant_id UUID, role TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.tenant_id, s.role::TEXT, s.name
  FROM staff s
  WHERE s.email = LOWER(auth.jwt()->>'email')
    AND s.active = true
$$;

-- Restrict access to authenticated users only
REVOKE ALL ON FUNCTION get_my_staff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_staff TO authenticated;

-- ============================================
-- STEP 3: Remove old triggers and functions
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_staff_deactivated ON staff;
DROP FUNCTION IF EXISTS handle_new_auth_user();
DROP FUNCTION IF EXISTS handle_staff_deactivation();

-- ============================================
-- STEP 4: Drop profiles table
-- ============================================
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- 1. Verify function exists:
--    SELECT get_my_tenant_id();
--
-- 2. Verify staff lookup works (when authenticated):
--    SELECT * FROM get_my_staff();
--
-- 3. Verify RLS still works:
--    SELECT COUNT(*) FROM tickets;  -- Should only see own tenant's data
