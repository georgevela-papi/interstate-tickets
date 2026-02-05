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
