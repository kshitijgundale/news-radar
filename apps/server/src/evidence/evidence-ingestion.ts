import type { Evidence } from "@radar/contracts";

import type { EvidenceUpsert } from "../repositories/evidence-repository.js";
import type { RetrievedSource } from "./source-fetcher.js";
import type { RetrievalFailure } from "./source-fetcher.js";
import type { SourceCandidate } from "./search-provider.js";

export type EvidenceDisposition = "new" | "updated" | "unchanged" | "duplicate_content";

export interface EvidenceStore {
  findLatestForTrackerUrl(trackerId: string, canonicalUrl: string): Promise<Evidence | null>;
  findForTrackerHash(trackerId: string, contentHash: string): Promise<Evidence | null>;
  upsert(input: EvidenceUpsert): Promise<Evidence>;
  linkToTracker(input: {
    trackerId: string;
    evidenceId: string;
    runId: string;
    status: "pending" | "processed" | "skipped_unchanged" | "rejected_irrelevant";
    relevance?: string | null;
  }): Promise<void>;
}

export interface IngestedEvidence {
  evidence: Evidence;
  disposition: EvidenceDisposition;
  eligibleForEvaluation: boolean;
}

export interface EvaluationEvidence {
  evidenceId: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  url: string;
  content: string;
  confirmationEligible: boolean;
}

export class EvidenceIngestionService {
  public constructor(private readonly evidence: EvidenceStore) {}

  async ingestFetched(input: {
    trackerId: string;
    runId: string;
    source: RetrievedSource;
    relevance: string;
  }): Promise<IngestedEvidence> {
    const [previousAtUrl, sameContent] = await Promise.all([
      this.evidence.findLatestForTrackerUrl(input.trackerId, input.source.canonicalUrl),
      this.evidence.findForTrackerHash(input.trackerId, input.source.contentHash),
    ]);

    const disposition = classifyEvidence(input.source, previousAtUrl, sameContent);
    const evidence = await this.evidence.upsert(input.source);
    const eligibleForEvaluation = disposition === "new" || disposition === "updated";
    await this.evidence.linkToTracker({
      trackerId: input.trackerId,
      evidenceId: evidence.id,
      runId: input.runId,
      status: eligibleForEvaluation ? "pending" : "skipped_unchanged",
      relevance: input.relevance,
    });

    return { evidence, disposition, eligibleForEvaluation };
  }

  async ingestUnavailable(input: {
    trackerId: string;
    runId: string;
    candidate: SourceCandidate;
    failure: RetrievalFailure;
  }): Promise<IngestedEvidence> {
    const hasSnippet = Boolean(input.candidate.snippet);
    const evidence = await this.evidence.upsert({
      canonicalUrl: input.failure.canonicalUrl,
      title: input.candidate.title,
      publisher: input.candidate.publisher,
      publishedAt: input.candidate.publishedAt,
      retrievedAt: input.failure.retrievedAt,
      contentHash: null,
      extractedContent: input.candidate.snippet,
      fetchStatus: hasSnippet ? "limited" : "failed",
    });
    await this.evidence.linkToTracker({
      trackerId: input.trackerId,
      evidenceId: evidence.id,
      runId: input.runId,
      status: hasSnippet ? "pending" : "processed",
      relevance: `${input.candidate.relevance} Retrieval ${input.failure.reason}: ${input.failure.detail}`,
    });

    return { evidence, disposition: "new", eligibleForEvaluation: hasSnippet };
  }
}

export function toEvaluationEvidence(evidence: Evidence): EvaluationEvidence | null {
  if (!evidence.extractedContent) return null;
  return {
    evidenceId: evidence.id,
    title: evidence.title,
    publisher: evidence.publisher,
    publishedAt: evidence.publishedAt,
    url: evidence.canonicalUrl,
    content: evidence.extractedContent,
    confirmationEligible: evidence.fetchStatus === "fetched",
  };
}

export function classifyEvidence(
  source: RetrievedSource,
  previousAtUrl: Evidence | null,
  sameContent: Evidence | null,
): EvidenceDisposition {
  if (previousAtUrl?.contentHash === source.contentHash) return "unchanged";
  if (previousAtUrl) return "updated";
  if (sameContent) return "duplicate_content";
  return "new";
}
