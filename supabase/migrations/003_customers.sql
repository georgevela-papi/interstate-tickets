-- Migration 003: Customers table and search functionality
-- Purpose: Admin can look up customers by phone or name, view history, and create tickets for them

-- 1. Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_raw TEXT,                       -- as-entered, e.g. "(423) 555-1234"
  phone_normalized TEXT,                -- digits only, e.g. "4235551234"
  last_vehicle_text TEXT,               -- denormalized for quick display
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on normalized phone (only for non-null, non-empty values)
-- Allows multiple customers without phones
CREATE UNIQUE INDEX idx_customers_phone_normalized
  ON customers(phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized != '';

-- Index for name search (case-insensitive)
CREATE INDEX idx_customers_name_lower ON customers(lower(name));

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Add customer_id to tickets table
ALTER TABLE tickets ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);

-- 3. RLS on customers (permissive, matching existing pattern)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all customer operations"
  ON customers FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. search_customers RPC function
-- Searches by name (ILIKE) and phone (digit prefix match when 4+ digits)
-- Returns customer info with aggregated ticket stats
CREATE OR REPLACE FUNCTION search_customers(query_text TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  phone_raw TEXT,
  phone_normalized TEXT,
  last_vehicle_text TEXT,
  created_at TIMESTAMPTZ,
  last_visit_date TIMESTAMPTZ,
  total_visits BIGINT
) AS $$
DECLARE
  cleaned_query TEXT;
BEGIN
  -- Strip non-digits for phone matching
  cleaned_query := regexp_replace(query_text, '[^0-9]', '', 'g');

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone_raw,
    c.phone_normalized,
    c.last_vehicle_text,
    c.created_at,
    MAX(t.created_at) AS last_visit_date,
    COUNT(t.id) AS total_visits
  FROM customers c
  LEFT JOIN tickets t ON t.customer_id = c.id
  WHERE
    -- Name search (always active)
    c.name ILIKE '%' || query_text || '%'
    -- Phone search (only when 4+ digits entered)
    OR (
      length(cleaned_query) >= 4
      AND c.phone_normalized LIKE '%' || cleaned_query || '%'
    )
  GROUP BY c.id, c.name, c.phone_raw, c.phone_normalized, c.last_vehicle_text, c.created_at
  ORDER BY MAX(t.created_at) DESC NULLS LAST, c.name ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
