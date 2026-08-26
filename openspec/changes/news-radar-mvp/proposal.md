## Why

People following a developing real-world situation must repeatedly search for articles and reconstruct what changed themselves. Radar will test whether a persistent, concise Current State plus a timeline of only meaningful changes is a more useful way to follow user-defined situations.

## What Changes

- Add a mobile-first Expo application where users create natural-language trackers and inspect their status.
- Add backend tracker execution for initial baselines and recurring checks using LLM-powered web search and lightweight source retrieval.
- Maintain a minimal Current State and immutable State History, creating new versions only when the understood state materially changes.
- Record meaningful newly surfaced information as timeline points rather than treating articles as events.
- Store source provenance, detect unchanged and edited-in-place evidence, and reuse cached retrieval results during retries.
- Add simple scheduled execution, run locking, retry handling, and visible checked/updated/error states.
- Exclude GDELT, embeddings, NLI models, bespoke crawlers, event ontologies, and multi-agent orchestration from the MVP.

## Capabilities

### New Capabilities

- `tracker-management`: Create, list, view, activate, and pause natural-language situation trackers in the Expo app.
- `situation-state`: Establish and maintain a minimal Current State, summary, and immutable State History for each tracker.
- `meaningful-change-timeline`: Detect material changes relative to Current State and record evidence-backed timeline points without duplicating known information.
- `evidence-retrieval`: Discover relevant web sources, retrieve and normalize their content, retain provenance, and detect unchanged or edited evidence.
- `tracker-execution`: Run initial and recurring tracker checks with scheduling, idempotency, caching, locking, and retry behavior.

### Modified Capabilities

None.

## Impact

- Introduces a greenfield Expo/React Native client, a TypeScript backend, shared validation contracts, and PostgreSQL persistence.
- Requires a web-search-capable LLM, ordinary HTTP source retrieval, a managed scheduler, and secure backend configuration for provider credentials.
- Adds APIs for tracker lifecycle, detail retrieval, run status, and manual checks.
- Establishes persisted tracker, run, state-version, timeline-point, evidence, and evidence-linking records.
