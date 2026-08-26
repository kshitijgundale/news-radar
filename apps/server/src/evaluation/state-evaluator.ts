import {
  initialStateOutputSchema,
  updateDecisionSchema,
  type InitialStateOutput,
  type StateFact,
  type UpdateDecision,
} from "../contracts.js";

import type { EvaluationEvidence } from "../evidence/evidence-ingestion.js";
import type {
  InitialEvaluationRequest,
  StateEvaluationProvider,
  UpdateEvaluationRequest,
} from "./provider.js";
import { hasMaterialStateDifference } from "./state-comparison.js";

export class StateEvaluator {
  public constructor(private readonly provider: StateEvaluationProvider) {}

  async establishInitialState(input: InitialEvaluationRequest): Promise<InitialStateOutput> {
    if (input.evidence.length === 0) throw new Error("Initial evaluation requires usable evidence");
    return this.withOneRepair(
      (feedback) => this.provider.generateInitial(input, feedback),
      (output) => validateInitialOutput(output, input.evidence),
    );
  }

  async evaluateUpdate(input: UpdateEvaluationRequest): Promise<UpdateDecision> {
    if (input.evidence.length === 0) {
      return {
        meaningfulUpdate: false,
        reason: "No new or updated evidence was available for evaluation.",
        state: input.existingState,
        timelinePoints: [],
      };
    }
    return this.withOneRepair(
      (feedback) => this.provider.generateUpdate(input, feedback),
      (output) => validateUpdateOutput(output, input),
    );
  }

  private async withOneRepair<Output>(
    generate: (feedback?: string) => Promise<Output>,
    validate: (output: Output) => Output,
  ): Promise<Output> {
    let firstError: unknown;
    try {
      return validate(await generate());
    } catch (error) {
      firstError = error;
    }

    try {
      return validate(await generate(formatError(firstError)));
    } catch (error) {
      throw new Error(`LLM output remained invalid after one repair: ${formatError(error)}`, {
        cause: error,
      });
    }
  }
}

export function validateInitialOutput(
  output: InitialStateOutput,
  evidence: EvaluationEvidence[],
): InitialStateOutput {
  const parsed = initialStateOutputSchema.parse(output);
  validateFactCitations(parsed.state.facts, evidence, new Set(), true);
  return parsed;
}

export function validateUpdateOutput(
  output: UpdateDecision,
  input: UpdateEvaluationRequest,
): UpdateDecision {
  const parsed = updateDecisionSchema.parse(output);
  const oldEvidenceIds = new Set(input.existingState.facts.flatMap((fact) => fact.evidenceIds));
  const newEvidenceIds = new Set(input.evidence.map((item) => item.evidenceId));

  if (!parsed.meaningfulUpdate) {
    if (JSON.stringify(parsed.state) !== JSON.stringify(input.existingState)) {
      throw new Error("No-change output must reproduce the existing state exactly");
    }
    return parsed;
  }

  if (!hasMaterialStateDifference(input.existingState, parsed.state)) {
    throw new Error("Meaningful update does not materially change normalized state facts");
  }

  validateFactCitations(parsed.state.facts, input.evidence, oldEvidenceIds, false);
  const previousFacts = new Map(input.existingState.facts.map((fact) => [fact.id, fact]));
  for (const fact of parsed.state.facts) {
    const previous = previousFacts.get(fact.id);
    if (!previous || previous.text !== fact.text || previous.status !== fact.status) {
      requireNewEvidence(fact.evidenceIds, newEvidenceIds, `Changed fact ${fact.id}`);
    }
  }
  for (const point of parsed.timelinePoints) {
    requireNewEvidence(point.evidenceIds, newEvidenceIds, `Timeline point ${point.headline}`);
    if (point.evidenceIds.some((id) => !newEvidenceIds.has(id))) {
      throw new Error(`Timeline point ${point.headline} cites evidence outside this update`);
    }
  }
  return parsed;
}

function validateFactCitations(
  facts: StateFact[],
  newEvidence: EvaluationEvidence[],
  previouslyValidatedIds: Set<string>,
  initial: boolean,
): void {
  const evidenceById = new Map(newEvidence.map((item) => [item.evidenceId, item]));
  for (const fact of facts) {
    for (const id of fact.evidenceIds) {
      if (!evidenceById.has(id) && !previouslyValidatedIds.has(id)) {
        throw new Error(`Fact ${fact.id} cites unknown evidence ${id}`);
      }
    }
    if (fact.status === "confirmed") {
      const hasStrongEvidence = fact.evidenceIds.some(
        (id) => previouslyValidatedIds.has(id) || evidenceById.get(id)?.confirmationEligible,
      );
      if (!hasStrongEvidence) {
        throw new Error(`Confirmed fact ${fact.id} relies only on limited evidence`);
      }
    }
    if (initial && fact.evidenceIds.some((id) => !evidenceById.has(id))) {
      throw new Error(`Initial fact ${fact.id} must cite supplied evidence`);
    }
  }
}

function requireNewEvidence(ids: string[], newEvidenceIds: Set<string>, label: string): void {
  if (!ids.some((id) => newEvidenceIds.has(id))) {
    throw new Error(`${label} must cite at least one new evidence item`);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
