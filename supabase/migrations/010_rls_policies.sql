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
