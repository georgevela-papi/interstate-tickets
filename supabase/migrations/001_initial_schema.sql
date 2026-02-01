-- Interstate Tires Job Ticket System - Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE ticket_status AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE priority_level AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE service_type AS ENUM (
  'MOUNT_BALANCE',
  'FLAT_REPAIR', 
  'ROTATION',
  'NEW_TIRES',
  'USED_TIRES',
  'DETAILING',
  'APPOINTMENT'
);
CREATE TYPE staff_role AS ENUM ('SERVICE_WRITER', 'TECHNICIAN', 'MANAGER');

-- Staff table (replaces old authentication)
-- Uses ID codes instead of PINs for simpler iPad login
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_code TEXT UNIQUE NOT NULL,  -- e.g., "SW01", "T01", "M01"
  name TEXT NOT NULL,
  role staff_role NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technicians table (subset of staff for ticket completion)
CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE NOT NULL,
  
  -- Core fields
  service_type service_type NOT NULL,
  priority priority_level DEFAULT 'NORMAL',
  status ticket_status DEFAULT 'PENDING',
  
  -- Common fields
  vehicle TEXT NOT NULL,  -- "2019 Honda Civic - Blue"
  
  -- Service-specific data stored as JSONB
  service_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  
  -- Appointment-specific fields
  scheduled_time TIMESTAMPTZ,  -- Only for APPOINTMENT type
  
  -- Completion tracking
  completed_by UUID REFERENCES technicians(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Validation constraint
  CONSTRAINT valid_completion CHECK (
    (status = 'COMPLETED' AND completed_by IS NOT NULL AND completed_at IS NOT NULL) OR
    (status = 'PENDING' AND completed_by IS NULL AND completed_at IS NULL)
  ),
  
  -- Appointment must have scheduled_time
  CONSTRAINT valid_appointment CHECK (
    (service_type = 'APPOINTMENT' AND scheduled_time IS NOT NULL) OR
    (service_type != 'APPOINTMENT')
  )
);

-- Indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX idx_tickets_completed ON tickets(completed_at DESC);
CREATE INDEX idx_tickets_scheduled ON tickets(scheduled_time);
CREATE INDEX idx_tickets_service_type ON tickets(service_type);
CREATE INDEX idx_tickets_completed_by ON tickets(completed_by);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff updated_at
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial staff (ID codes for easy login)
INSERT INTO staff (id_code, name, role) VALUES
  ('SW01', 'Front Desk', 'SERVICE_WRITER'),
  ('T01', 'Mike', 'TECHNICIAN'),
  ('T02', 'Jose', 'TECHNICIAN'),
  ('T03', 'Sarah', 'TECHNICIAN'),
  ('ADMIN', 'Manager', 'MANAGER');

-- Seed technicians from staff
INSERT INTO technicians (staff_id, name)
SELECT id, name FROM staff WHERE role = 'TECHNICIAN';

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Staff can view all active staff
CREATE POLICY "Active staff visible to all"
  ON staff FOR SELECT
  USING (active = true);

-- Only managers can modify staff
CREATE POLICY "Managers can manage staff"
  ON staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id_code = current_setting('app.current_user_id', true)
      AND staff.role = 'MANAGER'
    )
  );

-- Everyone can view active technicians
CREATE POLICY "Active technicians visible to all"
  ON technicians FOR SELECT
  USING (active = true);

-- Only managers can modify technicians
CREATE POLICY "Managers can manage technicians"
  ON technicians FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id_code = current_setting('app.current_user_id', true)
      AND staff.role = 'MANAGER'
    )
  );

-- Anyone authenticated can view pending tickets
CREATE POLICY "Everyone can view pending tickets"
  ON tickets FOR SELECT
  USING (status = 'PENDING');

-- Anyone authenticated can view completed tickets (for reporting)
CREATE POLICY "Everyone can view completed tickets"
  ON tickets FOR SELECT
  USING (status = 'COMPLETED');

-- Service writers and managers can create tickets
CREATE POLICY "Service writers can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id_code = current_setting('app.current_user_id', true)
      AND staff.role IN ('SERVICE_WRITER', 'MANAGER')
    )
  );

-- Technicians and managers can complete tickets
CREATE POLICY "Technicians can complete tickets"
  ON tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id_code = current_setting('app.current_user_id', true)
      AND staff.role IN ('TECHNICIAN', 'MANAGER')
    )
  )
  WITH CHECK (status = 'COMPLETED' AND completed_by IS NOT NULL);

-- Create a view for queue display (excludes future appointments)
CREATE OR REPLACE VIEW active_queue AS
SELECT 
  id,
  ticket_number,
  service_type,
  priority,
  vehicle,
  service_data,
  notes,
  scheduled_time,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_waiting
FROM tickets
WHERE status = 'PENDING'
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

-- Grant permissions on view
GRANT SELECT ON active_queue TO authenticated;
GRANT SELECT ON active_queue TO anon;

-- Comments for documentation
COMMENT ON TABLE tickets IS 'Job tickets with service type, priority, and completion tracking';
COMMENT ON TABLE technicians IS 'Active technicians who can complete jobs';
COMMENT ON TABLE staff IS 'All staff members with ID code authentication';
COMMENT ON COLUMN tickets.service_data IS 'JSONB field for service-specific data (tire_count, tire_size, etc.)';
COMMENT ON COLUMN tickets.scheduled_time IS 'For APPOINTMENT type only - when the appointment is scheduled';
COMMENT ON VIEW active_queue IS 'Real-time queue view excluding future appointments';
