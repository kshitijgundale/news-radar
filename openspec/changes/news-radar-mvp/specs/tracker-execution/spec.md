## ADDED Requirements

### Requirement: Execute initial and recurring workflows
The system SHALL execute an initial baseline workflow for a new tracker and a recurring comparison workflow for subsequent checks using the same persisted tracker context.

#### Scenario: New tracker is checked
- **WHEN** execution begins for a tracker without a State Version
- **THEN** the system runs discovery, retrieval, and initial-state generation

#### Scenario: Existing tracker is checked
- **WHEN** execution begins for a tracker with a current State Version
- **THEN** the system retrieves new or updated evidence and evaluates it against the complete current state

### Requirement: Make one semantic update decision
The system SHALL use one structured recurring-update decision to determine materiality, return the complete resulting state, and return only newly surfaced timeline points.

#### Scenario: Decision reports no meaningful update
- **WHEN** the validated decision sets `meaningful_update` to false
- **THEN** it preserves the existing summary and state, returns no timeline points, and marks the evidence processed

#### Scenario: Decision reports a meaningful update
- **WHEN** the validated decision sets `meaningful_update` to true
- **THEN** the system atomically persists the replacement state, next State Version, timeline points, and evidence links

### Requirement: Validate model outputs
The system SHALL validate structured initial and update outputs before persistence and SHALL perform at most one repair retry for malformed output.

#### Scenario: Output violates the contract
- **WHEN** the model response fails runtime schema or invariant validation
- **THEN** the system requests one repaired response and fails the run if the repaired response remains invalid

### Requirement: Prevent concurrent and duplicate runs
The system SHALL allow no more than one active execution per tracker and SHALL use an idempotency key for scheduled execution windows.

#### Scenario: Concurrent trigger targets a running tracker
- **WHEN** a second trigger attempts to execute a tracker with an active locked run
- **THEN** the system does not start another evaluation

#### Scenario: Scheduled window is delivered twice
- **WHEN** the scheduler repeats a trigger with the same tracker and scheduling-window key
- **THEN** the system reuses or reports the existing run rather than creating a duplicate

### Requirement: Schedule active trackers on the backend
The system SHALL periodically select due active trackers for execution on backend infrastructure and SHALL exclude paused trackers.

#### Scenario: Active tracker becomes due
- **WHEN** an active tracker's next-check time is reached
- **THEN** the scheduler initiates an idempotent tracker run

### Requirement: Cache work and expose run outcomes
The system SHALL preserve reusable search and retrieval results across bounded retries and SHALL distinguish baseline, no-change, changed, and failed outcomes to clients.

#### Scenario: Transient failure occurs after retrieval
- **WHEN** a retryable failure occurs after source content was successfully retrieved
- **THEN** the retry reuses cached source results rather than fetching unchanged content again

#### Scenario: Completed run has no meaningful change
- **WHEN** a recurring evaluation completes without a state change
- **THEN** the system updates the last-checked time while leaving last-changed time unchanged

