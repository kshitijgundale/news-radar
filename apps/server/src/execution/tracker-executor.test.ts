import assert from "node:assert/strict";
import test from "node:test";

import type { SituationState, Tracker, TrackerRun } from "@radar/contracts";

import { TrackerExecutionService, scheduledIdempotencyKey, type TrackerExecutionDependencies } from "./tracker-executor.js";

const trackerId = "00000000-0000-4000-8000-000000000010";
const runId = "00000000-0000-4000-8000-000000000011";
const evidenceId = "00000000-0000-4000-8000-000000000012";
const state = {
  summary: "The situation is unresolved.",
  facts: [{ id: "status", text: "No resolution is confirmed.", status: "uncertain" as const, evidenceIds: [evidenceId] }],
};
const tracker: Tracker = {
  id: trackerId, query: "Track the situation", title: null, summary: null, currentState: null,
  status: "active", createdAt: "2026-08-24T10:00:00.000Z", updatedAt: "2026-08-24T10:00:00.000Z",
  lastCheckedAt: null, lastChangedAt: null, nextCheckAt: "2026-08-24T11:00:00.000Z",
  pollIntervalMinutes: 60,
};
const pendingRun: TrackerRun = {
  id: runId, trackerId, status: "pending", outcome: null,
  startedAt: null, completedAt: null, error: null,
};
const runningRun: TrackerRun = { ...pendingRun, status: "running", startedAt: "2026-08-24T12:00:00.000Z" };
const succeededRun: TrackerRun = {
  ...runningRun, status: "succeeded", outcome: "baseline", completedAt: "2026-08-24T12:01:00.000Z",
};

function dependencies(overrides: Partial<TrackerExecutionDependencies> = {}): TrackerExecutionDependencies {
  return {
    trackers: { async findById() { return tracker; } },
    runs: {
      async acquire() { return { run: pendingRun, acquired: true }; },
      async markRunning() { return runningRun; },
      async setAttempt() {},
      async findLatest() { return succeededRun; },
      async markFailed(_id, error) { return { ...runningRun, status: "failed", outcome: "failed", completedAt: "2026-08-24T12:01:00.000Z", error }; },
    },
    states: { async findCurrent() { return null; } },
    timeline: { async findLatestSummary() { return null; } },
    discovery: { async discover() { return {
      discovered: 1,
      evidence: [{ id: evidenceId, canonicalUrl: "https://example.com", title: "Report", publisher: null,
        publishedAt: null, retrievedAt: "2026-08-24T12:00:00.000Z", contentHash: "a".repeat(64),
        extractedContent: "Report text", fetchStatus: "fetched" as const }],
      evaluationEvidence: [{ evidenceId, title: "Report", publisher: null, publishedAt: null,
        url: "https://example.com", content: "Report text", confirmationEligible: true }],
    }; } },
    evaluator: {
      async establishInitialState() { return { title: "Situation", state }; },
      async evaluateUpdate(input) { return { meaningfulUpdate: false, reason: "No change", state: input.existingState, timelinePoints: [] }; },
    },
    persistence: {
      async persistBaseline() { return { stateVersionId: runId, version: 1, timelinePointIds: [] }; },
      async persistMeaningfulUpdate() { return { stateVersionId: runId, version: 2, timelinePointIds: [] }; },
      async persistNoChange() {},
    },
    wait: async () => undefined,
    ...overrides,
  };
}

test("executes initial discovery through baseline persistence", async () => {
  let baselines = 0;
  const deps = dependencies({
    persistence: {
      async persistBaseline() { baselines += 1; return { stateVersionId: runId, version: 1, timelinePointIds: [] }; },
      async persistMeaningfulUpdate() { throw new Error("unexpected"); },
      async persistNoChange() { throw new Error("unexpected"); },
    },
  });
  const result = await new TrackerExecutionService(deps).execute(trackerId, "initial");
  assert.equal(result.outcome, "baseline");
  assert.equal(baselines, 1);
});

test("evaluates only new evidence against the complete current state", async () => {
  let receivedState: SituationState | undefined;
  let receivedEvidenceIds: string[] = [];
  const deps = dependencies({
    states: { async findCurrent() { return { id: runId, trackerId, runId, version: 1, summary: state.summary, state, createdAt: tracker.createdAt }; } },
    discovery: { async discover() { return {
      discovered: 2,
      evidence: [],
      evaluationEvidence: [{ evidenceId, title: "Updated report", publisher: null, publishedAt: null,
        url: "https://example.com/updated", content: "New material detail", confirmationEligible: true }],
    }; } },
    evaluator: {
      async establishInitialState() { throw new Error("unexpected"); },
      async evaluateUpdate(input) {
        receivedState = input.existingState;
        receivedEvidenceIds = input.evidence.map((item) => item.evidenceId);
        return { meaningfulUpdate: false, reason: "No change", state: input.existingState, timelinePoints: [] };
      },
    },
  });

  await new TrackerExecutionService(deps).execute(trackerId, "recurring");
  assert.deepEqual(receivedState, state);
  assert.deepEqual(receivedEvidenceIds, [evidenceId]);
});

test("returns an existing run for duplicate or concurrent triggers", async () => {
  let markedRunning = false;
  const existing = { ...runningRun, id: "00000000-0000-4000-8000-000000000099" };
  const deps = dependencies({
    runs: {
      ...dependencies().runs,
      async acquire() { return { run: existing, acquired: false }; },
      async markRunning() { markedRunning = true; return runningRun; },
    },
  });

  const result = await new TrackerExecutionService(deps).execute(trackerId, "duplicate");
  assert.equal(result.id, existing.id);
  assert.equal(markedRunning, false);
});

test("retries a transient discovery failure without acquiring another run", async () => {
  let discoveries = 0;
  let acquisitions = 0;
  const deps = dependencies({
    runs: {
      ...dependencies().runs,
      async acquire() { acquisitions += 1; return { run: pendingRun, acquired: true }; },
    },
    discovery: {
      async discover() {
        discoveries += 1;
        if (discoveries === 1) throw Object.assign(new Error("provider unavailable"), { status: 503 });
        return dependencies().discovery.discover({ trackerId, runId, context: {} as never });
      },
    },
  });
  await new TrackerExecutionService(deps).execute(trackerId, "retry");
  assert.equal(acquisitions, 1);
  assert.equal(discoveries, 2);
});

test("marks a run failed after bounded retries are exhausted", async () => {
  let discoveries = 0;
  let attempts = 0;
  let failed = 0;
  const deps = dependencies({
    maxAttempts: 2,
    runs: {
      ...dependencies().runs,
      async setAttempt(_id, attempt) { attempts = attempt; },
      async markFailed(_id, error) {
        failed += 1;
        return { ...runningRun, status: "failed", outcome: "failed", completedAt: tracker.updatedAt, error };
      },
    },
    discovery: { async discover() {
      discoveries += 1;
      throw Object.assign(new Error("provider unavailable"), { status: 503 });
    } },
  });

  await assert.rejects(new TrackerExecutionService(deps).execute(trackerId, "retry-exhausted"), /failed/);
  assert.equal(discoveries, 2);
  assert.equal(attempts, 2);
  assert.equal(failed, 1);
});

test("uses stable scheduling-window idempotency keys", () => {
  const first = scheduledIdempotencyKey(tracker, new Date("2026-08-24T12:00:00.000Z"));
  const duplicate = scheduledIdempotencyKey(tracker, new Date("2026-08-24T12:59:59.000Z"));
  const next = scheduledIdempotencyKey(tracker, new Date("2026-08-24T13:00:00.000Z"));
  assert.equal(first, duplicate);
  assert.notEqual(first, next);
});
