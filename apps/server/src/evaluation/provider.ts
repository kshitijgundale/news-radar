import type { InitialStateOutput, SituationState, UpdateDecision } from "@radar/contracts";

import type { EvaluationEvidence } from "../evidence/evidence-ingestion.js";

export interface InitialEvaluationRequest {
  trackerQuery: string;
  evidence: EvaluationEvidence[];
}

export interface UpdateEvaluationRequest extends InitialEvaluationRequest {
  existingState: SituationState;
}

export interface StateEvaluationProvider {
  generateInitial(
    input: InitialEvaluationRequest,
    repairFeedback?: string,
  ): Promise<InitialStateOutput>;
  generateUpdate(
    input: UpdateEvaluationRequest,
    repairFeedback?: string,
  ): Promise<UpdateDecision>;
}
