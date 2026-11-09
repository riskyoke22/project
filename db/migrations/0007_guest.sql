-- =============================================================================
-- Migrasi 0007: Skema GUEST (Buku Tamu, Pra-Registrasi, Kunjungan Fisik)
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

