-- Migration: 004_add_staff_email.sql
-- Adds email column to staff table for magic link authentication

-- Add email column to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL;

-- Add constraint: email required for new staff
-- (Not enforced on existing rows until migration complete)
-- Migration: 005_tenants.sql
-- Creates tenants table with branding config and public view

-- Base table - contains sensitive config (features, settings, domain)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0EA5E9',
  secondary_color TEXT DEFAULT '#0284C7',
  features JSONB DEFAULT '{}'::jsonb,  -- SENSITIVE: not exposed publicly
  settings JSONB DEFAULT '{}'::jsonb,  -- SENSITIVE: not exposed publicly
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE active = true;
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Lock down base table - NO public access
-- Only authenticated users with matching tenant can read full row
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

-- Authenticated users can only see their own tenant (full data)
-- NOTE: get_my_tenant_id() is created in migration 008
-- This policy will work once that function exists
CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT TO authenticated
  USING (id = get_my_tenant_id());

-- No INSERT/UPDATE/DELETE from app - admin only via service role

-- PUBLIC VIEW: Exposes only branding fields needed for login page
-- This is what unauthenticated users (anon) can query
CREATE VIEW tenants_public AS
SELECT
  id,
  slug,
  name,
  logo_url,
  primary_color,
  secondary_color,
  active
FROM tenants
WHERE active = true;

-- Grant SELECT on view to anon and authenticated
GRANT SELECT ON tenants_public TO anon;
GRANT SELECT ON tenants_public TO authenticated;

COMMENT ON VIEW tenants_public IS 'Public-safe tenant branding info for login page. Does not expose features, settings, or domain.';
-- Migration: 006_profiles.sql
-- Creates profiles table linking auth.users to tenants via staff

-- Links auth.users to tenants via staff
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SERVICE_WRITER', 'TECHNICIAN', 'MANAGER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_profiles_staff ON profiles(staff_id);
CREATE UNIQUE INDEX idx_profiles_staff_unique ON profiles(staff_id);

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Users can only see their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- No INSERT/UPDATE/DELETE from app - managed by triggers
-- Migration: 007_add_tenant_id.sql
-- CRITICAL: Must create default tenant and backfill data BEFORE RLS policies

-- 1. Create the default Interstate tenant
INSERT INTO tenants (slug, name, logo_url, primary_color, secondary_color)
VALUES (
  'interstate',
  'Interstate Tires',
  'https://interstatetire.online/logo.png',
  '#0EA5E9',
  '#0284C7'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Add tenant_id columns (nullable initially)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 3. Backfill ALL existing data with Interstate tenant_id
UPDATE staff SET tenant_id = (SELECT id FROM tenants WHERE slug = 'interstate') WHERE tenant_id IS NULL;
UPDATE technicians SET tenant_id = (SELECT id FROM tenants WHERE slug = 'interstate') WHERE tenant_id IS NULL;
UPDATE tickets SET tenant_id = (SELECT id FROM tenants WHERE slug = 'interstate') WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = (SELECT id FROM tenants WHERE slug = 'interstate') WHERE tenant_id IS NULL;

-- 4. NOW make tenant_id NOT NULL (data already backfilled)
ALTER TABLE staff ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE technicians ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technicians_tenant ON technicians(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
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
-- Migration: 009_profile_trigger.sql
-- Creates profile auto-creation and staff deactivation triggers

-- DESIGN DECISION: Trigger runs ONLY on first user creation (INSERT), not every login.
--
-- Tradeoff Analysis:
-- - Option A (INSERT only): Profile created once, never silently modified. Role changes
--   require explicit admin action. SAFER - no silent profile mutations on re-auth.
-- - Option B (INSERT + UPDATE): Role stays in sync with staff table, but creates attack
--   surface where profile could be silently changed if staff record is modified.
--
-- CHOSEN: Option A (INSERT only) - Explicit is better than implicit. Role updates
-- should be an admin operation, not a side effect of login.

-- Profile creation function - runs ONLY on first auth
-- HARDENED: SET search_path prevents schema injection attacks
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  staff_record RECORD;
BEGIN
  -- Look up staff by email (allowlist check)
  SELECT id, tenant_id, role INTO staff_record
  FROM public.staff
  WHERE email = NEW.email AND active = true;

  -- Only create profile if staff record exists (allowlist enforcement)
  IF staff_record.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, tenant_id, staff_id, role)
    VALUES (NEW.id, staff_record.tenant_id, staff_record.id, staff_record.role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger ONLY on INSERT (first user creation)
-- No trigger on UPDATE - profile is immutable after creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- NOTE: Role updates must be done explicitly via admin action:
-- UPDATE profiles SET role = 'NEW_ROLE' WHERE staff_id = '<staff_uuid>';

-- Staff deactivation trigger - immediately revoke access
-- HARDENED: SET search_path prevents schema injection attacks
CREATE OR REPLACE FUNCTION handle_staff_deactivation()
RETURNS trigger AS $$
BEGIN
  IF OLD.active = true AND NEW.active = false THEN
    -- Delete profile to immediately revoke access
    DELETE FROM public.profiles WHERE staff_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER on_staff_deactivated
  AFTER UPDATE OF active ON staff
  FOR EACH ROW EXECUTE FUNCTION handle_staff_deactivation();
-- Migration: 010_rls_policies.sql
-- Applies RLS policies to all business tables

-- ============================================
-- STAFF TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all staff operations" ON staff;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_insert" ON staff
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_update" ON staff
  FOR UPDATE USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_delete" ON staff
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ============================================
-- TECHNICIANS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all technician operations" ON technicians;

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians FORCE ROW LEVEL SECURITY;

CREATE POLICY "technicians_select" ON technicians
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "technicians_insert" ON technicians
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "technicians_update" ON technicians
  FOR UPDATE USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "technicians_delete" ON technicians
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ============================================
-- TICKETS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all ticket operations" ON tickets;

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON tickets
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tickets_insert" ON tickets
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tickets_update" ON tickets
  FOR UPDATE USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tickets_delete" ON tickets
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all customer operations" ON customers;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (tenant_id = get_my_tenant_id());
