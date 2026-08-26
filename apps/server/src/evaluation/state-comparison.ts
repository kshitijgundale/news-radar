import { createHash } from "node:crypto";

import { situationStateSchema, type SituationState } from "../contracts.js";

export function normalizedStateFingerprint(state: SituationState): string {
  const parsed = situationStateSchema.parse(state);
  const normalizedFacts = parsed.facts
    .map((fact) => ({
      id: fact.id,
      status: fact.status,
      text: normalizeProse(fact.text),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(normalizedFacts)).digest("hex");
}

export function hasMaterialStateDifference(
  existing: SituationState,
  candidate: SituationState,
): boolean {
  return normalizedStateFingerprint(existing) !== normalizedStateFingerprint(candidate);
}

function normalizeProse(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
