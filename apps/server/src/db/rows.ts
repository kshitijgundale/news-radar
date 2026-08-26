import {
  evidenceSchema,
  situationStateSchema,
  trackerRunSchema,
  trackerSchema,
  type Evidence,
  type Tracker,
  type TrackerRun,
} from "../contracts.js";

export interface TrackerRow {
  id: string;
  query: string;
  title: string | null;
  summary: string | null;
  current_state: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_checked_at: Date | null;
  last_changed_at: Date | null;
  next_check_at: Date | null;
  poll_interval_minutes: number;
}

export interface RunRow {
  id: string;
  tracker_id: string;
  status: string;
  outcome: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  error: string | null;
}

export interface EvidenceRow {
  id: string;
  canonical_url: string;
  title: string;
  publisher: string | null;
  published_at: Date | null;
  retrieved_at: Date;
  content_hash: string | null;
  extracted_content: string | null;
  fetch_status: string;
}

export interface StateVersionRow {
  id: string;
  tracker_id: string;
  run_id: string;
  version: number;
  summary: string;
  state: unknown;
  created_at: Date;
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

export function mapTracker(row: TrackerRow): Tracker {
  return trackerSchema.parse({
    id: row.id,
    query: row.query,
    title: row.title,
    summary: row.summary,
    currentState: row.current_state,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastCheckedAt: iso(row.last_checked_at),
    lastChangedAt: iso(row.last_changed_at),
    nextCheckAt: iso(row.next_check_at),
    pollIntervalMinutes: row.poll_interval_minutes,
  });
}

export function mapRun(row: RunRow): TrackerRun {
  return trackerRunSchema.parse({
    id: row.id,
    trackerId: row.tracker_id,
    status: row.status,
    outcome: row.outcome,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    error: row.error,
  });
}

export function mapEvidence(row: EvidenceRow): Evidence {
  return evidenceSchema.parse({
    id: row.id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    publisher: row.publisher,
    publishedAt: iso(row.published_at),
    retrievedAt: row.retrieved_at.toISOString(),
    contentHash: row.content_hash,
    extractedContent: row.extracted_content,
    fetchStatus: row.fetch_status,
  });
}

export function mapStateVersion(row: StateVersionRow) {
  return {
    id: row.id,
    trackerId: row.tracker_id,
    runId: row.run_id,
    version: row.version,
    summary: row.summary,
    state: situationStateSchema.parse(row.state),
    createdAt: row.created_at.toISOString(),
  };
}
