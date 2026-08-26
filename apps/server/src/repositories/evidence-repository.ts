import type { Evidence } from "@radar/contracts";

import { mapEvidence, type EvidenceRow } from "../db/rows.js";
import type { Queryable } from "../db/types.js";

const evidenceColumns = `
  id, canonical_url, title, publisher, published_at, retrieved_at,
  content_hash, extracted_content, fetch_status
`;
const joinedEvidenceColumns = `
  e.id, e.canonical_url, e.title, e.publisher, e.published_at, e.retrieved_at,
  e.content_hash, e.extracted_content, e.fetch_status
`;

export interface EvidenceUpsert {
  canonicalUrl: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  contentHash: string | null;
  extractedContent: string | null;
  fetchStatus: "fetched" | "limited" | "failed";
}

export class EvidenceRepository {
  public constructor(private readonly database: Queryable) {}

  async upsert(input: EvidenceUpsert): Promise<Evidence> {
    const result = await this.database.query<EvidenceRow>(
      `INSERT INTO evidence (
         canonical_url, title, publisher, published_at, retrieved_at,
         content_hash, extracted_content, fetch_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (canonical_url, content_hash) DO UPDATE SET
         title = EXCLUDED.title,
         publisher = COALESCE(EXCLUDED.publisher, evidence.publisher),
         published_at = COALESCE(EXCLUDED.published_at, evidence.published_at),
         retrieved_at = GREATEST(EXCLUDED.retrieved_at, evidence.retrieved_at),
         extracted_content = COALESCE(EXCLUDED.extracted_content, evidence.extracted_content),
         fetch_status = EXCLUDED.fetch_status
       RETURNING ${evidenceColumns}`,
      [
        input.canonicalUrl,
        input.title,
        input.publisher,
        input.publishedAt,
        input.retrievedAt,
        input.contentHash,
        input.extractedContent,
        input.fetchStatus,
      ],
    );
    return mapEvidence(result.rows[0]!);
  }

  async findLatestForTrackerUrl(trackerId: string, canonicalUrl: string): Promise<Evidence | null> {
    const result = await this.database.query<EvidenceRow>(
      `SELECT ${joinedEvidenceColumns}
       FROM evidence e
       JOIN tracker_evidence te ON te.evidence_id = e.id
       WHERE te.tracker_id = $1 AND e.canonical_url = $2
       ORDER BY e.retrieved_at DESC, e.created_at DESC LIMIT 1`,
      [trackerId, canonicalUrl],
    );
    return result.rows[0] ? mapEvidence(result.rows[0]) : null;
  }

  async findForTrackerHash(trackerId: string, contentHash: string): Promise<Evidence | null> {
    const result = await this.database.query<EvidenceRow>(
      `SELECT ${joinedEvidenceColumns}
       FROM evidence e
       JOIN tracker_evidence te ON te.evidence_id = e.id
       WHERE te.tracker_id = $1 AND e.content_hash = $2
       ORDER BY e.retrieved_at DESC, e.created_at DESC LIMIT 1`,
      [trackerId, contentHash],
    );
    return result.rows[0] ? mapEvidence(result.rows[0]) : null;
  }

  async listForTracker(trackerId: string): Promise<Evidence[]> {
    const result = await this.database.query<EvidenceRow>(
      `SELECT ${joinedEvidenceColumns}
       FROM evidence e
       JOIN tracker_evidence te ON te.evidence_id = e.id
       WHERE te.tracker_id = $1
       ORDER BY te.last_seen_at DESC, e.id`,
      [trackerId],
    );
    return result.rows.map(mapEvidence);
  }

  async linkToTracker(input: {
    trackerId: string;
    evidenceId: string;
    runId: string;
    status: "pending" | "processed" | "skipped_unchanged" | "rejected_irrelevant";
    relevance?: string | null;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO tracker_evidence (
         tracker_id, evidence_id, first_seen_run_id, last_seen_run_id, processing_status, relevance
       ) VALUES ($1, $2, $3, $3, $4, $5)
       ON CONFLICT (tracker_id, evidence_id) DO UPDATE SET
         last_seen_run_id = EXCLUDED.last_seen_run_id,
         last_seen_at = now(),
         processing_status = EXCLUDED.processing_status,
         relevance = COALESCE(EXCLUDED.relevance, tracker_evidence.relevance)`,
      [input.trackerId, input.evidenceId, input.runId, input.status, input.relevance ?? null],
    );
  }

  async linkToStateVersion(stateVersionId: string, evidenceIds: string[]): Promise<void> {
    for (const evidenceId of new Set(evidenceIds)) {
      await this.database.query(
        `INSERT INTO state_version_evidence (state_version_id, evidence_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [stateVersionId, evidenceId],
      );
    }
  }

  async linkToTimelinePoint(timelinePointId: string, evidenceIds: string[]): Promise<void> {
    for (const evidenceId of new Set(evidenceIds)) {
      await this.database.query(
        `INSERT INTO timeline_point_evidence (timeline_point_id, evidence_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [timelinePointId, evidenceId],
      );
    }
  }
}
