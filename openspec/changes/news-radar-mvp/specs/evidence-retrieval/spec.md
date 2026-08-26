## ADDED Requirements

### Requirement: Discover sources semantically
The system SHALL use LLM-powered web search to discover sources relevant to the natural-language tracker during both initial and recurring runs, including news, official pages, announcements, filings, blogs, and public statements where relevant.

#### Scenario: Initial discovery
- **WHEN** a tracker begins its initial run
- **THEN** the system searches for sources semantically relevant to the complete tracker description

#### Scenario: Recurring discovery
- **WHEN** a tracker performs a recurring run
- **THEN** the search incorporates the tracker description, current understanding, unresolved facts, and time since the prior check

### Requirement: Retain source provenance
The system SHALL retain each evidence item's canonical URL, title, publisher or source when available, publication or update time when available, retrieval time, fetch status, and cleaned-content hash when content is retrieved.

#### Scenario: Source content is retrieved
- **WHEN** the backend successfully retrieves and extracts a source
- **THEN** the system stores its provenance, cleaned content, and deterministic cleaned-content hash

#### Scenario: Source retrieval fails
- **WHEN** search discovers a relevant source whose page cannot be retrieved
- **THEN** the system records the failed fetch and may retain search metadata as limited evidence without treating it as strong confirmation

### Requirement: Detect unchanged and edited sources
The system SHALL avoid semantically processing the same canonical URL when its cleaned-content hash is unchanged and SHALL treat a changed hash at the same URL as updated evidence.

#### Scenario: Previously seen page is unchanged
- **WHEN** a fetched canonical URL has the same cleaned-content hash previously processed for the tracker
- **THEN** the system skips semantic update processing for that evidence version

#### Scenario: Previously seen page was edited
- **WHEN** a fetched canonical URL has a different cleaned-content hash from the previously processed version
- **THEN** the system treats the content as updated evidence eligible for evaluation

### Requirement: Reduce exact redundancy without semantic infrastructure
The system SHALL canonicalize URLs and compare cleaned-content hashes before LLM evaluation and SHALL NOT require embeddings, a vector database, or a separate NLI model for MVP deduplication.

#### Scenario: Different URLs expose identical cleaned content
- **WHEN** two candidate sources have the same cleaned-content hash
- **THEN** the system evaluates one content version while retaining appropriate provenance records

