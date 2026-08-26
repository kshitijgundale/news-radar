import assert from "node:assert/strict";
import test from "node:test";

import type { Evidence, SituationState, Tracker, TrackerRun } from "@radar/contracts";

import { TrackerExecutionService, type TrackerExecutionDependencies } from "./tracker-executor.js";

const ids = {
  tracker: "10000000-0000-4000-8000-000000000001",
  baseline: "10000000-0000-4000-8000-000000000002",
  repeated: "10000000-0000-4000-8000-000000000003",
  edited: "10000000-0000-4000-8000-000000000004",
  changed: "10000000-0000-4000-8000-000000000005",
  evidence: "10000000-0000-4000-8000-000000000006",
};

const baseline: SituationState = {
  summary: "The transit strike is scheduled for Friday.",
  facts: [{ id: "strike-date", text: "The strike is scheduled for Friday.", status: "confirmed", evidenceIds: [ids.evidence] }],
};
const resolved: SituationState = {
  summary: "The transit strike was cancelled after an agreement.",
  facts: [{ id: "strike-date", text: "The Friday strike was cancelled after an agreement.", status: "confirmed", evidenceIds: [ids.evidence] }],
};

test("fixture sequence covers baseline, repeated evidence, edited source, and material change", async () => {
  const fixtures: Array<{ kind: "baseline" | "repeated" | "edited" | "changed"; content: string }> = [
    { kind: "baseline", content: "Workers schedule a Friday strike." },
    { kind: "repeated", content: "Workers schedule a Friday strike." },
    { kind: "edited", content: "Updated: talks continue; the Friday strike remains scheduled." },
    { kind: "changed", content: "Union and operator agree; Friday strike cancelled." },
  ];
  let fixture = 0;
  let current: SituationState | null = null;
  const outcomes: TrackerRun["outcome"][] = [];
  const timeline: string[] = [];
  const tracker: Tracker = {
    id: ids.tracker, query: "Track the city transit strike", title: null, summary: null,
    currentState: null, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    lastCheckedAt: null, lastChangedAt: null, nextCheckAt: null,
    pollIntervalMinutes: 60,
  };

  const dependencies: TrackerExecutionDependencies = {
    trackers: { async findById() { return tracker; } },
    runs: {
      async acquire() {
        const id = [ids.baseline, ids.repeated, ids.edited, ids.changed][fixture]!;
        return { run: run(id, "pending", null), acquired: true };
      },
      async markRunning(id) { return run(id, "running", null); },
      async setAttempt() {},
      async findLatest() {
        const outcome = outcomes.at(-1)!;
        return run([ids.baseline, ids.repeated, ids.edited, ids.changed][fixture - 1]!, "succeeded", outcome);
      },
      async markFailed(id, error) { return { ...run(id, "failed", "failed"), error }; },
    },
    states: { async findCurrent() {
      return current ? { id: ids.baseline, trackerId: ids.tracker, runId: ids.baseline, version: outcomes.length, summary: current.summary, state: current, createdAt: tracker.createdAt } : null;
    } },
    timeline: { async findLatestSummary() { return timeline.at(-1) ?? null; } },
    discovery: { async discover() {
      const item = fixtures[fixture++]!;
      const evidence: Evidence = { id: ids.evidence, canonicalUrl: "https://news.example/strike", title: item.kind,
        publisher: "Fixture News", publishedAt: null, retrievedAt: new Date().toISOString(),
        contentHash: item.kind === "repeated" ? "a".repeat(64) : item.kind === "baseline" ? "a".repeat(64) : item.kind === "edited" ? "b".repeat(64) : "c".repeat(64),
        extractedContent: item.content, fetchStatus: "fetched" };
      return { discovered: 1, evidence: [evidence], evaluationEvidence: item.kind === "repeated" ? [] : [{ evidenceId: evidence.id, title: evidence.title, publisher: evidence.publisher, publishedAt: null, url: evidence.canonicalUrl, content: item.content, confirmationEligible: true }] };
    } },
    evaluator: {
      async establishInitialState() { return { title: "City transit strike", state: baseline }; },
      async evaluateUpdate(input) {
        const changed = input.evidence[0]?.content.includes("cancelled") ?? false;
        return changed ? { meaningfulUpdate: true, reason: "The strike was cancelled.", state: resolved,
          timelinePoints: [{ headline: "Strike cancelled", detail: "An agreement cancelled the planned strike.", occurredAt: null, evidenceIds: [ids.evidence] }] }
          : { meaningfulUpdate: false, reason: input.evidence.length ? "The edit adds no material change." : "Evidence is unchanged.", state: input.existingState, timelinePoints: [] };
      },
    },
    persistence: {
      async persistBaseline(input) { current = input.output.state; outcomes.push("baseline"); return { stateVersionId: ids.baseline, version: 1, timelinePointIds: [] }; },
      async persistNoChange() { outcomes.push("no_change"); },
      async persistMeaningfulUpdate(input) { current = input.decision.state; outcomes.push("changed"); timeline.push(input.decision.timelinePoints[0]!.headline); return { stateVersionId: ids.changed, version: 2, timelinePointIds: [ids.changed] }; },
    },
  };

  const service = new TrackerExecutionService(dependencies);
  for (const key of ["baseline", "repeated", "edited", "changed"]) await service.execute(ids.tracker, key);

  assert.deepEqual(outcomes, ["baseline", "no_change", "no_change", "changed"]);
  assert.deepEqual(current, resolved);
  assert.deepEqual(timeline, ["Strike cancelled"]);
});

function run(id: string, status: TrackerRun["status"], outcome: TrackerRun["outcome"]): TrackerRun {
  return { id, trackerId: ids.tracker, status, outcome, startedAt: status === "pending" ? null : new Date().toISOString(), completedAt: status === "succeeded" || status === "failed" ? new Date().toISOString() : null, error: null };
}
