import {
  initialStateOutputSchema,
  updateDecisionSchema,
  type InitialStateOutput,
  type UpdateDecision,
} from "@radar/contracts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { env } from "../lib/env.js";
import type {
  InitialEvaluationRequest,
  StateEvaluationProvider,
  UpdateEvaluationRequest,
} from "./provider.js";
import {
  initialStateInstructions,
  renderInitialInput,
  renderUpdateInput,
  updateInstructions,
} from "./prompts.js";

export class OpenAIStateEvaluationProvider implements StateEvaluationProvider {
  public constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generateInitial(
    input: InitialEvaluationRequest,
    repairFeedback?: string,
  ): Promise<InitialStateOutput> {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: withRepairFeedback(initialStateInstructions, repairFeedback),
      input: renderInitialInput(input.trackerQuery, input.evidence),
      store: false,
      text: { format: zodTextFormat(initialStateOutputSchema, "radar_initial_state") },
    });
    if (!response.output_parsed) throw new Error("Initial evaluation returned no parsed output");
    return response.output_parsed;
  }

  async generateUpdate(
    input: UpdateEvaluationRequest,
    repairFeedback?: string,
  ): Promise<UpdateDecision> {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: withRepairFeedback(updateInstructions, repairFeedback),
      input: renderUpdateInput(input),
      store: false,
      text: { format: zodTextFormat(updateDecisionSchema, "radar_update_decision") },
    });
    if (!response.output_parsed) throw new Error("Update evaluation returned no parsed output");
    return response.output_parsed;
  }
}

export function createStateEvaluationProvider(): StateEvaluationProvider {
  return new OpenAIStateEvaluationProvider(new OpenAI({ apiKey: env.LLM_API_KEY }), env.LLM_MODEL);
}

function withRepairFeedback(instructions: string, feedback?: string): string {
  return feedback
    ? `${instructions}\n\nYour previous output was rejected. Correct every issue below:\n${feedback}`
    : instructions;
}
