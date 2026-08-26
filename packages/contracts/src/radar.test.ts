import assert from "node:assert/strict";
import test from "node:test";

import { situationStateSchema, updateDecisionSchema } from "./radar.js";

const evidenceId = "00000000-0000-4000-8000-000000000001";
const state = {
  summary: "The situation remains unresolved.",
  facts: [
    {
      id: "current-status",
      text: "No confirmed resolution has been reported.",
      status: "uncertain" as const,
      evidenceIds: [evidenceId],
    },
  ],
};

test("accepts a bounded state with unique semantic fact IDs", () => {
  assert.equal(situationStateSchema.parse(state).facts.length, 1);
});

test("rejects duplicate semantic fact IDs", () => {
  const result = situationStateSchema.safeParse({ ...state, facts: [state.facts[0], state.facts[0]] });
  assert.equal(result.success, false);
});

test("rejects timeline points on a no-change decision", () => {
  const result = updateDecisionSchema.safeParse({
    meaningfulUpdate: false,
    reason: "Only repeated evidence was found.",
    state,
    timelinePoints: [
      { headline: "Repeated", detail: "No change", occurredAt: null, evidenceIds: [evidenceId] },
    ],
  });

  assert.equal(result.success, false);
});
