import type { TrackerRun } from "@radar/contracts";

import { mapRun, type RunRow } from "../db/rows.js";
import type { Queryable } from "../db/types.js";

const runColumns = "id, tracker_id, status, outcome, started_at, completed_at, error";

export class RunRepository {
  public constructor(private readonly database: Queryable) {}

  async createPending(trackerId: string, idempotencyKey: string): Promise<TrackerRun> {
    const result = await this.database.query<RunRow>(
      `INSERT INTO tracker_runs (tracker_id, idempotency_key)
       VALUES ($1, $2)
       ON CONFLICT (tracker_id, idempotency_key) DO UPDATE
         SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING ${runColumns}`,
      [trackerId, idempotencyKey],
    );
    return mapRun(result.rows[0]!);
  }

  async acquire(trackerId: string, idempotencyKey: string): Promise<{
    run: TrackerRun;
    acquired: boolean;
  }> {
    try {
      const result = await this.database.query<RunRow>(
        `INSERT INTO tracker_runs (tracker_id, idempotency_key)
         VALUES ($1, $2)
         ON CONFLICT (tracker_id, idempotency_key) DO NOTHING
         RETURNING ${runColumns}`,
        [trackerId, idempotencyKey],
      );
      if (result.rows[0]) return { run: mapRun(result.rows[0]), acquired: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    const existing = await this.database.query<RunRow>(
      `SELECT ${runColumns} FROM tracker_runs
       WHERE tracker_id = $1 AND (
         idempotency_key = $2 OR status IN ('pending', 'running')
       )
       ORDER BY (idempotency_key = $2) DESC, created_at DESC LIMIT 1`,
      [trackerId, idempotencyKey],
    );
    if (!existing.rows[0]) throw new Error("Run acquisition conflicted but no existing run was found");
    return { run: mapRun(existing.rows[0]), acquired: false };
  }

  async setAttempt(id: string, attempt: number): Promise<void> {
    await this.database.query("UPDATE tracker_runs SET attempt = $2 WHERE id = $1", [id, attempt]);
  }

  async markRunning(id: string): Promise<TrackerRun> {
    return this.update(id, "running", null, null, "started_at = COALESCE(started_at, now())");
  }

  async markSucceeded(id: string, outcome: "baseline" | "no_change" | "changed"): Promise<TrackerRun> {
    return this.update(id, "succeeded", outcome, null, "completed_at = now()");
  }

  async markFailed(id: string, error: string): Promise<TrackerRun> {
    return this.update(
      id,
      "failed",
      "failed",
      error,
      "started_at = COALESCE(started_at, now()), completed_at = now()",
    );
  }

  async findLatest(trackerId: string): Promise<TrackerRun | null> {
    const result = await this.database.query<RunRow>(
      `SELECT ${runColumns} FROM tracker_runs
       WHERE tracker_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [trackerId],
    );
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async findLatestForTrackers(trackerIds: string[]): Promise<Map<string, TrackerRun>> {
    if (trackerIds.length === 0) return new Map();
    const result = await this.database.query<RunRow>(
      `SELECT DISTINCT ON (tracker_id) ${runColumns}
       FROM tracker_runs WHERE tracker_id = ANY($1::uuid[])
       ORDER BY tracker_id, created_at DESC`,
      [trackerIds],
    );
    return new Map(result.rows.map((row) => [row.tracker_id, mapRun(row)]));
  }

  private async update(
    id: string,
    status: "running" | "succeeded" | "failed",
    outcome: "baseline" | "no_change" | "changed" | "failed" | null,
    error: string | null,
    timestampSql: string,
  ): Promise<TrackerRun> {
    const result = await this.database.query<RunRow>(
      `UPDATE tracker_runs SET status = $2, outcome = $3, error = $4, ${timestampSql}
       WHERE id = $1 RETURNING ${runColumns}`,
      [id, status, outcome, error],
    );
    if (!result.rows[0]) throw new Error(`Tracker run ${id} not found`);
    return mapRun(result.rows[0]);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
