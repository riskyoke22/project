-- =============================================================================
-- Migrasi 0004: Skema HR (Kepegawaian, Jabatan, Riwayat Penempatan, Cuti)
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
  decree_document_id  uuid,                                    -- FK ke archive.documents (ditambahkan setelah archive dibuat)
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

