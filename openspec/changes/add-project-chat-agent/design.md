## Context
We need a conversational experience for the full Flowtra project scope while preserving the existing event-driven workflows and avoiding changes to core generation logic.

## Goals / Non-Goals
- Goals: add a chat UI that collects inputs, supports edits, and triggers the appropriate existing workflow via existing APIs.
- Non-Goals: change workflow internals or add polling.

## Decisions
- Decision: use Vercel AI SDK for chat streaming and tool calling in Next.js App Router.
- Decision: keep orchestration server-side; route to existing feature endpoints based on detected intent.
- Decision: persist chat session state in Supabase for continuity across reloads.

## Risks / Trade-offs
- Risk: prompt drift or incomplete input collection -> Mitigation: strict schema for required fields and explicit confirmation before execution.

## Migration Plan
- Add new dashboard route as a project-level entry point.
- No data migration required.

## Open Questions
- Should we also persist full chat transcripts for audit, or only structured state?
