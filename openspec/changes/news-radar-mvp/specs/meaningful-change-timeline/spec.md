## ADDED Requirements

### Requirement: Distinguish new evidence from new information
The system SHALL create timeline points only when newly processed evidence materially changes what a user following the tracker should currently understand.

#### Scenario: New source repeats a known fact
- **WHEN** a newly discovered source only repeats information represented in Current State
- **THEN** the system records the evidence as processed without changing state or creating a timeline point

#### Scenario: Evidence introduces a material development
- **WHEN** new evidence introduces a development that materially changes Current State
- **THEN** the system updates state and creates an evidence-backed timeline point describing that development

### Requirement: Record corrections and uncertainty changes
The system SHALL treat material corrections, clarifications, newly discovered older facts, and important changes in certainty as eligible timeline changes.

#### Scenario: A material count is corrected
- **WHEN** credible evidence changes a material count represented in Current State
- **THEN** the system corrects the state and creates a timeline point that identifies the clarification

#### Scenario: An uncertain outcome becomes confirmed
- **WHEN** sufficient evidence resolves a material uncertainty in Current State
- **THEN** the system updates the fact status and creates a timeline point for the resolution

### Requirement: Keep timeline points focused
The system SHALL combine related details from one substantive update into one timeline point and SHALL NOT create timeline points for incidental details or presentation-only wording changes.

#### Scenario: One source reports several aspects of one development
- **WHEN** multiple new details jointly describe a single substantive change
- **THEN** the system creates one concise timeline point supported by the relevant evidence

### Requirement: Preserve detection and occurrence times
The system SHALL record when Radar detected every timeline change and SHALL separately record the reported occurrence time when it is available.

#### Scenario: Older event is newly discovered
- **WHEN** Radar discovers a material older fact during a later check
- **THEN** the timeline records the current detection time and the older occurrence time without backdating Radar's knowledge

### Requirement: Cite changes to evidence
The system SHALL associate every timeline point and every newly added or modified state fact with one or more processed evidence records.

#### Scenario: Update output lacks evidence support
- **WHEN** an update proposes a changed fact or timeline point without a valid evidence reference
- **THEN** the system rejects the output instead of persisting the unsupported change

