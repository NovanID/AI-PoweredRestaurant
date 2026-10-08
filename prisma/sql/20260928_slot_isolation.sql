-- ============================================================================
-- 20260928_slot_isolation.sql
-- Phase 4: Data isolation hardening
--
-- 1. Double-booking guard (defense in depth): a table can only hold ONE active
--    reservation (pending/confirmed/seated) per exact date+time slot.
--    The 90-minute overlap window is enforced in application code inside a
--    FOR UPDATE transaction (see PrismaRestaurantRepository.createReservation);
--    this index is the hard DB-level floor.
-- 2. Tenant isolation trigger: reservation.table_id MUST belong to the same
--    tenant_id as the reservation row. Enforced at DB level so even raw SQL
--    writes cannot cross tenants.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE INDEX IF NOT EXISTS reservations_table_slot_idx
  ON reservations (table_id, reservation_date, reservation_time)
  WHERE status IN ('pending', 'confirmed', 'seated');

-- NOTE: run this only once; CREATE UNIQUE INDEX will fail if existing rows
-- violate it. Clean conflicting rows first if needed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'reservations_one_active_slot_per_table'
  ) THEN
    CREATE UNIQUE INDEX reservations_one_active_slot_per_table
      ON reservations (table_id, reservation_date, reservation_time)
      WHERE status IN ('pending', 'confirmed', 'seated');
  END IF;
END $$;

-- Tenant isolation: table_id must belong to the reservation's tenant
CREATE OR REPLACE FUNCTION check_reservation_table_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW.table_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tables WHERE id = NEW.table_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'TENANT_ISOLATION: table % does not belong to tenant %',
        NEW.table_id, NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservation_table_tenant ON reservations;
CREATE TRIGGER trg_reservation_table_tenant
  BEFORE INSERT OR UPDATE OF table_id, tenant_id ON reservations
  FOR EACH ROW EXECUTE FUNCTION check_reservation_table_tenant();
