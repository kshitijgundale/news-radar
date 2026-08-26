import assert from "node:assert/strict";
import test from "node:test";

import { buildSearchContext, renderSearchInput } from "./search-context.js";

test("builds initial context from the full natural-language tracker", () => {
  const context = buildSearchContext({
    trackerQuery: "Track the situation involving captured sailors near Somalia",
    currentState: null,
    latestMeaningfulChange: null,
    lastCheckedAt: null,
    checkedAt: new Date("2026-08-24T12:00:00.000Z"),
  });

  assert.equal(context.mode, "initial");
  assert.match(renderSearchInput(context), /Prioritize developments from the last 24 hours/);
});

test("includes only unresolved facts and the recurring search window", () => {
  const context = buildSearchContext({
    trackerQuery: "Track the protest at Jantar Mantar",
    currentState: {
      summary: "The protest remains active.",
      facts: [
        {
          id: "attendance",
          text: "Attendance remains disputed.",
          status: "disputed",
          evidenceIds: ["00000000-0000-4000-8000-000000000001"],
        },
        {
          id: "location",
          text: "The gathering is at Jantar Mantar.",
          status: "confirmed",
          evidenceIds: ["00000000-0000-4000-8000-000000000002"],
        },
      ],
    },
    latestMeaningfulChange: "Organizers extended the protest.",
    lastCheckedAt: "2026-08-24T10:00:00.000Z",
    checkedAt: new Date("2026-08-24T12:00:00.000Z"),
  });

  assert.deepEqual(context.unresolvedFacts, ["Attendance remains disputed."]);
  const prompt = renderSearchInput(context);
  assert.match(prompt, /Search mode: RECURRING CHECK/);
  assert.match(prompt, /LAST SUCCESSFUL CHECK: 2026-08-24T10:00:00.000Z/);
  assert.match(prompt, /up to two hours before/);
  assert.doesNotMatch(prompt, /The gathering is at Jantar Mantar/);
});
