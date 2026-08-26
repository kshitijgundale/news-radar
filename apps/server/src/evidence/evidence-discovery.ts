import type { Evidence } from "@radar/contracts";

import type { DiscoveryCache } from "./discovery-cache.js";
import {
  toEvaluationEvidence,
  type EvaluationEvidence,
} from "./evidence-ingestion.js";
import type { EvidenceIngestionService } from "./evidence-ingestion.js";
import type { RetrievalResult } from "./source-fetcher.js";
import type { SearchContext } from "./search-context.js";
import type { SourceCandidate, WebSearchProvider } from "./search-provider.js";

export interface EvidenceDiscoveryResult {
  discovered: number;
  evidence: Evidence[];
  evaluationEvidence: EvaluationEvidence[];
}

const DISCOVERY_OVERLAP_MS = 2 * 60 * 60 * 1_000;

export class EvidenceDiscoveryService {
  public constructor(
    private readonly search: WebSearchProvider,
    private readonly cache: DiscoveryCache,
    private readonly ingestion: EvidenceIngestionService,
    private readonly retrieveSource: (candidate: SourceCandidate) => Promise<RetrievalResult>,
  ) {}

  async discover(input: {
    trackerId: string;
    runId: string;
    context: SearchContext;
  }): Promise<EvidenceDiscoveryResult> {
    const searchResult = await this.cache.search(input.runId, input.context, this.search);
    const evidence: Evidence[] = [];
    const evaluationEvidence: EvaluationEvidence[] = [];

    // Sequential writes keep the simple JSON run cache free from lost updates.
    for (const candidate of searchResult.sources) {
      const retrieval = await this.cache.retrieve(
        input.runId,
        input.context,
        candidate,
        this.retrieveSource,
      );
      if (!isFreshEnough(input.context, candidate, retrieval)) continue;
      const ingested = retrieval.ok
        ? await this.ingestion.ingestFetched({
            trackerId: input.trackerId,
            runId: input.runId,
            source: retrieval.source,
            relevance: candidate.relevance,
          })
        : await this.ingestion.ingestUnavailable({
            trackerId: input.trackerId,
            runId: input.runId,
            candidate,
            failure: retrieval.failure,
          });

      evidence.push(ingested.evidence);
      if (ingested.eligibleForEvaluation) {
        const usable = toEvaluationEvidence(ingested.evidence);
        if (usable) evaluationEvidence.push(usable);
      }
    }

    return { discovered: searchResult.sources.length, evidence, evaluationEvidence };
  }
}

export function isFreshEnough(
  context: SearchContext,
  candidate: SourceCandidate,
  retrieval: RetrievalResult,
): boolean {
  if (context.mode !== "recurring" || !context.searchSince) return true;

  // Prefer metadata extracted from the page. Search metadata is only a fallback
  // for blocked/unavailable pages and must still provide a verifiable date.
  const publishedAt = retrieval.ok ? retrieval.source.publishedAt : candidate.publishedAt;
  if (!publishedAt) return false;
  const cutoff = new Date(context.searchSince).getTime() - DISCOVERY_OVERLAP_MS;
  return new Date(publishedAt).getTime() >= cutoff;
}
