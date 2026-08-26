import type { Queryable } from "../db/types.js";

export class InspectionRepository {
  public constructor(private readonly database: Queryable) {}

  async inspectTracker(trackerId: string) {
    const [runs, evidence, stateHistory] = await Promise.all([
      this.database.query(
        `SELECT id, tracker_id, status, outcome, attempt, started_at, completed_at,
                error, search_cache, created_at
         FROM tracker_runs WHERE tracker_id = $1 ORDER BY created_at DESC`,
        [trackerId],
      ),
      this.database.query(
        `SELECT e.id, e.canonical_url, e.title, e.publisher, e.published_at,
                e.retrieved_at, e.content_hash, e.fetch_status,
                te.processing_status, te.relevance, te.first_seen_at, te.last_seen_at,
                te.first_seen_run_id, te.last_seen_run_id
         FROM tracker_evidence te
         JOIN evidence e ON e.id = te.evidence_id
         WHERE te.tracker_id = $1 ORDER BY te.last_seen_at DESC`,
        [trackerId],
      ),
      this.database.query(
        `SELECT sv.id, sv.run_id, sv.version, sv.summary, sv.state, sv.created_at,
                COALESCE(array_agg(sve.evidence_id) FILTER (WHERE sve.evidence_id IS NOT NULL), '{}') AS evidence_ids
         FROM state_versions sv
         LEFT JOIN state_version_evidence sve ON sve.state_version_id = sv.id
         WHERE sv.tracker_id = $1
         GROUP BY sv.id ORDER BY sv.version ASC`,
        [trackerId],
      ),
    ]);

    return { runs: runs.rows, evidence: evidence.rows, stateHistory: stateHistory.rows };
  }
}
