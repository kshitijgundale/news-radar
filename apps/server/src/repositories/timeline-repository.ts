import { timelinePointSchema, type TimelinePointInput } from "@radar/contracts";

import type { Queryable } from "../db/types.js";

export interface TimelinePoint extends TimelinePointInput {
  id: string;
  trackerId: string;
  stateVersionId: string;
  detectedAt: string;
}

interface TimelineSummaryRow {
  headline: string;
  detail: string;
}

interface TimelinePointRow {
  id: string;
  tracker_id: string;
  state_version_id: string;
  headline: string;
  detail: string;
  detected_at: Date;
  occurred_at: Date | null;
  evidence_ids: string[];
}

export class TimelineRepository {
  public constructor(private readonly database: Queryable) {}

  async findLatestSummary(trackerId: string): Promise<string | null> {
    const result = await this.database.query<TimelineSummaryRow>(
      `SELECT headline, detail FROM timeline_points
       WHERE tracker_id = $1 ORDER BY detected_at DESC, id DESC LIMIT 1`,
      [trackerId],
    );
    const point = result.rows[0];
    return point ? `${point.headline}: ${point.detail}` : null;
  }

  async listForTracker(trackerId: string): Promise<TimelinePoint[]> {
    const result = await this.database.query<TimelinePointRow>(
      `SELECT tp.id, tp.tracker_id, tp.state_version_id, tp.headline, tp.detail,
              tp.detected_at, tp.occurred_at,
              COALESCE(array_agg(tpe.evidence_id) FILTER (WHERE tpe.evidence_id IS NOT NULL), '{}') AS evidence_ids
       FROM timeline_points tp
       LEFT JOIN timeline_point_evidence tpe ON tpe.timeline_point_id = tp.id
       WHERE tp.tracker_id = $1
       GROUP BY tp.id
       ORDER BY tp.detected_at DESC, tp.id DESC`,
      [trackerId],
    );
    return result.rows.map((row) => timelinePointSchema.parse({
      id: row.id,
      trackerId: row.tracker_id,
      stateVersionId: row.state_version_id,
      headline: row.headline,
      detail: row.detail,
      detectedAt: row.detected_at.toISOString(),
      occurredAt: row.occurred_at?.toISOString() ?? null,
      evidenceIds: row.evidence_ids,
    }));
  }
}
