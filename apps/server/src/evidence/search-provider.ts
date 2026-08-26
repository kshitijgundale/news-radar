import { z } from "zod";

import type { SearchContext } from "./search-context.js";

export const sourceKindSchema = z.enum([
  "news",
  "official",
  "announcement",
  "filing",
  "blog",
  "statement",
  "other",
]);

export const sourceCandidateSchema = z
  .object({
    // OpenAI structured outputs rejects JSON Schema's `format: "uri"`.
    // A pattern keeps generation constrained while URL parsing below remains authoritative.
    url: z.string().trim().min(1).max(2_048).regex(/^https?:\/\/\S+$/i),
    title: z.string().trim().min(1).max(500),
    publisher: z.string().trim().min(1).max(200).nullable(),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
    snippet: z.string().trim().min(1).max(2_000).nullable(),
    relevance: z.string().trim().min(1).max(500),
    sourceKind: sourceKindSchema,
  })
  .strict();

export const searchResultSchema = z
  .object({ sources: z.array(sourceCandidateSchema).max(20) })
  .strict();

export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;

export interface WebSearchProvider {
  discover(context: SearchContext): Promise<SearchResult>;
}

export function normalizeSourceCandidates(candidates: SourceCandidate[]): SourceCandidate[] {
  const normalized = new Map<string, SourceCandidate>();

  for (const candidate of candidates) {
    const result = sourceCandidateSchema.safeParse(candidate);
    if (!result.success) continue;
    const parsed = result.data;
    let url: URL;
    try {
      url = new URL(parsed.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    const key = url.href;

    if (!normalized.has(key)) {
      normalized.set(key, { ...parsed, url: key });
    }
  }

  return [...normalized.values()].slice(0, 15);
}
