-- =============================================================================
-- Migrasi 0006: Skema ARCHIVE (Klasifikasi Arsip, Dokumen, Versi, Hak Akses, Disposisi, Retensi)
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

