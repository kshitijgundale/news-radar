## ADDED Requirements

### Requirement: Establish an evidence-backed baseline
The system SHALL create a concise initial summary and Current State from relevant retrieved evidence, persist them as State Version 1, and SHALL NOT create timeline points for the baseline.

#### Scenario: Initial run succeeds
- **WHEN** a tracker completes its first successful evidence evaluation
- **THEN** the system persists State Version 1 with supporting evidence and an empty Timeline

### Requirement: Keep Current State minimal and tracker-relevant
The system SHALL limit Current State to facts that materially help a user understand the present status of the specific situation requested by the tracker, excluding incidental background and redundant facts.

#### Scenario: Evidence contains unrelated background
- **WHEN** a relevant source also contains historical, industry, ownership, or geopolitical context that does not materially answer the tracker
- **THEN** the system excludes that context from Current State

### Requirement: Represent uncertainty explicitly
The system SHALL preserve material uncertainty and disagreement using factual statuses rather than presenting unsupported conclusions as confirmed.

#### Scenario: Credible sources conflict
- **WHEN** new evidence contains materially conflicting claims that cannot be resolved
- **THEN** Current State identifies the affected fact as disputed or uncertain and retains evidence for the conflict

### Requirement: Preserve immutable State History
The system SHALL append a complete immutable State Version only when the normalized Current State or summary materially changes and SHALL retain prior versions.

#### Scenario: State materially changes
- **WHEN** an evaluation produces a materially different Current State
- **THEN** the system appends the next monotonically numbered version and makes it the tracker's current state

#### Scenario: Evaluation confirms existing state
- **WHEN** new evidence does not materially change the current understanding
- **THEN** the system creates no new State Version

### Requirement: Replace rather than accumulate state
The system SHALL treat each State Version as the complete current snapshot, preserving relevant unchanged facts while removing obsolete facts and correcting superseded facts.

#### Scenario: A previously current fact becomes obsolete
- **WHEN** material evidence resolves or supersedes a fact in Current State
- **THEN** the next State Version contains the updated complete snapshot without retaining the obsolete fact as current

