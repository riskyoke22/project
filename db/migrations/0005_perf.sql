-- =============================================================================
-- Migrasi 0005: Skema PERF (Siklus Kinerja, Sasaran/KPI, Progres, Penilaian)
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
  evidence_document_id uuid,                            -- FK ke archive.documents (ditambahkan setelah archive dibuat)
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

