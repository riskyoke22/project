-- =============================================================================
-- Migrasi 0001: Ekstensi, Skema, dan Template Kolom Standar
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

