## 1. Project Foundation

- [x] 1.1 Scaffold the Expo Router mobile application and TypeScript backend with shared runtime contracts
- [x] 1.2 Add environment configuration and server-only validation for database, search, LLM, scheduler, and application settings
- [x] 1.3 Configure linting, type checking, test commands, and local development scripts for all packages

## 2. Persistence and Domain Contracts

- [x] 2.1 Define validated contracts for state facts, initial-state output, recurring-update output, evidence, and tracker API responses
- [x] 2.2 Create PostgreSQL migrations for trackers, tracker runs, state versions, timeline points, evidence, and evidence-link tables
- [x] 2.3 Add database constraints and indexes for state version ordering, canonical evidence identity, run idempotency, and due tracker selection
- [x] 2.4 Implement repositories for tracker lifecycle, run status, evidence upsert/linking, and immutable state version retrieval
- [x] 2.5 Add transactional persistence for meaningful updates and no-change evidence processing

## 3. Evidence Discovery and Retrieval

- [x] 3.1 Implement search-query context construction from tracker query, current state, unresolved facts, recent change, and last-check time
- [x] 3.2 Integrate a web-search-capable LLM and normalize its candidate source results
- [x] 3.3 Implement URL canonicalization, bounded HTTP fetching, readable-text extraction, and cleaned-content hashing
- [x] 3.4 Detect unchanged URL/hash pairs, edited-in-place sources, and identical-content duplicates while retaining provenance
- [x] 3.5 Cache search and extracted-source results for reuse by retried tracker runs
- [x] 3.6 Record retrieval failures and snippet-only results as limited evidence that cannot independently confirm strong claims

## 4. State and Timeline Evaluation

- [x] 4.1 Implement the initial-state prompt with tracker relevance, bounded state facts, uncertainty statuses, and mandatory evidence citations
- [x] 4.2 Implement the recurring-update prompt with materiality rules, complete replacement state, no-op invariants, and focused timeline points
- [x] 4.3 Validate model responses, fact and timeline evidence references, state size, and meaningful-update invariants at runtime
- [x] 4.4 Add one bounded repair attempt for malformed model output and fail the run if repaired output remains invalid
- [x] 4.5 Implement normalized state comparison so presentation-only wording changes do not create state versions
- [x] 4.6 Add tests for repeated evidence, corrections, newly discovered older facts, uncertainty resolution, conflicting sources, and irrelevant background

## 5. Tracker Execution

- [x] 5.1 Implement initial tracker execution from discovery through State Version 1 with no timeline points
- [x] 5.2 Implement recurring execution that evaluates only new or updated evidence against the complete Current State
- [x] 5.3 Add per-tracker run locking and scheduling-window idempotency handling
- [x] 5.4 Add bounded retry behavior that reuses cached discovery and retrieval results
- [x] 5.5 Update last-checked, last-changed, next-check, and visible run outcome fields according to run results
- [x] 5.6 Add authenticated backend endpoints for scheduler batches and manual check-now requests
- [x] 5.7 Configure a managed schedule to execute due active trackers while excluding paused trackers

## 6. Tracker APIs

- [x] 6.1 Implement tracker creation with input validation and asynchronous baseline status
- [x] 6.2 Implement tracker list and detail endpoints with current state, timeline, evidence, and latest run status
- [x] 6.3 Implement pause and reactivate endpoints that preserve tracker history and evidence
- [x] 6.4 Add API integration tests for tracker lifecycle, baseline completion, no-change checks, meaningful updates, and failed runs

## 7. Expo Application

- [x] 7.1 Build the Trackers screen with query/title, status, last checked time, and recent meaningful-change indication
- [x] 7.2 Build the New Tracker screen with one natural-language input, examples, validation, and baseline progress feedback
- [x] 7.3 Build Tracker Detail with prominent summary and Current State followed by Timeline and secondary supporting evidence
- [x] 7.4 Display baseline, checked-with-no-change, updated, paused, and failed/retrying states consistently across screens
- [x] 7.5 Add pause, reactivate, manual refresh, navigation, loading, empty, and recoverable error interactions
- [x] 7.6 Verify the core screens on iOS and Android layouts and retain optional responsive web compatibility

## 8. End-to-End Validation and Deployment

- [x] 8.1 Add deterministic fixture-driven end-to-end tests for baseline, repeated evidence, edited sources, and material state changes
- [x] 8.2 Add development inspection for runs, rejected updates, evidence, and State History without making history central to the user UI
- [x] 8.3 Configure production database migrations, backend deployment, secrets, scheduler authentication, and Expo environment settings
- [ ] 8.4 Dogfood at least five diverse real-world trackers and review every accepted and rejected update for relevance and duplication
- [x] 8.5 Document local setup, deployment, operational retry steps, known best-effort coverage limits, and deferred MVP features
