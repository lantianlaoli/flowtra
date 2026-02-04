## ADDED Requirements
### Requirement: Conversational project agent
The system SHALL provide a chat-based flow that identifies the target Flowtra feature intent, collects required inputs, and guides users through prompt review followed by generation.

#### Scenario: Intent detection and input collection
- **WHEN** a user requests to create a video in chat
- **THEN** the system asks for feature-specific required details until required fields are complete

#### Scenario: Image prompt review before video generation
- **WHEN** the system generates the image prompt draft
- **THEN** the user can edit or confirm it before video generation begins
