-- Polish Tiger source layer: data fetched from American Dragon, kept apart from the atlas tables
-- (schema polish_tiger), from translations and from editorial changes. Applied by scripts/migrate.ts.

CREATE SCHEMA IF NOT EXISTS polish_tiger_source;
SET search_path TO polish_tiger_source;

-- Every importer invocation: scope, limits, parser version, counters and the final report.
CREATE TABLE import_runs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stage         TEXT NOT NULL CHECK (stage IN ('discover', 'fetch', 'parse')),
  scope         JSONB NOT NULL,
  config        JSONB NOT NULL,
  parser_version TEXT,
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'aborted')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  counters      JSONB NOT NULL DEFAULT '{}',
  report        JSONB,
  error         TEXT
);

-- One row per canonical URL; the stable key of everything fetched.
CREATE TABLE source_pages (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_url    TEXT NOT NULL UNIQUE,
  original_url     TEXT NOT NULL,
  page_type        TEXT NOT NULL CHECK (page_type IN ('herb', 'formula', 'index')),
  index_label      TEXT,
  discovered_via   TEXT NOT NULL,
  discovered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  discovery_run_id BIGINT REFERENCES import_runs(id),
  status           TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'fetched', 'error', 'gone')),
  last_hash        TEXT,
  etag             TEXT,
  last_modified    TEXT,
  last_fetched_at  TIMESTAMPTZ,
  last_checked_at  TIMESTAMPTZ,
  last_error       TEXT
);

-- Fetch history. raw_html is only kept when the retention policy allows it.
CREATE TABLE source_page_revisions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_page_id   BIGINT NOT NULL REFERENCES source_pages(id),
  run_id           BIGINT NOT NULL REFERENCES import_runs(id),
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  http_status      INTEGER NOT NULL,
  final_url        TEXT NOT NULL,
  attempts         INTEGER NOT NULL,
  content_hash     TEXT NOT NULL,
  headers          JSONB NOT NULL DEFAULT '{}',
  retention_policy TEXT NOT NULL CHECK (retention_policy IN ('raw_html', 'excerpts_only')),
  raw_html         TEXT,
  CHECK (retention_policy = 'raw_html' OR raw_html IS NULL),
  UNIQUE (source_page_id, content_hash)
);

-- Identity and unprocessed source values. Arrays keep the source order and wording.
CREATE TABLE herbs (
  id                   TEXT PRIMARY KEY,
  source_page_id       BIGINT NOT NULL UNIQUE REFERENCES source_pages(id),
  revision_id          BIGINT NOT NULL REFERENCES source_page_revisions(id),
  pinyin               TEXT NOT NULL,
  chinese              TEXT,
  pharmaceutical_latin TEXT,
  english_names        TEXT[] NOT NULL DEFAULT '{}',
  parser_version       TEXT NOT NULL,
  parsed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE formulas (
  id             TEXT PRIMARY KEY,
  source_page_id BIGINT NOT NULL UNIQUE REFERENCES source_pages(id),
  revision_id    BIGINT NOT NULL REFERENCES source_page_revisions(id),
  pinyin         TEXT NOT NULL,
  chinese        TEXT,
  english_name   TEXT,
  also_known_as  TEXT[] NOT NULL DEFAULT '{}',
  parser_version TEXT NOT NULL,
  parsed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingredients exactly as the source lists them; herb_id links a herb card when one exists.
CREATE TABLE formula_ingredients (
  formula_id    TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  pinyin_raw    TEXT NOT NULL,
  latin_raw     TEXT NOT NULL,
  dosage_raw    TEXT NOT NULL,
  amount_min    NUMERIC,
  amount_max    NUMERIC,
  unit          TEXT,
  is_optional   BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT[] NOT NULL DEFAULT '{}',
  herb_id       TEXT REFERENCES herbs(id),
  revision_id   BIGINT NOT NULL REFERENCES source_page_revisions(id),
  PRIMARY KEY (formula_id, position)
);

CREATE TABLE formula_modifications (
  formula_id     TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  condition      TEXT NOT NULL,
  operation      TEXT NOT NULL CHECK (operation IN ('add', 'remove', 'other')),
  ingredient_raw TEXT NOT NULL,
  source_excerpt TEXT NOT NULL,
  revision_id    BIGINT NOT NULL REFERENCES source_page_revisions(id),
  PRIMARY KEY (formula_id, position)
);

-- Field-level provenance: the value, where it came from and how sure we are.
CREATE TABLE field_evidence (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_kind    TEXT NOT NULL CHECK (record_kind IN ('herb', 'formula')),
  record_id      TEXT NOT NULL,
  field          TEXT NOT NULL,
  value          JSONB,
  source_url     TEXT NOT NULL,
  revision_id    BIGINT NOT NULL REFERENCES source_page_revisions(id),
  source_excerpt TEXT,
  fetched_at     TIMESTAMPTZ NOT NULL,
  parser         TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  value_status   TEXT NOT NULL CHECK (value_status IN ('source', 'normalized', 'translated', 'ai_proposed', 'human_approved')),
  completeness   TEXT NOT NULL CHECK (completeness IN ('present', 'missing_in_source', 'unreadable', 'needs_review')),
  UNIQUE (record_kind, record_id, field, revision_id)
);

-- Controlled vocabularies. Source terms keep their language; normalized/Polish terms are separate rows.
CREATE TABLE taxonomy_terms (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  axis     TEXT NOT NULL CHECK (axis IN ('category', 'taste', 'temperature', 'toxicity', 'channel', 'action', 'action_object',
                                         'pattern', 'symptom', 'indication', 'contraindication')),
  label    TEXT NOT NULL,
  language TEXT NOT NULL,
  status   TEXT NOT NULL CHECK (status IN ('source', 'normalized', 'human_approved')),
  UNIQUE (axis, label, language)
);

CREATE TABLE herb_tags (
  herb_id      TEXT NOT NULL REFERENCES herbs(id) ON DELETE CASCADE,
  term_id      BIGINT NOT NULL REFERENCES taxonomy_terms(id),
  qualifier    TEXT NOT NULL DEFAULT 'primary' CHECK (qualifier IN ('primary', 'secondary')),
  value_status TEXT NOT NULL CHECK (value_status IN ('source', 'normalized', 'ai_proposed', 'human_approved')),
  evidence_id  BIGINT REFERENCES field_evidence(id),
  PRIMARY KEY (herb_id, term_id)
);

CREATE TABLE formula_tags (
  formula_id   TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  term_id      BIGINT NOT NULL REFERENCES taxonomy_terms(id),
  qualifier    TEXT NOT NULL DEFAULT 'primary' CHECK (qualifier IN ('primary', 'secondary')),
  value_status TEXT NOT NULL CHECK (value_status IN ('source', 'normalized', 'ai_proposed', 'human_approved')),
  evidence_id  BIGINT REFERENCES field_evidence(id),
  PRIMARY KEY (formula_id, term_id)
);

-- Translations are versions next to the source text, never replacements of it.
CREATE TABLE translations (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_kind      TEXT NOT NULL CHECK (record_kind IN ('herb', 'formula', 'term')),
  record_id        TEXT NOT NULL,
  field            TEXT NOT NULL,
  language         TEXT NOT NULL,
  source_text      TEXT NOT NULL,
  source_hash      TEXT NOT NULL,
  translated_text  TEXT NOT NULL,
  glossary_version TEXT NOT NULL,
  model            TEXT,
  prompt_version   TEXT,
  status           TEXT NOT NULL CHECK (status IN ('ai_proposed', 'human_approved', 'rejected', 'conflict')),
  cost_eur         NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (record_kind, record_id, field, language, source_hash, glossary_version)
);

-- Anything the importer could not decide on its own.
CREATE TABLE review_queue (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         BIGINT REFERENCES import_runs(id),
  source_page_id BIGINT REFERENCES source_pages(id),
  record_kind    TEXT,
  record_id      TEXT,
  field          TEXT,
  issue_type     TEXT NOT NULL CHECK (issue_type IN ('unknown_section', 'missing_field', 'unreadable', 'ambiguous_value', 'name_mismatch',
                                                     'unlinked_ingredient', 'unknown_term', 'conflict', 'fetch_error', 'duplicate', 'template_variant')),
  detail         TEXT NOT NULL,
  source_excerpt TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolution     TEXT
);
-- Re-running the same batch must not duplicate open review items.
CREATE UNIQUE INDEX review_queue_open_item ON review_queue (coalesce(record_kind, ''), coalesce(record_id, ''), coalesce(field, ''), issue_type, detail) WHERE status = 'open';

CREATE TABLE import_run_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         BIGINT NOT NULL REFERENCES import_runs(id),
  source_page_id BIGINT REFERENCES source_pages(id),
  url            TEXT NOT NULL,
  outcome        TEXT NOT NULL CHECK (outcome IN ('discovered', 'known', 'duplicate', 'skipped', 'fetched', 'not_modified', 'unchanged',
                                                  'parsed', 'incomplete', 'invalid', 'error')),
  http_status    INTEGER,
  attempts       INTEGER,
  message        TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The source layer is only reachable through server-side roles, never the Supabase/Neon data API.
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE herbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE herb_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_run_items ENABLE ROW LEVEL SECURITY;
