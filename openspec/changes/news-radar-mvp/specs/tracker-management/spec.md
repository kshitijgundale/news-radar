## ADDED Requirements

### Requirement: Create a natural-language tracker
The system SHALL allow a user to create a tracker from a non-empty natural-language description without requiring keywords, categories, Boolean syntax, or a predefined schema.

#### Scenario: Valid tracker submission
- **WHEN** the user submits a natural-language situation description
- **THEN** the system creates an active tracker and begins establishing its initial baseline

#### Scenario: Empty tracker submission
- **WHEN** the user submits an empty or whitespace-only description
- **THEN** the system rejects the submission and prompts for a situation to track

### Requirement: List trackers with actionable status
The system SHALL list the user's trackers with their title or query, active status, last-check status, and an indication of whether a meaningful change was recently detected.

#### Scenario: Tracker has not completed its baseline
- **WHEN** a newly created tracker appears in the list before its initial run completes
- **THEN** the list identifies that tracker as establishing its baseline

#### Scenario: Completed check had no change
- **WHEN** a recurring check completes without a meaningful update
- **THEN** the list shows the latest check time without marking the tracker as changed

### Requirement: View tracker details
The system SHALL present the original query, lifecycle status, last checked time, current summary, Current State, Timeline, and supporting evidence for a selected tracker, with Current State more prominent than evidence.

#### Scenario: User opens a tracker
- **WHEN** the user selects a tracker from the tracker list
- **THEN** the system displays its latest persisted detail and execution status

### Requirement: Control tracker activity
The system SHALL allow a user to pause and reactivate a tracker without deleting its State History, Timeline, or evidence.

#### Scenario: User pauses a tracker
- **WHEN** the user pauses an active tracker
- **THEN** the tracker is excluded from scheduled checks while its existing data remains available

#### Scenario: User reactivates a tracker
- **WHEN** the user reactivates a paused tracker
- **THEN** the tracker becomes eligible for future scheduled checks

