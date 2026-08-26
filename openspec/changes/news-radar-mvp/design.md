## Context

Radar is a greenfield weekend project for tracking a user-defined real-world situation rather than presenting a feed of articles. Its core invariant is that evidence supports a concise Current State, while only information that materially changes that state becomes a timeline point. The MVP must support a small number of dogfood trackers, use LLM-powered web search, retain provenance and state history, and remain understandable enough to build and operate quickly.

## Goals / Non-Goals

**Goals:**

- Deliver a mobile-first Expo experience for creating and following natural-language trackers.
- Implement a dependable baseline and recurring-update loop with a single semantic update decision.
- Preserve immutable state versions and evidence provenance while avoiding duplicate work.
- Keep deployment, scheduling, recovery, and local development simple.
- Make accepted and rejected updates inspectable during dogfooding.

**Non-Goals:**

- Exhaustive monitoring of the web or guarantees that every development is found.
- GDELT, embeddings, vector search, NLI models, event ontologies, multi-agent workflows, or bespoke crawling.
- Push notifications, collaboration, public sharing, advanced polling controls, or a user-facing state comparison UI.
- Automated numerical source-trust scores or fact-level probability estimates.

## Decisions

### Use a TypeScript client, backend, and shared contracts

The application will use Expo Router for the mobile client, a small TypeScript backend, and runtime-validated shared request and LLM contracts. Provider credentials and all tracker execution remain server-side. This minimizes language and contract switching while keeping privileged operations out of the client. A client-only design was rejected because mobile background execution is unreliable and would expose provider credentials.

### Use PostgreSQL as the source of truth

PostgreSQL will store trackers, tracker runs, immutable state versions, timeline points, evidence, and their relationships. Current State is denormalized onto the tracker for fast reads while every changed state is appended to `state_versions`. State and LLM payloads use JSON columns with runtime validation; provenance and relationships remain relational. A document database was considered but provides little benefit for this small relational workflow and makes transactional updates less direct.

Core records are:

- `trackers`: query, title, summary, current state, lifecycle status, last checked/changed timestamps, and next check time.
- `tracker_runs`: status, attempt information, search cache/debug data, timing, and error details.
- `state_versions`: monotonically increasing tracker version, complete summary/state snapshot, originating run, and creation time.
- `timeline_points`: headline, detail, detection time, optional occurrence time, and resulting state version.
- `evidence`: canonical URL, title, publisher, publication/update time, retrieval time, cleaned-content hash, extracted content, and fetch status.
- link tables connecting evidence to trackers, state versions, and timeline points.

### Model Current State as a bounded structured snapshot

Current State contains a one-sentence summary and approximately three to eight material facts. Each fact has a stable semantic ID, concise text, a status (`confirmed`, `reported`, `uncertain`, or `disputed`), and evidence references. The model returns the complete replacement state instead of a patch. Stable IDs make correction and removal clearer without introducing a general claim graph.

Only a normalized semantic state change creates a new state version. Presentation-only wording differences do not. The baseline creates State v1 without timeline points.

### Use search for discovery and direct retrieval for durable evidence

A web-search-capable LLM discovers candidate URLs using the original query, current summary, unresolved facts, recent changes, and last-check time. The backend directly fetches accessible candidates, canonicalizes URLs, extracts readable text, and hashes cleaned content. An unchanged URL/hash pair is not reprocessed; the same URL with a different hash is updated evidence. Search snippets may be retained as limited evidence when retrieval fails, but they cannot by themselves support strong confirmation.

Exact URL and hash matching provide MVP deduplication. The update model handles semantic repetition. Embedding-based clustering is deferred because the scale is small and it would add infrastructure without validating the product hypothesis.

### Make one structured LLM decision per evaluation phase

The initial-state contract produces a title, summary, and cited state facts but no timeline. The recurring-update contract receives the tracker query, complete existing state, and only new or updated evidence, then returns `meaningful_update`, a reason, the complete state, and zero or more cited timeline points.

For a non-meaningful update, the output must preserve summary/state and return an empty timeline. For a meaningful update, timeline points describe only newly surfaced material changes. Output is runtime validated and malformed output receives one repair retry. Separate NLI, relevance, and state-transition model stages were rejected to keep the semantic policy in one inspectable contract.

### Order the timeline by detection time

`detected_at` records when Radar learned a change and determines timeline ordering. `occurred_at` is optional context for when an underlying event happened. This supports newly discovered older facts and corrections without pretending Radar knew them earlier. Related details from one substantive development are combined into one timeline point; independently meaningful changes remain separate.

### Execute trackers through idempotent backend runs

A managed scheduler periodically selects due active trackers and invokes the same execution service used by manual refresh. A per-tracker database lock prevents concurrent runs, and a tracker plus scheduling-window idempotency key prevents duplicates. A run performs search, evidence retrieval, deduplication, semantic evaluation, and one transactional persistence step.

The transaction records evidence processing and, only for a meaningful change, inserts the next state version and timeline points before updating the tracker's denormalized state. `last_checked_at` advances after a completed evaluation; `last_changed_at` advances only for a meaningful update. Bounded exponential retries reuse cached search and retrieval data.

### Keep the primary UI centered on state

The MVP has Trackers, New Tracker, and Tracker Detail screens. Tracker Detail presents summary and Current State before Timeline, with Sources collapsed or visually secondary. The UI distinguishes establishing a baseline, checked with no change, updated, paused, and failed/retrying. State History is stored from launch but initially exposed only through development/debug tooling.

## Risks / Trade-offs

- [A search-capable LLM misses a development] → State clearly that coverage is best-effort, vary recurring queries, and dogfood across diverse tracker types.
- [The model bloats State with background] → Enforce the original query as the relevance boundary, cap facts, require cited materiality, and retain old detail in State History rather than Current State.
- [Repeated articles create false updates] → Compare evidence against the full current state and require material semantic change, not source novelty.
- [Model wording changes create state versions] → Use stable fact IDs, normalized comparisons, low-temperature structured output, and explicit no-op invariants.
- [Conflicting sources cause overconfident claims] → Preserve reported, uncertain, and disputed statuses and require evidence links for changed facts.
- [Source pages are unavailable or change] → Store retrieval metadata and hashes, cache successful extractions, and label snippet-only evidence as limited.
- [Serverless execution exceeds time limits] → Keep each run bounded; move the same execution function behind a lightweight worker only if real runs demonstrate the need.
- [Raw source content grows storage quickly] → Retain cleaned text for the dogfood scale and add size limits or object storage only after measuring usage.

## Migration Plan

This is a greenfield change. Deploy the database schema and backend first, configure search/LLM credentials and scheduler authentication, then deploy the Expo client against the backend. Seed no production data; create several dogfood trackers through the application and inspect stored runs, evidence, state versions, and rejected updates. Rollback consists of disabling the scheduler and client entry point; no legacy data migration is required.

## Open Questions

- Which web-search-capable LLM provider gives the best combination of citations, structured output, and development speed?
- Which managed PostgreSQL/backend deployment target best fits the owner's existing accounts and weekend deployment preferences?
- What default polling interval balances freshness and provider usage during dogfooding?
- How much cleaned source text should be retained before introducing size limits or external object storage?

