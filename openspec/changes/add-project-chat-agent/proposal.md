# Change: Add conversational project agent

## Why
Users want a universal project chat agent that can guide creation flows across Flowtra features, instead of being limited to Avatar Ads.

## What Changes
- Add a new dashboard page for a conversational project agent
- Introduce a chat agent using Vercel AI SDK that collects required inputs and routes to the appropriate workflow, persisting session state in Supabase
- Reuse existing workflow APIs; only orchestration and UI change

## Impact
- Affected specs: project-agent
- Affected code: dashboard route, new chat UI components, new chat API endpoint
