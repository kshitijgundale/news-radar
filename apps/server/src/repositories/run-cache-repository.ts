import { z } from "zod";

import type { Queryable } from "../db/types.js";
import { searchContextSchema } from "../evidence/search-context.js";
import { searchResultSchema } from "../evidence/search-provider.js";

const retrievedSourceSchema = z.object({
  canonicalUrl: z.url(),
  title: z.string(),
  publisher: z.string().nullable(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  retrievedAt: z.iso.datetime({ offset: true }),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractedContent: z.string(),
  fetchStatus: z.literal("fetched"),
}).strict();

const retrievalFailureSchema = z.object({
  canonicalUrl: z.string(),
  retrievedAt: z.iso.datetime({ offset: true }),
  reason: z.enum([
    "blocked_url", "timeout", "http_error", "too_large",
    "unsupported_content", "empty_content", "network_error",
  ]),
  detail: z.string(),
}).strict();

const retrievalResultSchema = z.union([
  z.object({ ok: z.literal(true), source: retrievedSourceSchema }).strict(),
  z.object({ ok: z.literal(false), failure: retrievalFailureSchema }).strict(),
]);

export const runDiscoveryCacheSchema = z.object({
  version: z.literal(1),
  context: searchContextSchema,
  searchResult: searchResultSchema.nullable(),
  retrievals: z.array(z.object({ candidateUrl: z.url(), result: retrievalResultSchema }).strict()),
}).strict();

export type RunDiscoveryCache = z.infer<typeof runDiscoveryCacheSchema>;

interface CacheRow {
  search_cache: unknown;
}

export class RunCacheRepository {
  public constructor(private readonly database: Queryable) {}

  async load(runId: string): Promise<RunDiscoveryCache | null> {
    const result = await this.database.query<CacheRow>(
      "SELECT search_cache FROM tracker_runs WHERE id = $1",
      [runId],
    );
    const value = result.rows[0]?.search_cache;
    return value == null ? null : runDiscoveryCacheSchema.parse(value);
  }

  async save(runId: string, cache: RunDiscoveryCache): Promise<void> {
    const validated = runDiscoveryCacheSchema.parse(cache);
    const result = await this.database.query(
      "UPDATE tracker_runs SET search_cache = $2::jsonb WHERE id = $1",
      [runId, JSON.stringify(validated)],
    );
    if (result.rowCount === 0) throw new Error(`Tracker run ${runId} not found`);
  }
}
