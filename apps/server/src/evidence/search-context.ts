import { situationStateSchema, type SituationState } from "@radar/contracts";
import { z } from "zod";

export const searchContextSchema = z
  .object({
    mode: z.enum(["initial", "recurring"]),
    trackerQuery: z.string().trim().min(1).max(1_000),
    currentSummary: z.string().trim().min(1).max(500).nullable(),
    unresolvedFacts: z.array(z.string().trim().min(1).max(500)).max(8),
    latestMeaningfulChange: z.string().trim().min(1).max(1_000).nullable(),
    searchSince: z.iso.datetime({ offset: true }).nullable(),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type SearchContext = z.infer<typeof searchContextSchema>;

export interface BuildSearchContextInput {
  trackerQuery: string;
  currentState: SituationState | null;
  latestMeaningfulChange: string | null;
  lastCheckedAt: string | null;
  checkedAt?: Date;
}

export function buildSearchContext(input: BuildSearchContextInput): SearchContext {
  const currentState = input.currentState ? situationStateSchema.parse(input.currentState) : null;

  return searchContextSchema.parse({
    mode: currentState ? "recurring" : "initial",
    trackerQuery: input.trackerQuery,
    currentSummary: currentState?.summary ?? null,
    unresolvedFacts:
      currentState?.facts
        .filter((fact) => fact.status === "uncertain" || fact.status === "disputed")
        .map((fact) => fact.text) ?? [],
    latestMeaningfulChange: input.latestMeaningfulChange,
    searchSince: input.lastCheckedAt,
    checkedAt: (input.checkedAt ?? new Date()).toISOString(),
  });
}

export function renderSearchInput(context: SearchContext): string {
  const sections = [
    `Search mode: ${context.mode === "recurring" ? "RECURRING CHECK" : "INITIAL BASELINE"}`,
    `Tracker request:\n${context.trackerQuery}`,
    context.currentSummary ? `Radar's current understanding:\n${context.currentSummary}` : null,
    context.unresolvedFacts.length > 0
      ? `Material unresolved or disputed facts:\n${context.unresolvedFacts.map((fact) => `- ${fact}`).join("\n")}`
      : null,
    context.latestMeaningfulChange
      ? `Most recent meaningful change already known:\n${context.latestMeaningfulChange}`
      : null,
    context.searchSince
      ? `LAST SUCCESSFUL CHECK: ${context.searchSince}\nPrioritize information published or materially updated after this timestamp. To account for delayed indexing, you may include highly relevant results from up to two hours before it. Prefer the newest available reporting and exclude older background, recaps, and unchanged articles.`
      : `Establish the best available current baseline. Prioritize developments from the last 24 hours relative to ${context.checkedAt}, then widen only as needed to explain the current situation.`,
    `Search performed at: ${context.checkedAt}`,
  ];

  return sections.filter((section): section is string => section !== null).join("\n\n");
}
