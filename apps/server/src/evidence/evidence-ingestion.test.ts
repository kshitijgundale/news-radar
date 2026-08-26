import assert from "node:assert/strict";
import test from "node:test";

import type { Evidence } from "@radar/contracts";

import {
  EvidenceIngestionService,
  classifyEvidence,
  toEvaluationEvidence,
  type EvidenceStore,
} from "./evidence-ingestion.js";
import type { RetrievedSource } from "./source-fetcher.js";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

const source: RetrievedSource = {
  canonicalUrl: "https://example.com/story",
  title: "Story",
  publisher: "Example",
  publishedAt: null,
  retrievedAt: "2026-08-24T12:00:00.000Z",
  contentHash: hashB,
  extractedContent: "Material source content",
  fetchStatus: "fetched",
};

function evidence(id: string, url: string, hash: string): Evidence {
  return { id, canonicalUrl: url, title: "Story", publisher: null, publishedAt: null,
    retrievedAt: "2026-08-24T10:00:00.000Z", contentHash: hash,
    extractedContent: "Content", fetchStatus: "fetched" };
}

test("classifies edited URLs and same-content mirrors separately", () => {
  assert.equal(classifyEvidence(source, evidence(firstId, source.canonicalUrl, hashA), null), "updated");
  assert.equal(classifyEvidence(source, null, evidence(firstId, "https://mirror.test/story", hashB)), "duplicate_content");
});

test("retains duplicate provenance but skips it for semantic evaluation", async () => {
  const links: Array<{ status: string }> = [];
  const store: EvidenceStore = {
    async findLatestForTrackerUrl() { return null; },
    async findForTrackerHash() { return evidence(firstId, "https://original.test/story", hashB); },
    async upsert(input) { return { ...input, id: secondId }; },
    async linkToTracker(input) { links.push(input); },
  };

  const result = await new EvidenceIngestionService(store).ingestFetched({
    trackerId: firstId,
    runId: secondId,
    source,
    relevance: "Directly relevant",
  });

  assert.equal(result.disposition, "duplicate_content");
  assert.equal(result.eligibleForEvaluation, false);
  assert.equal(links[0]?.status, "skipped_unchanged");
});

test("records snippet fallback as limited evidence that cannot confirm a claim", async () => {
  let upsertedFetchStatus: string | null = null;
  const links: Array<{ status: string }> = [];
  const store: EvidenceStore = {
    async findLatestForTrackerUrl() { return null; },
    async findForTrackerHash() { return null; },
    async upsert(input) {
      upsertedFetchStatus = input.fetchStatus;
      return { ...input, id: secondId };
    },
    async linkToTracker(input) { links.push(input); },
  };
  const service = new EvidenceIngestionService(store);
  const result = await service.ingestUnavailable({
    trackerId: firstId,
    runId: secondId,
    candidate: {
      url: "https://example.com/unavailable",
      title: "Unavailable report",
      publisher: "Example",
      publishedAt: null,
      snippet: "Search surfaced a potentially relevant statement.",
      relevance: "May concern the tracker",
      sourceKind: "statement",
    },
    failure: {
      canonicalUrl: "https://example.com/unavailable",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      reason: "http_error",
      detail: "HTTP 403",
    },
  });

  assert.equal(upsertedFetchStatus, "limited");
  assert.equal(links[0]?.status, "pending");
  assert.equal(result.eligibleForEvaluation, true);
  assert.equal(toEvaluationEvidence(result.evidence)?.confirmationEligible, false);
});
