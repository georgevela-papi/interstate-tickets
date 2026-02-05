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
