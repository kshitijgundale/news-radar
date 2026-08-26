import type { RetrievalResult } from "./source-fetcher.js";
import type { SearchContext } from "./search-context.js";
import type { SearchResult, SourceCandidate, WebSearchProvider } from "./search-provider.js";
import { runDiscoveryCacheSchema, type RunDiscoveryCache } from "../repositories/run-cache-repository.js";

export interface RunCacheStore {
  load(runId: string): Promise<RunDiscoveryCache | null>;
  save(runId: string, cache: RunDiscoveryCache): Promise<void>;
}

export class DiscoveryCache {
  public constructor(private readonly store: RunCacheStore) {}

  async search(
    runId: string,
    context: SearchContext,
    provider: WebSearchProvider,
  ): Promise<SearchResult> {
    const cache = await this.loadForContext(runId, context);
    if (cache.searchResult) return cache.searchResult;

    const searchResult = await provider.discover(context);
    await this.store.save(runId, { ...cache, searchResult });
    return searchResult;
  }

  async retrieve(
    runId: string,
    context: SearchContext,
    candidate: SourceCandidate,
    retrieve: (candidate: SourceCandidate) => Promise<RetrievalResult>,
  ): Promise<RetrievalResult> {
    const cache = await this.loadForContext(runId, context);
    const cached = cache.retrievals.find((entry) => entry.candidateUrl === candidate.url);
    if (cached) return cached.result;

    const result = await retrieve(candidate);
    await this.store.save(runId, {
      ...cache,
      retrievals: [...cache.retrievals, { candidateUrl: candidate.url, result }],
    });
    return result;
  }

  private async loadForContext(runId: string, context: SearchContext): Promise<RunDiscoveryCache> {
    const existing = await this.store.load(runId);
    if (!existing) {
      return runDiscoveryCacheSchema.parse({
        version: 1,
        context,
        searchResult: null,
        retrievals: [],
      });
    }
    if (JSON.stringify(existing.context) !== JSON.stringify(context)) {
      throw new Error(`Discovery context changed during run ${runId}`);
    }
    return existing;
  }
}
