import type { SituationState } from "@radar/contracts";

import { mapStateVersion, type StateVersionRow } from "../db/rows.js";
import type { Queryable } from "../db/types.js";

export interface StateVersion {
  id: string;
  trackerId: string;
  runId: string;
  version: number;
  summary: string;
  state: SituationState;
  createdAt: string;
}

export class StateRepository {
  public constructor(private readonly database: Queryable) {}

  async listHistory(trackerId: string): Promise<StateVersion[]> {
    const result = await this.database.query<StateVersionRow>(
      `SELECT id, tracker_id, run_id, version, summary, state, created_at
       FROM state_versions WHERE tracker_id = $1 ORDER BY version ASC`,
      [trackerId],
    );
    return result.rows.map(mapStateVersion);
  }

  async findCurrent(trackerId: string): Promise<StateVersion | null> {
    const result = await this.database.query<StateVersionRow>(
      `SELECT id, tracker_id, run_id, version, summary, state, created_at
       FROM state_versions WHERE tracker_id = $1 ORDER BY version DESC LIMIT 1`,
      [trackerId],
    );
    return result.rows[0] ? mapStateVersion(result.rows[0]) : null;
  }
}
