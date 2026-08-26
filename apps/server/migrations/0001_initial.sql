CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query text NOT NULL CHECK (length(btrim(query)) BETWEEN 1 AND 1000),
  title text CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 120),
  summary text CHECK (summary IS NULL OR length(btrim(summary)) BETWEEN 1 AND 500),
  current_state jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  next_check_at timestamptz,
  CHECK (current_state IS NULL OR jsonb_typeof(current_state) = 'object')
);

CREATE TABLE tracker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  outcome text CHECK (outcome IN ('baseline', 'no_change', 'changed', 'failed')),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  search_cache jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracker_id, idempotency_key),
  CHECK ((status = 'failed') = (error IS NOT NULL)),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url text NOT NULL CHECK (length(btrim(canonical_url)) > 0),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  publisher text CHECK (publisher IS NULL OR length(btrim(publisher)) BETWEEN 1 AND 200),
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  content_hash text CHECK (content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'),
  extracted_content text,
  fetch_status text NOT NULL CHECK (fetch_status IN ('fetched', 'limited', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (canonical_url, content_hash),
  CHECK (fetch_status <> 'fetched' OR (content_hash IS NOT NULL AND extracted_content IS NOT NULL))
);

CREATE TABLE state_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  run_id uuid NOT NULL UNIQUE REFERENCES tracker_runs(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 500),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracker_id, version)
);

CREATE TABLE timeline_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  state_version_id uuid NOT NULL REFERENCES state_versions(id) ON DELETE RESTRICT,
  headline text NOT NULL CHECK (length(btrim(headline)) BETWEEN 1 AND 160),
  detail text NOT NULL CHECK (length(btrim(detail)) BETWEEN 1 AND 1000),
  detected_at timestamptz NOT NULL DEFAULT now(),
  occurred_at timestamptz
);

CREATE TABLE tracker_evidence (
  tracker_id uuid NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  first_seen_run_id uuid NOT NULL REFERENCES tracker_runs(id) ON DELETE RESTRICT,
  last_seen_run_id uuid NOT NULL REFERENCES tracker_runs(id) ON DELETE RESTRICT,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processed', 'skipped_unchanged', 'rejected_irrelevant')
  ),
  relevance text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tracker_id, evidence_id),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE state_version_evidence (
  state_version_id uuid NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY (state_version_id, evidence_id)
);

CREATE TABLE timeline_point_evidence (
  timeline_point_id uuid NOT NULL REFERENCES timeline_points(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY (timeline_point_id, evidence_id)
);

CREATE UNIQUE INDEX tracker_runs_one_active_per_tracker
  ON tracker_runs (tracker_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX trackers_due_active_idx
  ON trackers (next_check_at, id)
  WHERE status = 'active' AND next_check_at IS NOT NULL;

CREATE INDEX tracker_runs_recent_idx ON tracker_runs (tracker_id, created_at DESC);
CREATE INDEX state_versions_history_idx ON state_versions (tracker_id, version DESC);
CREATE INDEX timeline_points_tracker_idx ON timeline_points (tracker_id, detected_at DESC);
CREATE INDEX tracker_evidence_last_seen_idx ON tracker_evidence (tracker_id, last_seen_at DESC);
CREATE INDEX evidence_hash_idx ON evidence (content_hash) WHERE content_hash IS NOT NULL;

CREATE FUNCTION reject_state_version_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'state_versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER state_versions_immutable
  BEFORE UPDATE OR DELETE ON state_versions
  FOR EACH ROW EXECUTE FUNCTION reject_state_version_mutation();

