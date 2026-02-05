-- Migration: 008_tenant_functions.sql
-- Creates helper functions for tenant isolation

-- Secure function to get current user's tenant_id
-- Used by ALL RLS policies
-- HARDENED: SET search_path prevents schema injection attacks
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- SECURITY DEFINER is required because:
-- 1. profiles table has RLS enabled
-- 2. RLS policies call this function
-- 3. Without SECURITY DEFINER, there would be infinite recursion
-- 4. Function is safe because it only returns the caller's own tenant_id via auth.uid()
-- 5. SET search_path = public, pg_temp prevents schema injection

-- Pre-auth allowlist check (CRITICAL: needed for login flow before auth)
-- Returns BOOLEAN ONLY - does not expose any staff data
-- HARDENED: SET search_path prevents schema injection attacks
CREATE OR REPLACE FUNCTION check_staff_allowlist(
  p_email TEXT,
  p_tenant_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.email = LOWER(p_email)
      AND s.active = true
      AND t.slug = p_tenant_slug
      AND t.active = true
  );
$$;

-- Restrict execution to authenticated or anon
REVOKE ALL ON FUNCTION check_staff_allowlist FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_staff_allowlist TO anon;
GRANT EXECUTE ON FUNCTION check_staff_allowlist TO authenticated;
