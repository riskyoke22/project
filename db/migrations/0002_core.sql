-- =============================================================================
-- Migrasi 0002: Skema CORE (Organisasi, Pengguna, RBAC, Sesi, MFA, File, Penomoran, Notifikasi)
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

