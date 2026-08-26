import assert from "node:assert/strict";
import test from "node:test";

import { DiscoveryCache, type RunCacheStore } from "./discovery-cache.js";
import type { SearchContext } from "./search-context.js";
import type { SourceCandidate, WebSearchProvider } from "./search-provider.js";
import type { RunDiscoveryCache } from "../repositories/run-cache-repository.js";

const context: SearchContext = {
  mode: "initial",
  trackerQuery: "Track a situation",
  currentSummary: null,
  unresolvedFacts: [],
  latestMeaningfulChange: null,
  searchSince: null,
  checkedAt: "2026-08-24T12:00:00.000Z",
};
const candidate: SourceCandidate = {
  url: "https://example.com/story",
  title: "Story",
  publisher: null,
  publishedAt: null,
  snippet: "Relevant snippet",
  relevance: "Direct report",
  sourceKind: "news",
};

function memoryStore(): RunCacheStore {
  let value: RunDiscoveryCache | null = null;
  return {
    async load() { return value; },
    async save(_runId, cache) { value = structuredClone(cache); },
  };
}

test("reuses cached search and retrieval results on retry", async () => {
  let searches = 0;
  let retrievals = 0;
  const provider: WebSearchProvider = {
    async discover() { searches += 1; return { sources: [candidate] }; },
  };
  const retrieve = async () => {
    retrievals += 1;
    return {
      ok: false as const,
      failure: {
        canonicalUrl: candidate.url,
        retrievedAt: context.checkedAt,
        reason: "network_error" as const,
        detail: "offline",
      },
    };
  };
  const cache = new DiscoveryCache(memoryStore());

  await cache.search("run", context, provider);
  await cache.search("run", context, provider);
  await cache.retrieve("run", context, candidate, retrieve);
  await cache.retrieve("run", context, candidate, retrieve);

  assert.equal(searches, 1);
  assert.equal(retrievals, 1);
});
