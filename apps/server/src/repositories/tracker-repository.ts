import type { Tracker } from "@radar/contracts";

import { mapTracker, type TrackerRow } from "../db/rows.js";
import type { Queryable } from "../db/types.js";

const trackerColumns = `
  id, query, title, summary, current_state, status, created_at, updated_at,
  last_checked_at, last_changed_at, next_check_at
  , poll_interval_minutes
`;

export class TrackerRepository {
  public constructor(private readonly database: Queryable) {}

  async create(query: string, pollIntervalMinutes: number, nextCheckAt: Date | null = new Date()): Promise<Tracker> {
    const result = await this.database.query<TrackerRow>(
      `INSERT INTO trackers (query, poll_interval_minutes, next_check_at)
       VALUES ($1, $2, $3)
       RETURNING ${trackerColumns}`,
      [query.trim(), pollIntervalMinutes, nextCheckAt],
    );
    return mapTracker(result.rows[0]!);
  }

  async findById(id: string): Promise<Tracker | null> {
    const result = await this.database.query<TrackerRow>(
      `SELECT ${trackerColumns} FROM trackers WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapTracker(result.rows[0]) : null;
  }

  async list(): Promise<Tracker[]> {
    const result = await this.database.query<TrackerRow>(
      `SELECT ${trackerColumns} FROM trackers ORDER BY updated_at DESC, id`,
    );
    return result.rows.map(mapTracker);
  }

  async listDue(limit: number): Promise<Tracker[]> {
    const result = await this.database.query<TrackerRow>(
      `SELECT ${trackerColumns} FROM trackers
       WHERE status = 'active' AND next_check_at <= now()
       ORDER BY next_check_at ASC, id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapTracker);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM trackers WHERE id = $1`,
      [id],
    );
    return result.rowCount === 1;
  }

  async setStatus(id: string, status: "active" | "paused"): Promise<Tracker | null> {
    const result = await this.database.query<TrackerRow>(
      `UPDATE trackers
       SET status = $2, updated_at = now(),
           next_check_at = CASE WHEN $2 = 'active' THEN COALESCE(next_check_at, now()) ELSE next_check_at END
       WHERE id = $1
       RETURNING ${trackerColumns}`,
      [id, status],
    );
    return result.rows[0] ? mapTracker(result.rows[0]) : null;
  }

  async setPollInterval(id: string, pollIntervalMinutes: number): Promise<Tracker | null> {
    const result = await this.database.query<TrackerRow>(
      `UPDATE trackers SET poll_interval_minutes = $2::integer, updated_at = now(),
         next_check_at = CASE WHEN status = 'active'
           THEN now() + ($2::integer * interval '1 minute') ELSE next_check_at END
       WHERE id = $1 RETURNING ${trackerColumns}`,
      [id, pollIntervalMinutes],
    );
    return result.rows[0] ? mapTracker(result.rows[0]) : null;
  }
}
