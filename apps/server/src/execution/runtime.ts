import { pool } from "../db/pool.js";
import { DiscoveryCache } from "../evidence/discovery-cache.js";
import { EvidenceDiscoveryService } from "../evidence/evidence-discovery.js";
import { EvidenceIngestionService } from "../evidence/evidence-ingestion.js";
import { createWebSearchProvider } from "../evidence/openai-web-search.js";
import { fetchSource } from "../evidence/source-fetcher.js";
import { createStateEvaluationProvider } from "../evaluation/openai-state-evaluator.js";
import { StateEvaluator } from "../evaluation/state-evaluator.js";
import { env } from "../lib/env.js";
import { EvidenceRepository } from "../repositories/evidence-repository.js";
import { InspectionRepository } from "../repositories/inspection-repository.js";
import { RunCacheRepository } from "../repositories/run-cache-repository.js";
import { RunRepository } from "../repositories/run-repository.js";
import { StateRepository } from "../repositories/state-repository.js";
import { TimelineRepository } from "../repositories/timeline-repository.js";
import { TrackerRepository } from "../repositories/tracker-repository.js";
import { EvaluationPersistence } from "../services/evaluation-persistence.js";
import { TrackerExecutionService } from "./tracker-executor.js";

export function createExecutionRuntime() {
  const evidenceRepository = new EvidenceRepository(pool);
  const cache = new DiscoveryCache(new RunCacheRepository(pool));
  const discovery = new EvidenceDiscoveryService(
    createWebSearchProvider(),
    cache,
    new EvidenceIngestionService(evidenceRepository),
    (candidate) => fetchSource(candidate, { maxBytes: env.MAX_SOURCE_CONTENT_BYTES }),
  );
  return {
    executor: new TrackerExecutionService({
      trackers: new TrackerRepository(pool),
      runs: new RunRepository(pool),
      states: new StateRepository(pool),
      timeline: new TimelineRepository(pool),
      discovery,
      evaluator: new StateEvaluator(createStateEvaluationProvider()),
      persistence: new EvaluationPersistence(pool),
    }),
    trackers: new TrackerRepository(pool),
    runs: new RunRepository(pool),
    timeline: new TimelineRepository(pool),
    evidence: evidenceRepository,
    inspection: new InspectionRepository(pool),
  };
}
