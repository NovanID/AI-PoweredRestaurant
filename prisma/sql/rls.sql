-- ============================================================================
-- rls.sql — Row Level Security untuk isolasi tenant di PostgreSQL.
--
-- PENTING: RLS TIDAK berlaku untuk superuser. Aplikasi saat ini konek sebagai
-- `postgres` (superuser), jadi script ini baru efektif setelah:
--   1. Dibuat role aplikasi khusus (mis. `app_user`) yang BUKAN superuser.
--   2. DATABASE_URL diganti ke role tersebut.
--   3. Setiap koneksi men-set `app.current_tenant` sebelum query
--      (Prisma: $executeRaw SET LOCAL app.current_tenant = '<tenantId>' dalam
--      transaction, atau connection-pool hook).
--
-- Jalankan sebagai superuser SETELAH langkah 1-3 siap:
-- ============================================================================

ALTER TABLE restaurants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events  ENABLE ROW LEVEL SECURITY;

-- Kebijakan: baris hanya terlihat jika tenant_id = sesi app.current_tenant
CREATE POLICY tenant_isolation_restaurants ON restaurants
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_tables ON tables
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_menu_items ON menu_items
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_reservations ON reservations
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_audit_events ON audit_events
  USING (tenant_id = current_setting('app.current_tenant', true));

-- Role aplikasi (contoh — sesuaikan password sebelum produksi):
-- CREATE ROLE app_user LOGIN PASSWORD 'GANTI_PASSWORD_INI';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
