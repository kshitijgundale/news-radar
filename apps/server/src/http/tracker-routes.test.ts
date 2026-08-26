import assert from "node:assert/strict";
import test from "node:test";

import type { Evidence, Tracker, TrackerRun } from "@radar/contracts";
import { Hono } from "hono";

import { createTrackerRoutes, type TrackerRouteDependencies } from "./tracker-routes.js";

const trackerId = "00000000-0000-4000-8000-000000000101";
const runId = "00000000-0000-4000-8000-000000000102";
const evidenceId = "00000000-0000-4000-8000-000000000103";
const now = "2026-08-24T12:00:00.000Z";

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: trackerId,
    query: "Track the coastal storm response",
    title: null,
    summary: null,
    currentState: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
    lastChangedAt: null,
    nextCheckAt: now,
    pollIntervalMinutes: 60,
    ...overrides,
  };
}

function run(outcome: TrackerRun["outcome"], status: TrackerRun["status"] = "succeeded"): TrackerRun {
  return {
    id: runId,
    trackerId,
    status,
    outcome,
    startedAt: now,
    completedAt: status === "running" ? null : now,
    error: status === "failed" ? "provider unavailable" : null,
  };
}

function testApp(overrides: Partial<TrackerRouteDependencies> = {}) {
  let current = tracker();
  let latestRun: TrackerRun | null = null;
  const dependencies: TrackerRouteDependencies = {
    trackers: {
      async create(query, pollIntervalMinutes) { current = tracker({ query, pollIntervalMinutes }); return current; },
      async findById(id) { return id === trackerId ? current : null; },
      async list() { return [current]; },
      async delete(id) { return id === trackerId; },
      async setStatus(id, status) {
        if (id !== trackerId) return null;
        current = { ...current, status };
        return current;
      },
      async setPollInterval(id, pollIntervalMinutes) {
        if (id !== trackerId) return null;
        current = { ...current, pollIntervalMinutes };
        return current;
      },
    },
    runs: {
      async findLatest() { return latestRun; },
      async findLatestForTrackers() { return latestRun ? new Map([[trackerId, latestRun]]) : new Map(); },
    },
    timeline: { async listForTracker() { return []; } },
    evidence: { async listForTracker() { return []; } },
    executor: {
      async execute() {
        latestRun = run(current.currentState ? "no_change" : "baseline");
        return latestRun;
      },
    },
    ...overrides,
  };
  return {
    app: new Hono().route("/api/trackers", createTrackerRoutes(dependencies)),
    setTracker(value: Tracker) { current = value; },
    setRun(value: TrackerRun) { latestRun = value; },
  };
}

test("validates creation and persists the baseline before responding", async () => {
  const harness = testApp();
  const invalid = await harness.app.request("/api/trackers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "   ", pollIntervalMinutes: 60 }),
  });
  assert.equal(invalid.status, 400);

  const response = await harness.app.request("/api/trackers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "  Track the coastal storm response  ", pollIntervalMinutes: 360 }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as { tracker: Tracker; run: TrackerRun };
  assert.equal(body.tracker.query, "Track the coastal storm response");
  assert.equal(body.tracker.pollIntervalMinutes, 360);
  assert.equal(body.run.outcome, "baseline");
  const list = await (await harness.app.request("/api/trackers")).json() as { trackers: Array<{ latestRun: TrackerRun }> };
  assert.equal(list.trackers[0]?.latestRun.outcome, "baseline");
});

test("returns detail with state, timeline, evidence, and latest run", async () => {
  const state = { summary: "Response is under way.", facts: [{ id: "response", text: "Crews are deployed.", status: "confirmed" as const, evidenceIds: [evidenceId] }] };
  const evidence: Evidence = { id: evidenceId, canonicalUrl: "https://example.com/report", title: "Report", publisher: "Example", publishedAt: now, retrievedAt: now, contentHash: "a".repeat(64), extractedContent: "Crews are deployed.", fetchStatus: "fetched" };
  const harness = testApp({
    timeline: { async listForTracker() { return [{ id: runId, trackerId, stateVersionId: runId, headline: "Crews deployed", detail: "Response crews deployed.", detectedAt: now, occurredAt: now, evidenceIds: [evidenceId] }]; } },
    evidence: { async listForTracker() { return [evidence]; } },
  });
  harness.setTracker(tracker({ title: "Coastal storm", summary: state.summary, currentState: state, lastCheckedAt: now, lastChangedAt: now }));
  harness.setRun(run("changed"));

  const response = await harness.app.request(`/api/trackers/${trackerId}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { tracker: { timeline: unknown[]; evidence: unknown[]; latestRun: TrackerRun } };
  assert.equal(body.tracker.timeline.length, 1);
  assert.equal(body.tracker.evidence.length, 1);
  assert.equal(body.tracker.latestRun.outcome, "changed");
});

test("exposes no-change, changed, and failed run outcomes in tracker lists", async () => {
  const harness = testApp();
  for (const outcome of ["no_change", "changed", "failed"] as const) {
    harness.setRun(run(outcome, outcome === "failed" ? "failed" : "succeeded"));
    const body = await (await harness.app.request("/api/trackers")).json() as { trackers: Array<{ latestRun: TrackerRun }> };
    assert.equal(body.trackers[0]?.latestRun.outcome, outcome);
  }
});

test("pauses, reactivates, and manually checks a tracker without deleting detail", async () => {
  const harness = testApp();
  assert.equal((await harness.app.request(`/api/trackers/${trackerId}/pause`, { method: "POST" })).status, 200);
  assert.equal((await harness.app.request(`/api/trackers/${trackerId}/check`, { method: "POST" })).status, 409);
  assert.equal((await harness.app.request(`/api/trackers/${trackerId}/reactivate`, { method: "POST" })).status, 200);
  assert.equal((await harness.app.request(`/api/trackers/${trackerId}/check`, { method: "POST" })).status, 202);
  assert.equal((await harness.app.request(`/api/trackers/${trackerId}`)).status, 200);
});

test("updates a tracker's check frequency", async () => {
  const harness = testApp();
  const response = await harness.app.request(`/api/trackers/${trackerId}/schedule`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pollIntervalMinutes: 1_440 }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { tracker: Tracker };
  assert.equal(body.tracker.pollIntervalMinutes, 1_440);
});

test("deletes an existing tracker and returns not found for an unknown tracker", async () => {
  const harness = testApp();
  const deleted = await harness.app.request(`/api/trackers/${trackerId}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true });

  const missing = await harness.app.request("/api/trackers/00000000-0000-4000-8000-000000000999", { method: "DELETE" });
  assert.equal(missing.status, 404);
});
