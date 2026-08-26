import type { Tracker, TrackerRun } from "@radar/contracts";

import type { EvidenceDiscoveryService } from "../evidence/evidence-discovery.js";
import { buildSearchContext } from "../evidence/search-context.js";
import type { StateEvaluator } from "../evaluation/state-evaluator.js";
import type { RunRepository } from "../repositories/run-repository.js";
import type { StateRepository } from "../repositories/state-repository.js";
import type { TimelineRepository } from "../repositories/timeline-repository.js";
import type { TrackerRepository } from "../repositories/tracker-repository.js";
import type { EvaluationPersistence } from "../services/evaluation-persistence.js";

export interface TrackerExecutor {
  execute(trackerId: string, idempotencyKey: string): Promise<TrackerRun>;
}

export interface TrackerExecutionDependencies {
  trackers: Pick<TrackerRepository, "findById">;
  runs: Pick<RunRepository, "acquire" | "markRunning" | "setAttempt" | "findLatest" | "markFailed">;
  states: Pick<StateRepository, "findCurrent">;
  timeline: Pick<TimelineRepository, "findLatestSummary">;
  discovery: Pick<EvidenceDiscoveryService, "discover">;
  evaluator: Pick<StateEvaluator, "establishInitialState" | "evaluateUpdate">;
  persistence: Pick<EvaluationPersistence, "persistBaseline" | "persistMeaningfulUpdate" | "persistNoChange">;
  maxAttempts?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

export class TrackerExecutionService implements TrackerExecutor {
  public constructor(private readonly dependencies: TrackerExecutionDependencies) {}

  async execute(trackerId: string, idempotencyKey: string): Promise<TrackerRun> {
    const acquisition = await this.dependencies.runs.acquire(trackerId, idempotencyKey);
    if (!acquisition.acquired) return acquisition.run;

    let run = await this.dependencies.runs.markRunning(acquisition.run.id);
    const maxAttempts = this.dependencies.maxAttempts ?? 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.dependencies.runs.setAttempt(run.id, attempt);
        await this.process(trackerId, run.id);
        return (await this.dependencies.runs.findLatest(trackerId)) ?? run;
      } catch (error) {
        if (attempt < maxAttempts && isRetryableExecutionError(error)) {
          await (this.dependencies.wait ?? defaultWait)(250 * 2 ** (attempt - 1));
          continue;
        }
        run = await this.dependencies.runs.markFailed(run.id, formatError(error));
        throw new TrackerExecutionError(run, error);
      }
    }
    return run;
  }

  private async process(trackerId: string, runId: string): Promise<void> {
    const tracker = await this.dependencies.trackers.findById(trackerId);
    if (!tracker) throw new Error(`Tracker ${trackerId} not found`);
    if (tracker.status === "paused") throw new Error(`Tracker ${trackerId} is paused`);
    const current = await this.dependencies.states.findCurrent(trackerId);
    const latestChange = await this.dependencies.timeline.findLatestSummary(trackerId);
    const context = buildSearchContext({
      trackerQuery: tracker.query,
      currentState: current?.state ?? null,
      latestMeaningfulChange: latestChange,
      lastCheckedAt: tracker.lastCheckedAt,
    });
    const discovery = await this.dependencies.discovery.discover({ trackerId, runId, context });
    const processedEvidenceIds = discovery.evidence.map((item) => item.id);
    const nextCheckAt = nextCheck(tracker.pollIntervalMinutes);

    if (!current) {
      const output = await this.dependencies.evaluator.establishInitialState({
        trackerQuery: tracker.query,
        evidence: discovery.evaluationEvidence,
      });
      await this.dependencies.persistence.persistBaseline({
        trackerId, runId, output, processedEvidenceIds, nextCheckAt,
      });
      return;
    }

    const decision = await this.dependencies.evaluator.evaluateUpdate({
      trackerQuery: tracker.query,
      existingState: current.state,
      evidence: discovery.evaluationEvidence,
    });
    if (decision.meaningfulUpdate) {
      await this.dependencies.persistence.persistMeaningfulUpdate({
        trackerId, runId, decision, processedEvidenceIds, nextCheckAt,
      });
    } else {
      await this.dependencies.persistence.persistNoChange({
        trackerId, runId, existingState: current.state, decision,
        processedEvidenceIds, nextCheckAt,
      });
    }
  }
}

export class TrackerExecutionError extends Error {
  public constructor(public readonly run: TrackerRun, cause: unknown) {
    super(`Tracker run ${run.id} failed`, { cause });
  }
}

export function scheduledIdempotencyKey(
  tracker: Pick<Tracker, "id">,
  now = new Date(),
  windowMinutes = 60,
): string {
  if (!Number.isInteger(windowMinutes) || windowMinutes < 1) {
    throw new Error("Scheduling window must be a positive whole number of minutes");
  }
  const window = Math.floor(now.getTime() / (windowMinutes * 60_000));
  return `scheduled:${tracker.id}:${windowMinutes}:${window}`;
}

function nextCheck(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function isRetryableExecutionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = "status" in error && typeof error.status === "number" ? error.status : null;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return status === 429 || (status !== null && status >= 500) ||
    ["40001", "40P01", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(code);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function defaultWait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
