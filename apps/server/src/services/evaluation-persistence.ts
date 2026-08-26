import {
  initialStateOutputSchema,
  situationStateSchema,
  updateDecisionSchema,
  type SituationState,
  type UpdateDecision,
} from "@radar/contracts";
import type { InitialStateOutput } from "@radar/contracts";

import { withTransaction } from "../db/transaction.js";
import type { PoolLike, Queryable } from "../db/types.js";
import { EvidenceRepository } from "../repositories/evidence-repository.js";

interface PersistedChange {
  stateVersionId: string;
  version: number;
  timelinePointIds: string[];
}

interface IdRow {
  id: string;
}

interface VersionRow extends IdRow {
  version: number;
}

export class EvaluationPersistence {
  public constructor(private readonly database: PoolLike) {}

  async persistBaseline(input: {
    trackerId: string;
    runId: string;
    output: InitialStateOutput;
    processedEvidenceIds: string[];
    nextCheckAt: Date;
  }): Promise<PersistedChange> {
    const output = initialStateOutputSchema.parse(input.output);
    return withTransaction(this.database, async (client) => {
      await this.lockTracker(client, input.trackerId);
      await this.assertRunBelongsToTracker(client, input.runId, input.trackerId);
      const citedEvidenceIds = [...new Set(output.state.facts.flatMap((fact) => fact.evidenceIds))];
      await this.assertEvidenceLinked(client, input.trackerId, citedEvidenceIds);
      await this.markEvidenceProcessed(client, input.trackerId, input.runId, input.processedEvidenceIds);

      const stateVersion = await client.query<VersionRow>(
        `INSERT INTO state_versions (tracker_id, run_id, version, summary, state)
         SELECT $1, $2, 1, $3, $4::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM state_versions WHERE tracker_id = $1)
         RETURNING id, version`,
        [input.trackerId, input.runId, output.state.summary, JSON.stringify(output.state)],
      );
      if (!stateVersion.rows[0]) throw new Error("Tracker baseline already exists");
      const inserted = stateVersion.rows[0];
      await new EvidenceRepository(client).linkToStateVersion(inserted.id, citedEvidenceIds);

      await client.query(
        `UPDATE trackers SET title = $2, summary = $3, current_state = $4::jsonb,
           last_checked_at = now(), last_changed_at = now(), next_check_at = $5,
           updated_at = now(), status = 'active' WHERE id = $1`,
        [input.trackerId, output.title, output.state.summary, JSON.stringify(output.state), input.nextCheckAt],
      );
      await client.query(
        `UPDATE tracker_runs SET status = 'succeeded', outcome = 'baseline',
           completed_at = now(), error = NULL WHERE id = $1`,
        [input.runId],
      );
      return { stateVersionId: inserted.id, version: inserted.version, timelinePointIds: [] };
    });
  }

  async persistNoChange(input: {
    trackerId: string;
    runId: string;
    existingState: SituationState;
    decision: UpdateDecision;
    processedEvidenceIds: string[];
    nextCheckAt: Date;
  }): Promise<void> {
    const existingState = situationStateSchema.parse(input.existingState);
    const decision = updateDecisionSchema.parse(input.decision);

    if (decision.meaningfulUpdate) throw new Error("Expected a no-change decision");
    if (JSON.stringify(decision.state) !== JSON.stringify(existingState)) {
      throw new Error("A no-change decision must preserve the existing state exactly");
    }

    await withTransaction(this.database, async (client) => {
      await this.assertRunBelongsToTracker(client, input.runId, input.trackerId);
      await this.markEvidenceProcessed(client, input.trackerId, input.runId, input.processedEvidenceIds);
      await client.query(
        `UPDATE trackers SET
           last_checked_at = now(), next_check_at = $2, updated_at = now()
         WHERE id = $1`,
        [input.trackerId, input.nextCheckAt],
      );
      await client.query(
        `UPDATE tracker_runs SET
           status = 'succeeded', outcome = 'no_change', completed_at = now(), error = NULL
         WHERE id = $1`,
        [input.runId],
      );
    });
  }

  async persistMeaningfulUpdate(input: {
    trackerId: string;
    runId: string;
    decision: UpdateDecision;
    processedEvidenceIds: string[];
    nextCheckAt: Date;
  }): Promise<PersistedChange> {
    const decision = updateDecisionSchema.parse(input.decision);
    if (!decision.meaningfulUpdate) throw new Error("Expected a meaningful update decision");

    return withTransaction(this.database, async (client) => {
      await this.lockTracker(client, input.trackerId);
      await this.assertRunBelongsToTracker(client, input.runId, input.trackerId);

      const citedEvidenceIds = new Set([
        ...decision.state.facts.flatMap((fact) => fact.evidenceIds),
        ...decision.timelinePoints.flatMap((point) => point.evidenceIds),
      ]);
      await this.assertEvidenceLinked(client, input.trackerId, [...citedEvidenceIds]);
      await this.markEvidenceProcessed(client, input.trackerId, input.runId, input.processedEvidenceIds);

      const stateVersion = await client.query<VersionRow>(
        `INSERT INTO state_versions (tracker_id, run_id, version, summary, state)
         SELECT $1, $2, COALESCE(MAX(version), 0) + 1, $3, $4::jsonb
         FROM state_versions WHERE tracker_id = $1
         RETURNING id, version`,
        [input.trackerId, input.runId, decision.state.summary, JSON.stringify(decision.state)],
      );
      const insertedVersion = stateVersion.rows[0]!;
      const evidence = new EvidenceRepository(client);
      await evidence.linkToStateVersion(insertedVersion.id, [
        ...new Set(decision.state.facts.flatMap((fact) => fact.evidenceIds)),
      ]);

      const timelinePointIds: string[] = [];
      for (const point of decision.timelinePoints) {
        const result = await client.query<IdRow>(
          `INSERT INTO timeline_points (
             tracker_id, state_version_id, headline, detail, detected_at, occurred_at
           ) VALUES ($1, $2, $3, $4, now(), $5)
           RETURNING id`,
          [input.trackerId, insertedVersion.id, point.headline, point.detail, point.occurredAt],
        );
        const timelinePointId = result.rows[0]!.id;
        timelinePointIds.push(timelinePointId);
        await evidence.linkToTimelinePoint(timelinePointId, point.evidenceIds);
      }

      await client.query(
        `UPDATE trackers SET
           summary = $2, current_state = $3::jsonb, last_checked_at = now(),
           last_changed_at = now(), next_check_at = $4, updated_at = now(), status = 'active'
         WHERE id = $1`,
        [input.trackerId, decision.state.summary, JSON.stringify(decision.state), input.nextCheckAt],
      );
      await client.query(
        `UPDATE tracker_runs SET
           status = 'succeeded', outcome = 'changed', completed_at = now(), error = NULL
         WHERE id = $1`,
        [input.runId],
      );

      return { stateVersionId: insertedVersion.id, version: insertedVersion.version, timelinePointIds };
    });
  }

  private async lockTracker(client: Queryable, trackerId: string): Promise<void> {
    const result = await client.query<IdRow>("SELECT id FROM trackers WHERE id = $1 FOR UPDATE", [trackerId]);
    if (!result.rows[0]) throw new Error(`Tracker ${trackerId} not found`);
  }

  private async assertRunBelongsToTracker(
    client: Queryable,
    runId: string,
    trackerId: string,
  ): Promise<void> {
    const result = await client.query<IdRow>(
      "SELECT id FROM tracker_runs WHERE id = $1 AND tracker_id = $2 FOR UPDATE",
      [runId, trackerId],
    );
    if (!result.rows[0]) throw new Error(`Run ${runId} does not belong to tracker ${trackerId}`);
  }

  private async assertEvidenceLinked(
    client: Queryable,
    trackerId: string,
    evidenceIds: string[],
  ): Promise<void> {
    const result = await client.query<IdRow>(
      `SELECT evidence_id AS id FROM tracker_evidence
       WHERE tracker_id = $1 AND evidence_id = ANY($2::uuid[])`,
      [trackerId, evidenceIds],
    );
    const linked = new Set(result.rows.map((row) => row.id));
    const missing = evidenceIds.filter((id) => !linked.has(id));
    if (missing.length > 0) throw new Error(`Evidence is not linked to tracker: ${missing.join(", ")}`);
  }

  private async markEvidenceProcessed(
    client: Queryable,
    trackerId: string,
    runId: string,
    evidenceIds: string[],
  ): Promise<void> {
    if (evidenceIds.length === 0) return;
    await client.query(
      `UPDATE tracker_evidence SET
         processing_status = 'processed', last_seen_run_id = $2, last_seen_at = now()
       WHERE tracker_id = $1 AND evidence_id = ANY($3::uuid[])`,
      [trackerId, runId, [...new Set(evidenceIds)]],
    );
  }
}
