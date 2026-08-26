-- All of these records are owned by a tracker. Keeping restrictive links
-- between them can block deletion of the owning tracker while PostgreSQL is
-- processing the cascade graph.
ALTER TABLE state_versions
  DROP CONSTRAINT state_versions_run_id_fkey,
  ADD CONSTRAINT state_versions_run_id_fkey
    FOREIGN KEY (run_id) REFERENCES tracker_runs(id) ON DELETE CASCADE;

ALTER TABLE timeline_points
  DROP CONSTRAINT timeline_points_state_version_id_fkey,
  ADD CONSTRAINT timeline_points_state_version_id_fkey
    FOREIGN KEY (state_version_id) REFERENCES state_versions(id) ON DELETE CASCADE;

ALTER TABLE tracker_evidence
  DROP CONSTRAINT tracker_evidence_first_seen_run_id_fkey,
  DROP CONSTRAINT tracker_evidence_last_seen_run_id_fkey,
  ADD CONSTRAINT tracker_evidence_first_seen_run_id_fkey
    FOREIGN KEY (first_seen_run_id) REFERENCES tracker_runs(id) ON DELETE CASCADE,
  ADD CONSTRAINT tracker_evidence_last_seen_run_id_fkey
    FOREIGN KEY (last_seen_run_id) REFERENCES tracker_runs(id) ON DELETE CASCADE;
