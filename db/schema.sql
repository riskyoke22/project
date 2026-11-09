-- =============================================================================
-- SISTEM TERINTEGRASI: Buku Tamu, Kinerja, Kepegawaian, Arsip
-- Skema acuan PostgreSQL 17+  (status: DRAFT desain, belum dimigrasikan)
-- Saat scaffolding, file ini menjadi migrasi pertama: db/migrations/0001_init.sql
-- Konvensi: lihat docs/02-erd.md  (identifier Inggris, kamus istilah Indonesia ada di sana)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- digest(), gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;       -- email/username case-insensitive
CREATE EXTENSION IF NOT EXISTS ltree;        -- pohon unit organisasi
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- exclusion constraint riwayat jabatan
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- pencarian fuzzy

CREATE SCHEMA IF NOT EXISTS core;    -- identitas, hak akses, file, referensi bersama
CREATE SCHEMA IF NOT EXISTS hr;      -- kepegawaian
CREATE SCHEMA IF NOT EXISTS perf;    -- manajemen kinerja
CREATE SCHEMA IF NOT EXISTS archive; -- arsip & dokumen
CREATE SCHEMA IF NOT EXISTS guest;   -- buku tamu
CREATE SCHEMA IF NOT EXISTS audit;   -- jejak audit (append-only)

-- -----------------------------------------------------------------------------
-- Kolom standar: disalin ke setiap tabel bisnis lewat LIKE core.base_columns.
-- created_by/updated_by sengaja TANPA FK (hindari siklus; diisi aplikasi, diaudit).
-- -----------------------------------------------------------------------------
CREATE TABLE core.base_columns (
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,                 -- soft delete
  row_version integer     NOT NULL DEFAULT 1  -- optimistic locking
);
COMMENT ON TABLE core.base_columns IS 'Template kolom standar. Jangan diisi data.';

CREATE FUNCTION core.touch_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;

-- =============================================================================
-- CORE: unit organisasi, pengguna, RBAC, sesi, MFA, file, penomoran
-- =============================================================================
CREATE TABLE core.org_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES core.org_units(id),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  unit_type  text NOT NULL,               -- mis. 'division','section' (bebas, tidak di-CHECK)
  path       ltree NOT NULL,              -- diisi aplikasi: 'root.divisi_a.seksi_1'
  is_active  boolean NOT NULL DEFAULT true,
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE INDEX org_units_path_gist ON core.org_units USING gist (path);

CREATE TABLE core.users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         citext NOT NULL UNIQUE,
  email            citext NOT NULL UNIQUE,
  password_hash    text NOT NULL,          -- Argon2id (string PHC lengkap)
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended','locked','disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts  smallint NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  password_changed_at timestamptz,
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE core.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,        -- 'hr_admin', 'archivist', ...
  name        text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,  -- role bawaan tidak boleh dihapus
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE core.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,        -- '<modul>.<resource>.<aksi>' mis. 'hr.employee.read'
  module      text NOT NULL,
  description text
);

CREATE TABLE core.role_permissions (
  role_id       uuid NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES core.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Peran dengan cakupan unit organisasi opsional (NULL = seluruh organisasi)
CREATE TABLE core.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES core.roles(id),
  org_unit_id uuid REFERENCES core.org_units(id),
  valid_from  date NOT NULL DEFAULT current_date,
  valid_to    date,
  granted_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX user_roles_unique_active
  ON core.user_roles (user_id, role_id, COALESCE(org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid), valid_from);

-- Refresh token tersimpan sebagai HASH; family_id untuk deteksi pemakaian ulang token
CREATE TABLE core.auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  family_id          uuid NOT NULL,
  refresh_token_hash bytea NOT NULL UNIQUE,
  user_agent         text,
  ip_address         inet,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  rotated_at         timestamptz,
  revoked_at         timestamptz,
  revoked_reason     text
);
CREATE INDEX auth_sessions_user_idx ON core.auth_sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE core.mfa_factors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  factor_type   text NOT NULL CHECK (factor_type IN ('totp','webauthn','recovery_code')),
  secret_enc    bytea NOT NULL,            -- terenkripsi di aplikasi (AES-256-GCM)
  label         text,
  confirmed_at  timestamptz,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Metadata semua berkas; badan file ada di object storage (MinIO/S3), bukan di DB
CREATE TABLE core.files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket text NOT NULL,
  storage_key    text NOT NULL,            -- acak (uuid), bukan nama asli
  original_name  text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     bigint NOT NULL CHECK (size_bytes >= 0),
  sha256         bytea NOT NULL,
  scan_status    text NOT NULL DEFAULT 'pending'
                 CHECK (scan_status IN ('pending','clean','infected','failed')),
  uploaded_by    uuid REFERENCES core.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  UNIQUE (storage_bucket, storage_key)
);
CREATE INDEX files_sha256_idx ON core.files (sha256);

-- Penomoran berurutan per lingkup & tahun (nomor agenda, nomor BA, dll.)
CREATE TABLE core.number_sequences (
  scope      text NOT NULL,
  year       integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, year)
);
CREATE FUNCTION core.next_number(p_scope text, p_year integer) RETURNS integer
LANGUAGE sql AS $$
  INSERT INTO core.number_sequences AS s (scope, year, last_value)
  VALUES (p_scope, p_year, 1)
  ON CONFLICT (scope, year) DO UPDATE SET last_value = s.last_value + 1
  RETURNING last_value;
$$;

CREATE TABLE core.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  type        text NOT NULL,               -- 'leave.approval_requested', 'archive.disposition', ...
  title       text NOT NULL,
  body        text,
  ref_type    text,                        -- 'leave_request', 'document', ...
  ref_id      uuid,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread ON core.notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- =============================================================================
-- AUDIT: append-only + rantai hash (tamper-evident)
-- =============================================================================
CREATE TABLE audit.audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_ip      inet,
  request_id    text,
  action        text NOT NULL,             -- 'create','update','delete','login','export','view_sensitive',...
  entity        text NOT NULL,             -- 'hr.employees'
  entity_id     text,
  before_data   jsonb,                     -- field sensitif WAJIB sudah dimasking oleh aplikasi
  after_data    jsonb,
  prev_hash     bytea,
  row_hash      bytea NOT NULL
);
CREATE INDEX audit_logs_entity_idx ON audit.audit_logs (entity, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_idx  ON audit.audit_logs (actor_user_id, occurred_at DESC);

CREATE FUNCTION audit.chain_hash() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev bytea;
BEGIN
  PERFORM pg_advisory_xact_lock(727001);   -- serialisasi agar rantai berurutan
  SELECT row_hash INTO prev FROM audit.audit_logs ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := prev;
  NEW.row_hash  := digest(
    COALESCE(prev, '\x'::bytea) ||
    convert_to(concat_ws('|', NEW.occurred_at, NEW.actor_user_id, NEW.action,
                         NEW.entity, NEW.entity_id, NEW.before_data::text, NEW.after_data::text),
               'UTF8'),
    'sha256');
  RETURN NEW;
END $$;
CREATE TRIGGER audit_logs_chain BEFORE INSERT ON audit.audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit.chain_hash();

CREATE FUNCTION audit.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit.audit_logs bersifat append-only'; END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit.audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit.forbid_change();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit.forbid_change();

-- =============================================================================
-- HR: kepegawaian
-- =============================================================================
CREATE TABLE hr.employment_statuses (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,               -- mis. 'PERMANENT','CONTRACT' (disesuaikan organisasi)
  name text NOT NULL
);

CREATE TABLE hr.grades (                    -- golongan/pangkat/level
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  rank_level smallint NOT NULL
);

CREATE TABLE hr.positions (                 -- jabatan
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  position_type text NOT NULL CHECK (position_type IN ('structural','functional','executive')),
  job_level     smallint,
  is_active     boolean NOT NULL DEFAULT true,
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE hr.employees (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE REFERENCES core.users(id),   -- NULL = pegawai tanpa akun
  employee_number    text NOT NULL UNIQUE,                     -- NIP / nomor induk
  national_id_enc    bytea,                                    -- NIK, AES-256-GCM
  national_id_hash   bytea UNIQUE,                             -- blind index HMAC-SHA256 (untuk pencarian/dedup)
  full_name          text NOT NULL,
  front_title        text,
  back_title         text,
  gender             text CHECK (gender IN ('M','F')),
  birth_place        text,
  birth_date         date,
  religion           text,
  marital_status     text,
  work_email         citext UNIQUE,
  phone_enc          bytea,
  residence_address  text,
  employment_status_id smallint REFERENCES hr.employment_statuses(id),
  hire_date          date,
  termination_date   date,
  termination_reason text,
  photo_file_id      uuid REFERENCES core.files(id),
  LIKE core.base_columns INCLUDING DEFAULTS,
  CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);
CREATE INDEX employees_name_trgm ON hr.employees USING gin (full_name gin_trgm_ops);

-- Riwayat penempatan/jabatan: satu penempatan utama aktif pada satu waktu
CREATE TABLE hr.employee_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES hr.employees(id),
  org_unit_id         uuid NOT NULL REFERENCES core.org_units(id),
  position_id         uuid REFERENCES hr.positions(id),
  grade_id            smallint REFERENCES hr.grades(id),
  start_date          date NOT NULL,
  end_date            date,
  is_primary          boolean NOT NULL DEFAULT true,
  decree_number       text,                                    -- nomor SK
  decree_document_id  uuid,                                    -- FK ke archive.documents (ditambah di bawah)
  notes               text,
  LIKE core.base_columns INCLUDING DEFAULTS,
  CHECK (end_date IS NULL OR end_date >= start_date),
  EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
    WHERE (is_primary AND deleted_at IS NULL)
);
CREATE INDEX employee_assignments_unit_idx ON hr.employee_assignments (org_unit_id) WHERE end_date IS NULL;

CREATE TABLE hr.employee_families (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES hr.employees(id),
  relationship text NOT NULL CHECK (relationship IN ('spouse','child','parent','sibling','other')),
  full_name    text NOT NULL,
  birth_date   date,
  national_id_enc bytea,
  is_dependent boolean NOT NULL DEFAULT false,
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE hr.employee_educations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES hr.employees(id),
  level           text NOT NULL,           -- SMA, D3, S1, S2, S3
  institution     text NOT NULL,
  major           text,
  graduation_year smallint,
  certificate_file_id uuid REFERENCES core.files(id),
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE hr.leave_types (
  id                   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  annual_quota_days    numeric(4,1),
  requires_attachment  boolean NOT NULL DEFAULT false,
  is_paid              boolean NOT NULL DEFAULT true
);

CREATE TABLE hr.leave_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES hr.employees(id),
  leave_type_id       smallint NOT NULL REFERENCES hr.leave_types(id),
  year                smallint NOT NULL,
  entitled_days       numeric(4,1) NOT NULL DEFAULT 0,
  carried_over_days   numeric(4,1) NOT NULL DEFAULT 0,
  used_days           numeric(4,1) NOT NULL DEFAULT 0,
  LIKE core.base_columns INCLUDING DEFAULTS,
  UNIQUE (employee_id, leave_type_id, year),
  CHECK (used_days >= 0)
);

CREATE TABLE hr.leave_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        uuid NOT NULL REFERENCES hr.employees(id),
  leave_type_id      smallint NOT NULL REFERENCES hr.leave_types(id),
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  total_days         numeric(4,1) NOT NULL CHECK (total_days > 0),
  reason             text,
  status             text NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
  approver_id        uuid REFERENCES hr.employees(id),
  decided_at         timestamptz,
  decision_note      text,
  attachment_file_id uuid REFERENCES core.files(id),
  LIKE core.base_columns INCLUDING DEFAULTS,
  CHECK (end_date >= start_date)
);
CREATE INDEX leave_requests_emp_idx ON hr.leave_requests (employee_id, start_date DESC);
CREATE INDEX leave_requests_pending_idx ON hr.leave_requests (approver_id) WHERE status = 'submitted';

-- =============================================================================
-- PERF: manajemen kinerja
-- =============================================================================
CREATE TABLE perf.cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  year        smallint NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  LIKE core.base_columns INCLUDING DEFAULTS,
  CHECK (end_date >= start_date)
);

CREATE TABLE perf.goals (                   -- sasaran kinerja / KPI individu
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       uuid NOT NULL REFERENCES perf.cycles(id),
  employee_id    uuid NOT NULL REFERENCES hr.employees(id),
  parent_goal_id uuid REFERENCES perf.goals(id),       -- cascading dari atasan
  title          text NOT NULL,
  description    text,
  indicator      text,
  unit           text,
  target_value   numeric(14,2),
  weight         numeric(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','submitted','agreed','closed')),
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE INDEX goals_emp_cycle_idx ON perf.goals (employee_id, cycle_id);

CREATE TABLE perf.goal_progress (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id              uuid NOT NULL REFERENCES perf.goals(id),
  progress_date        date NOT NULL,
  actual_value         numeric(14,2) NOT NULL,
  note                 text,
  evidence_document_id uuid,                            -- FK ke archive.documents (di bawah)
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE perf.behavior_aspects (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  weight     numeric(5,2) NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE perf.appraisals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       uuid NOT NULL REFERENCES perf.cycles(id),
  employee_id    uuid NOT NULL REFERENCES hr.employees(id),
  appraiser_id   uuid NOT NULL REFERENCES hr.employees(id),
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','self_assessed','appraised','finalized','objected')),
  goal_score     numeric(6,2),
  behavior_score numeric(6,2),
  final_score    numeric(6,2),
  rating         text,                                  -- predikat; skala diatur di aplikasi/konfigurasi
  comment        text,
  finalized_at   timestamptz,
  LIKE core.base_columns INCLUDING DEFAULTS,
  UNIQUE (cycle_id, employee_id),
  CHECK (appraiser_id <> employee_id)
);

CREATE TABLE perf.appraisal_goal_scores (
  appraisal_id  uuid NOT NULL REFERENCES perf.appraisals(id) ON DELETE CASCADE,
  goal_id       uuid NOT NULL REFERENCES perf.goals(id),
  actual_value  numeric(14,2),
  score         numeric(6,2),
  weight        numeric(5,2) NOT NULL,                  -- snapshot bobot saat penilaian
  note          text,
  PRIMARY KEY (appraisal_id, goal_id)
);

CREATE TABLE perf.appraisal_behavior_scores (
  appraisal_id uuid NOT NULL REFERENCES perf.appraisals(id) ON DELETE CASCADE,
  aspect_id    smallint NOT NULL REFERENCES perf.behavior_aspects(id),
  score        numeric(6,2) NOT NULL,
  note         text,
  PRIMARY KEY (appraisal_id, aspect_id)
);

CREATE TABLE perf.appraisal_reviews (       -- jejak alur persetujuan
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id uuid NOT NULL REFERENCES perf.appraisals(id) ON DELETE CASCADE,
  reviewer_id  uuid NOT NULL REFERENCES hr.employees(id),
  action       text NOT NULL CHECK (action IN ('submit','approve','return','finalize','object')),
  comment      text,
  acted_at     timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- ARCHIVE: arsip & dokumen
-- =============================================================================
CREATE TABLE archive.categories (            -- klasifikasi arsip + jadwal retensi
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id             uuid REFERENCES archive.categories(id),
  code                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  active_retention_years   smallint NOT NULL DEFAULT 0,
  inactive_retention_years smallint NOT NULL DEFAULT 0,
  final_disposition     text NOT NULL DEFAULT 'review'
                        CHECK (final_disposition IN ('destroy','permanent','review')),
  LIKE core.base_columns INCLUDING DEFAULTS
);

CREATE TABLE archive.physical_locations (    -- arsip fisik (opsional)
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building text,
  room     text,
  rack     text,
  box      text,
  UNIQUE (building, room, rack, box)
);

CREATE TABLE archive.documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number     text,
  agenda_number       text,                                  -- dari core.next_number()
  doc_type            text NOT NULL
                      CHECK (doc_type IN ('incoming_letter','outgoing_letter','memo','decree','other')),
  title               text NOT NULL,
  summary             text,
  document_date       date,
  received_date       date,
  counterparty        text,                                  -- pengirim/penerima eksternal
  owner_org_unit_id   uuid NOT NULL REFERENCES core.org_units(id),
  category_id         uuid REFERENCES archive.categories(id),
  security_level      text NOT NULL DEFAULT 'internal'
                      CHECK (security_level IN ('public','internal','restricted','confidential')),
  lifecycle_status    text NOT NULL DEFAULT 'active'
                      CHECK (lifecycle_status IN ('active','inactive','permanent','destroyed')),
  retention_until     date,
  current_version_id  uuid,                                  -- FK ditambah setelah document_versions
  physical_location_id uuid REFERENCES archive.physical_locations(id),
  search_vector       tsvector GENERATED ALWAYS AS (
                        to_tsvector('simple',
                          coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' ||
                          coalesce(document_number,'') || ' ' || coalesce(counterparty,''))
                      ) STORED,
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE INDEX documents_search_idx  ON archive.documents USING gin (search_vector);
CREATE INDEX documents_unit_idx    ON archive.documents (owner_org_unit_id, document_date DESC);
CREATE INDEX documents_retention_idx ON archive.documents (retention_until) WHERE lifecycle_status IN ('active','inactive');
CREATE UNIQUE INDEX documents_number_unique ON archive.documents (document_number)
  WHERE document_number IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE archive.document_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES archive.documents(id),
  version_no  integer NOT NULL,
  file_id     uuid NOT NULL REFERENCES core.files(id),
  change_note text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
ALTER TABLE archive.documents
  ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES archive.document_versions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE archive.document_acl (          -- pengecualian akses di atas aturan klasifikasi & unit
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','role','org_unit')),
  subject_id   uuid NOT NULL,
  permission   text NOT NULL CHECK (permission IN ('view','edit','manage')),
  valid_until  timestamptz,
  granted_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, subject_type, subject_id, permission)
);

CREATE TABLE archive.document_dispositions ( -- disposisi surat
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES archive.documents(id),
  from_user_id  uuid NOT NULL REFERENCES core.users(id),
  to_user_id    uuid NOT NULL REFERENCES core.users(id),
  instruction   text NOT NULL,
  due_date      date,
  status        text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','read','done','cancelled')),
  read_at       timestamptz,
  done_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispositions_inbox_idx ON archive.document_dispositions (to_user_id, status);

CREATE TABLE archive.document_links (
  from_document_id uuid NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
  to_document_id   uuid NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
  relation         text NOT NULL CHECK (relation IN ('reply_to','attachment_of','supersedes','related')),
  PRIMARY KEY (from_document_id, to_document_id, relation),
  CHECK (from_document_id <> to_document_id)
);

CREATE TABLE archive.document_tags (
  document_id uuid NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
  tag         citext NOT NULL,
  PRIMARY KEY (document_id, tag)
);

CREATE TABLE archive.disposal_records (      -- berita acara pemusnahan / penyerahan arsip statis
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_number   text NOT NULL UNIQUE,
  record_date     date NOT NULL,
  disposal_type   text NOT NULL CHECK (disposal_type IN ('destroy','transfer_permanent')),
  approved_by     uuid REFERENCES core.users(id),
  record_document_id uuid REFERENCES archive.documents(id),
  notes           text,
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE TABLE archive.disposal_items (
  disposal_record_id uuid NOT NULL REFERENCES archive.disposal_records(id) ON DELETE CASCADE,
  document_id        uuid NOT NULL REFERENCES archive.documents(id),
  PRIMARY KEY (disposal_record_id, document_id)
);

-- FK lintas modul yang tertunda (dokumen harus ada dulu)
ALTER TABLE hr.employee_assignments
  ADD CONSTRAINT assignments_decree_doc_fk FOREIGN KEY (decree_document_id) REFERENCES archive.documents(id);
ALTER TABLE perf.goal_progress
  ADD CONSTRAINT goal_progress_evidence_fk FOREIGN KEY (evidence_document_id) REFERENCES archive.documents(id);

-- =============================================================================
-- GUEST: buku tamu
-- =============================================================================
CREATE TABLE guest.visitors (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          text NOT NULL,
  organization       text,
  identity_type      text CHECK (identity_type IN ('national_id','driver_license','passport','other')),
  identity_number_enc  bytea,                -- terenkripsi
  identity_number_hash bytea,                -- blind index untuk mengenali tamu berulang
  phone_enc          bytea,
  email_enc          bytea,
  photo_file_id      uuid REFERENCES core.files(id),
  is_blocked         boolean NOT NULL DEFAULT false,
  blocked_reason     text,
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE INDEX visitors_identity_idx ON guest.visitors (identity_number_hash) WHERE identity_number_hash IS NOT NULL;
CREATE INDEX visitors_name_trgm    ON guest.visitors USING gin (full_name gin_trgm_ops);

CREATE TABLE guest.appointments (            -- pra-registrasi / janji temu
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        uuid REFERENCES guest.visitors(id),
  visitor_name      text NOT NULL,
  host_employee_id  uuid NOT NULL REFERENCES hr.employees(id),
  org_unit_id       uuid REFERENCES core.org_units(id),
  purpose           text NOT NULL,
  scheduled_at      timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','approved','rejected','cancelled','arrived','expired')),
  qr_token_hash     bytea UNIQUE,            -- token QR disimpan sebagai hash
  qr_expires_at     timestamptz,
  decided_by        uuid,
  LIKE core.base_columns INCLUDING DEFAULTS
);
CREATE INDEX appointments_host_idx ON guest.appointments (host_employee_id, scheduled_at DESC);

CREATE TABLE guest.visits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        uuid NOT NULL REFERENCES guest.visitors(id),
  appointment_id    uuid REFERENCES guest.appointments(id),
  host_employee_id  uuid REFERENCES hr.employees(id),
  org_unit_id       uuid REFERENCES core.org_units(id),
  purpose           text NOT NULL,
  party_size        smallint NOT NULL DEFAULT 1 CHECK (party_size >= 1),
  badge_number      text,
  check_in_at       timestamptz NOT NULL DEFAULT now(),
  check_out_at      timestamptz,
  status            text NOT NULL DEFAULT 'checked_in'
                    CHECK (status IN ('checked_in','checked_out','auto_closed')),
  signature_file_id uuid REFERENCES core.files(id),
  consent_at        timestamptz NOT NULL,    -- persetujuan pemrosesan data pribadi
  retention_until   date,                    -- penghapusan/anonimisasi otomatis oleh job
  checked_in_by     uuid,
  LIKE core.base_columns INCLUDING DEFAULTS,
  CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);
CREATE INDEX visits_time_idx   ON guest.visits (check_in_at DESC);
CREATE INDEX visits_open_idx   ON guest.visits (check_in_at) WHERE status = 'checked_in';
CREATE INDEX visits_host_idx   ON guest.visits (host_employee_id, check_in_at DESC);

CREATE TABLE guest.visit_companions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL REFERENCES guest.visits(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  organization text
);

-- =============================================================================
-- Pasang trigger updated_at/row_version pada semua tabel yang punya row_version
-- =============================================================================
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

-- =============================================================================
-- Role database (least privilege). Ganti kata sandi lewat secret, bukan di file ini.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN CREATE ROLE app_rw NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ro') THEN CREATE ROLE app_ro NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA core, hr, perf, archive, guest, audit TO app_rw, app_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, hr, perf, archive, guest TO app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA core, hr, perf, archive, guest, audit TO app_ro;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA core, hr, perf, archive, guest, audit TO app_rw;
-- audit: aplikasi hanya boleh INSERT + SELECT, tidak boleh UPDATE/DELETE
GRANT SELECT, INSERT ON audit.audit_logs TO app_rw;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_logs FROM app_rw, app_ro;
REVOKE ALL ON core.base_columns FROM app_rw, app_ro;

-- =============================================================================
-- Seed minimal: peran bawaan (izin diisi lewat seed aplikasi per modul)
-- =============================================================================
INSERT INTO core.roles (code, name, is_system) VALUES
  ('super_admin',  'Super Administrator', true),
  ('hr_admin',     'Administrator Kepegawaian', true),
  ('supervisor',   'Atasan / Penilai', true),
  ('employee',     'Pegawai', true),
  ('archivist',    'Arsiparis', true),
  ('receptionist', 'Resepsionis / Petugas Buku Tamu', true),
  ('auditor',      'Auditor (baca saja + log audit)', true)
ON CONFLICT (code) DO NOTHING;
