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
