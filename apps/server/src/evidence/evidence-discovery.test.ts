import assert from "node:assert/strict";
import test from "node:test";

import { isFreshEnough } from "./evidence-discovery.js";
import type { SearchContext } from "./search-context.js";
import type { SourceCandidate } from "./search-provider.js";
import type { RetrievalResult } from "./source-fetcher.js";

const context: SearchContext = {
  mode: "recurring",
  trackerQuery: "Track a developing situation",
  currentSummary: "The situation is developing.",
  unresolvedFacts: [],
  latestMeaningfulChange: null,
  searchSince: "2026-08-24T10:00:00.000Z",
  checkedAt: "2026-08-24T12:00:00.000Z",
};

const candidate: SourceCandidate = {
  url: "https://example.com/story",
  title: "Story",
  publisher: null,
  publishedAt: "2026-08-20T10:00:00.000Z",
  snippet: "Relevant result",
  relevance: "Directly relevant",
  sourceKind: "other",
};

function fetched(publishedAt: string | null): RetrievalResult {
  return {
    ok: true,
    source: {
      canonicalUrl: candidate.url,
      title: candidate.title,
      publisher: null,
      publishedAt,
      retrievedAt: context.checkedAt,
      contentHash: "a".repeat(64),
      extractedContent: "Material source content",
      fetchStatus: "fetched",
    },
  };
}

test("uses retrieved page dates instead of stale search metadata", () => {
  assert.equal(isFreshEnough(context, candidate, fetched("2026-08-24T11:00:00.000Z")), true);
  assert.equal(isFreshEnough(context, candidate, fetched("2026-08-24T10:00:00.000Z")), true);
  assert.equal(isFreshEnough(context, candidate, fetched("2026-08-24T08:00:00.000Z")), true);
  assert.equal(isFreshEnough(context, candidate, fetched("2026-08-24T07:59:59.000Z")), false);
  assert.equal(isFreshEnough(context, candidate, fetched("2026-08-20T11:00:00.000Z")), false);
});

test("rejects undated recurring results and applies freshness to every source kind", () => {
  assert.equal(isFreshEnough(context, candidate, fetched(null)), false);
  assert.equal(
    isFreshEnough(context, { ...candidate, sourceKind: "official" }, fetched("2026-08-20T11:00:00.000Z")),
    false,
  );
});

test("uses dated search metadata only when retrieval is unavailable", () => {
  const unavailable: RetrievalResult = {
    ok: false,
    failure: {
      canonicalUrl: candidate.url,
      retrievedAt: context.checkedAt,
      reason: "http_error",
      detail: "HTTP 403",
    },
  };

  assert.equal(isFreshEnough(context, candidate, unavailable), false);
  assert.equal(
    isFreshEnough(context, { ...candidate, publishedAt: "2026-08-24T11:00:00.000Z" }, unavailable),
    true,
  );
});
