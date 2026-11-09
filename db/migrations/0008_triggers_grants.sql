-- =============================================================================
-- Migrasi 0008: Trigger Otomatis, Hak Akses Role (Least Privilege), dan Peran Bawaan
-- =============================================================================

-- Pasang trigger updated_at/row_version pada semua tabel yang memiliki row_version
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name FROM information_schema.columns
    WHERE column_name = 'row_version'
      AND table_schema IN ('core','hr','perf','archive','guest')
      AND table_name <> 'base_columns'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER touch_row BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION core.touch_row()',
      r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Role database terpisah (migrator untuk DDL, app_rw untuk operasi runtime, app_ro untuk read-only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN CREATE ROLE migrator NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN CREATE ROLE app_rw NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ro') THEN CREATE ROLE app_ro NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA core, hr, perf, archive, guest, audit TO app_rw, app_ro, migrator;
GRANT ALL PRIVILEGES ON SCHEMA core, hr, perf, archive, guest, audit TO migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core, hr, perf, archive, guest, audit TO migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core, hr, perf, archive, guest, audit TO migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, hr, perf, archive, guest TO app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA core, hr, perf, archive, guest, audit TO app_ro;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA core, hr, perf, archive, guest, audit TO app_rw;

-- audit: aplikasi hanya boleh INSERT + SELECT, tidak boleh UPDATE/DELETE
GRANT SELECT, INSERT ON audit.audit_logs TO app_rw;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_logs FROM app_rw, app_ro;
REVOKE ALL ON core.base_columns FROM app_rw, app_ro;

-- Seed minimal: peran bawaan (izin diisi lewat seed aplikasi per modul)
INSERT INTO core.roles (code, name, is_system) VALUES
  ('super_admin',  'Super Administrator', true),
  ('hr_admin',     'Administrator Kepegawaian', true),
  ('supervisor',   'Atasan / Penilai', true),
  ('employee',     'Pegawai', true),
  ('archivist',    'Arsiparis', true),
  ('receptionist', 'Resepsionis / Petugas Buku Tamu', true),
  ('auditor',      'Auditor (baca saja + log audit)', true)
ON CONFLICT (code) DO NOTHING;

