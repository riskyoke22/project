-- =============================================================================
-- Migrasi 0003: Skema AUDIT (Append-Only + Rantai Hash Tamper-Evident)
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

