import assert from "node:assert/strict";
import test from "node:test";

import type { InitialStateOutput, UpdateDecision } from "@radar/contracts";

import type { EvaluationEvidence } from "../evidence/evidence-ingestion.js";
import type { StateEvaluationProvider } from "./provider.js";
import { initialStateInstructions, updateInstructions } from "./prompts.js";
import { StateEvaluator, validateUpdateOutput } from "./state-evaluator.js";
import { hasMaterialStateDifference } from "./state-comparison.js";

const oldId = "00000000-0000-4000-8000-000000000001";
const newId = "00000000-0000-4000-8000-000000000002";
const limitedId = "00000000-0000-4000-8000-000000000003";
const evidence: EvaluationEvidence[] = [
  { evidenceId: newId, title: "Official update", publisher: "Authority", publishedAt: null,
    url: "https://example.com/update", content: "The count is now 22.", confirmationEligible: true },
  { evidenceId: limitedId, title: "Search snippet", publisher: null, publishedAt: null,
    url: "https://example.com/limited", content: "A snippet claim", confirmationEligible: false },
];
const existingState = {
  summary: "15 people are involved.",
  facts: [{ id: "count", text: "15 people are involved.", status: "reported" as const, evidenceIds: [oldId] }],
};

function changedDecision(status: "confirmed" | "reported" = "confirmed"): UpdateDecision {
  return {
    meaningfulUpdate: true,
    reason: "The count was corrected.",
    state: { summary: "22 people are involved.", facts: [
      { id: "count", text: "22 people are involved.", status, evidenceIds: [newId] },
    ] },
    timelinePoints: [{ headline: "Count clarified as 22", detail: "New evidence corrected 15 to 22.", occurredAt: null, evidenceIds: [newId] }],
  };
}

test("prompts enforce tracker relevance and new-information semantics", () => {
  assert.match(initialStateInstructions, /permanent relevance boundary/);
  assert.match(initialStateInstructions, /1-8/);
  assert.match(updateInstructions, /new source from new information/);
  assert.match(updateInstructions, /reproduce the existing state\s+exactly/);
});

test("accepts corrections and uncertainty resolution with new strong evidence", () => {
  assert.equal(validateUpdateOutput(changedDecision(), { trackerQuery: "Track it", existingState, evidence }).meaningfulUpdate, true);
});

test("rejects repeated evidence presented as a meaningful update", () => {
  const repeated = changedDecision();
  repeated.state = existingState;
  assert.throws(() => validateUpdateOutput(repeated, { trackerQuery: "Track it", existingState, evidence }), /does not materially change/);
});

test("rejects confirmation based only on a limited snippet", () => {
  const decision = changedDecision();
  decision.state.facts[0]!.evidenceIds = [limitedId];
  decision.timelinePoints[0]!.evidenceIds = [limitedId];
  assert.throws(() => validateUpdateOutput(decision, { trackerQuery: "Track it", existingState, evidence }), /limited evidence/);
});

test("normalization ignores case, punctuation, whitespace, and fact ordering", () => {
  const reordered = {
    summary: "Different presentation",
    facts: [{ ...existingState.facts[0]!, text: " 15 PEOPLE are involved! " }],
  };
  assert.equal(hasMaterialStateDifference(existingState, reordered), false);
});

test("performs exactly one repair attempt after invalid output", async () => {
  let attempts = 0;
  const valid: InitialStateOutput = {
    title: "Situation",
    state: { summary: "Current status.", facts: [
      { id: "status", text: "A material fact.", status: "reported", evidenceIds: [newId] },
    ] },
  };
  const provider: StateEvaluationProvider = {
    async generateInitial(_input, feedback) {
      attempts += 1;
      if (!feedback) return { ...valid, state: { ...valid.state, facts: [] } };
      return valid;
    },
    async generateUpdate() { return changedDecision(); },
  };
  const result = await new StateEvaluator(provider).establishInitialState({
    trackerQuery: "Track it",
    evidence: [evidence[0]!],
  });
  assert.equal(result.title, "Situation");
  assert.equal(attempts, 2);
});

test("preserves disputed claims without adding irrelevant background", async () => {
  const output: InitialStateOutput = {
    title: "Disputed situation",
    state: { summary: "The central claim is disputed.", facts: [
      { id: "claim-status", text: "The central claim remains disputed.", status: "disputed", evidenceIds: [limitedId] },
    ] },
  };
  const provider: StateEvaluationProvider = {
    async generateInitial() { return output; },
    async generateUpdate() { return changedDecision("reported"); },
  };
  const result = await new StateEvaluator(provider).establishInitialState({ trackerQuery: "Track central claim", evidence });
  assert.equal(result.state.facts.length, 1);
  assert.equal(result.state.facts[0]?.status, "disputed");
});
