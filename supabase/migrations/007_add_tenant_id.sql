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
