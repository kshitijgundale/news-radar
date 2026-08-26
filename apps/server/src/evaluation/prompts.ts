import type { SituationState } from "@radar/contracts";

import type { EvaluationEvidence } from "../evidence/evidence-ingestion.js";

export const initialStateInstructions = `
You establish Radar's baseline understanding of one user-defined real-world situation.

The tracker request is the permanent relevance boundary. Include only facts whose removal
would materially reduce the user's understanding of the situation's current status. Exclude
incidental history, generic statistics, ownership trivia, broad geopolitical context, and
other background unless directly necessary for this tracker.

Return one concise summary and 1-8 non-redundant state facts. Use stable kebab-case semantic
fact IDs. Represent uncertainty honestly with confirmed, reported, uncertain, or disputed.
Every fact must cite supplied evidence IDs. Evidence marked confirmationEligible=false is
snippet-only or otherwise limited and cannot independently support a confirmed fact.

This is the initial baseline. Do not infer or produce timeline events.
`.trim();

export const updateInstructions = `
You update Radar's understanding of one user-defined real-world situation.

Distinguish a new source from new information. Ask whether the supplied new or updated
evidence materially changes what a user following THIS tracker should currently understand.
Repeated evidence, incidental background, and wording improvements are not updates.

Eligible updates include a genuine development, material correction or clarification,
newly discovered older fact, resolution of uncertainty, or important confidence/status
change. Return the complete replacement state, preserving relevant unchanged facts and
removing obsolete ones. Keep 1-8 facts and reuse stable fact IDs where the same concern is
being corrected or resolved.

If nothing material changed, set meaningfulUpdate=false, reproduce the existing state
exactly, and return no timeline points. If something changed, timeline points describe only
the newly surfaced material changes. Combine related details into one point. Every new or
modified fact and every timeline point must cite new evidence. Limited evidence with
confirmationEligible=false cannot independently support a confirmed claim.
`.trim();

export function renderInitialInput(trackerQuery: string, evidence: EvaluationEvidence[]): string {
  return renderInput({ trackerQuery, evidence });
}

export function renderUpdateInput(input: {
  trackerQuery: string;
  existingState: SituationState;
  evidence: EvaluationEvidence[];
}): string {
  return renderInput({
    trackerQuery: input.trackerQuery,
    existingState: input.existingState,
    evidence: input.evidence,
  });
}

function renderInput(input: {
  trackerQuery: string;
  existingState?: SituationState;
  evidence: EvaluationEvidence[];
}): string {
  return JSON.stringify(
    {
      trackerQuery: input.trackerQuery,
      ...(input.existingState ? { existingState: input.existingState } : {}),
      evidence: input.evidence,
    },
    null,
    2,
  );
}
