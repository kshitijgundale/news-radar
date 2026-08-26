import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSourceCandidates, type SourceCandidate } from "./search-provider.js";

function candidate(url: string, title = "Source"): SourceCandidate {
  return {
    url,
    title,
    publisher: null,
    publishedAt: null,
    snippet: "Relevant source text",
    relevance: "Directly concerns the tracked situation",
    sourceKind: "news",
  };
}

test("normalizes and deduplicates provider source candidates", () => {
  const result = normalizeSourceCandidates([
    candidate("https://example.com/report#section"),
    candidate("https://example.com/report"),
    candidate("ftp://example.com/not-web"),
  ]);

  assert.deepEqual(result.map((source) => source.url), ["https://example.com/report"]);
});

test("search response schema avoids the unsupported uri format", async () => {
  const { zodTextFormat } = await import("openai/helpers/zod");
  const { searchResultSchema } = await import("./search-provider.js");
  const format = zodTextFormat(searchResultSchema, "radar_source_candidates");
  assert.doesNotMatch(JSON.stringify(format), /"format":"uri"/);
});
