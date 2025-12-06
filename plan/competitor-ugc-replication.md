# Competitor UGC Replication – Implementation Guide

## High-level flow
1. The dashboard page wires up the workflow hook, selectors, and editing tools so users can upload competitor assets, pick their own brand/product, and launch jobs (`components/pages/CompetitorUgcReplicationPage.tsx:1` + `hooks/useCompetitorUgcReplicationWorkflow.ts:1`).
2. `/api/competitor-ugc-replication/create` validates the payload (custom script mode, product/brand linkage, replica mode) and forwards it into the workflow (`app/api/competitor-ugc-replication/create/route.ts:1`).
3. `startWorkflowProcess` in `lib/competitor-ugc-replication-workflow.ts:230` orchestrates Supabase writes, optional competitor-analysis reuse, prompt generation, segmentation math, and KIE task creation.
4. Background monitor cron (`app/api/competitor-ugc-replication/monitor-tasks/route.ts:1`) polls KIE/fal.ai, creates frames via `createSmartSegmentFrame` and videos via `startSegmentVideoTask`, tracks retries, and merges clips if needed.
5. The UI polls `/api/competitor-ugc-replication/[id]/status` and lets users inspect/regenerate individual segments through SegmentInspector and the PATCH route at `/api/competitor-ugc-replication/[id]/segments/[segmentIndex]`.

## Data model & persistence
- `competitor_ugc_replication_projects` tracks the workflow-level state: model choice, prompts, credit spend, segmentation metadata, and merge progress (`lib/supabase.ts:92`).
- `competitor_ugc_replication_segments` stores per-segment prompts, task IDs, keyframe/video URLs, and retry counters for segmented runs (`lib/supabase.ts:134`).
- Supporting tables (`user_products`, `user_brands`, `competitor_ads`) supply product imagery, brand logos, and competitor assets that enrich prompts (`lib/supabase.ts:152`).
- `plan/expect.json:1` defines the canonical output contract we expect from the AI: each plan entry contains `is_continuation_from_prev`, `first_frame_description`, and a `shots[]` array with 8-second coverage broken into precise sub-beats. When `is_continuation_from_prev` is true, the next segment’s first frame must build directly from the previous segment’s first frame description.

## Server workflow details
### Entry point validation
- Credits are checked via `validateKieCredits` before any work starts.
- The API enforces that at least one of `imageUrl`, `selectedProductId`, or `selectedBrandId` exists for context, cleans up optional ad copy, forces replica requests to supply reference images, and normalizes `photoOnly` vs `shouldGenerateVideo` (`app/api/competitor-ugc-replication/create/route.ts:7`).

### `startWorkflowProcess`
- Resolves the canonical product image/logo context by loading `user_products` or `user_brands`, falling back to brand defaults when no product is chosen (`lib/competitor-ugc-replication-workflow.ts:230`).
- Optionally fetches competitor ad metadata plus cached analysis, video duration, and detected language to avoid reprocessing when possible (`lib/competitor-ugc-replication-workflow.ts:363`).
- Converts the user’s “auto” model choice into a concrete model with `getAutoModeSelection`, calculates credit costs, and decides whether the request should be segmented (e.g., Veo3 durations ≥16s or Grok >6s) via `isSegmentedVideoRequest`/`shouldForceSingleSegmentGrok`.
- If needed, calls `analyzeCompetitorAdWithLanguage` (see below) to obtain a structured shot table and detected language, which is later repurposed as a system prompt.
- Generates AI prompts in two passes: (1) competitor analysis and (2) user-brand prompt creation that now must match the `plan/expect.json` schema, including the 8-second shot grids and `is_continuation_from_prev` semantics. The normalized prompts are written to `video_prompts` so downstream editors can reference them (`lib/competitor-ugc-replication-workflow.ts:2140`).
- Initializes segment rows, replaces any prior attempts, and kicks off keyframe generation by calling `createSmartSegmentFrame` per segment. The project row is moved to `generating_segment_frames` with an initial `segment_status` payload for live progress (`lib/competitor-ugc-replication-workflow.ts:2146`).

### Structured plans & segmentation
- `normalizeSegmentPrompts` harmonizes partial prompt payloads into the `SegmentPrompt` shape (including `shots[]` plus `is_continuation_from_prev`) and optionally overrides `contains_brand`/`contains_product` plus indexes with data from competitor shots (`lib/competitor-ugc-replication-workflow.ts:2253`).
- `buildSegmentPlanFromCompetitorShots` compresses arbitrary competitor timelines into the desired segment count and reuses the normalized prompt helper to keep both plan JSON (for UI display) and segment DB rows in sync (`lib/competitor-ugc-replication-workflow.ts:2389`).
- The `plan/expect.json` schema (see above) should be mirrored when updating prompt templates so the monitor and UI can trust fields like `shots[].time_range` when rendering inspectors or enforcing the “8-second per segment” rule.

### Keyframe/video generation
- `createSmartSegmentFrame` chooses between Text-to-Image, product Image-to-Image, or brand-logo Image-to-Image depending on `contains_brand`/`contains_product` flags and available assets, and feeds the previous segment’s first frame as a reference any time `is_continuation_from_prev` is true so multi-shot beats retain the same characters (`lib/competitor-ugc-replication-workflow.ts:2628`).
- `startSegmentVideoTask` stitches the first + optional closing frame into a Veo3 or Grok request, injects narrated dialogue (using ad copy or prompt dialogue), and enforces consistent VO tone across segments (`lib/competitor-ugc-replication-workflow.ts:2698`).
- For non-segmented runs, the workflow either generates the entire video directly or, in replica/photo-only modes, stops after cover generation.

### Background monitoring & retries
- `app/api/competitor-ugc-replication/monitor-tasks/route.ts:17` runs as a cron-friendly route that:
  - Pulls up to 10 inflight projects or a specific `projectId`.
  - Polls KIE tasks for cover frames, segment keyframes, and videos.
  - Calls `createSmartSegmentFrame` or `startSegmentVideoTask` for segments that need requeues, applying retry logic for transient network errors.
  - Checks fal.ai merge status via `checkFalTaskStatus` and writes merge results back to the project row.
  - Updates `segment_status` snapshots via `buildSegmentStatusPayload` so the UI can show per-segment readiness indicators.

### Editing, merging, and status APIs
- `app/api/competitor-ugc-replication/[id]/status/route.ts:1` returns the latest `segmentPlan`, `segmentStatus`, and asset URLs so the UI can render cards and gating CTAs.
- `app/api/competitor-ugc-replication/[id]/segments/[segmentIndex]/route.ts:1` lets users adjust prompts, requeue keyframes/videos, and optionally select extra product references. It enforces credits for each regeneration and guards against concurrent tasks before launching new jobs.
- Manual merging is supported through `/api/competitor-ugc-replication/[id]/merge`, which validates that all segments have finished and then triggers `mergeVideosWithFal` to produce a stitched clip (`app/api/competitor-ugc-replication/[id]/merge/route.ts:1` + `lib/video-merge.ts:1`).
- `/api/competitor-ugc-replication/history` exposes paginated Supabase rows for the History page, while `/api/competitor-ugc-replication/monitor-tasks` is the only route that should run without user context.

### Ancillary AI helpers
- `/api/competitor-ugc-replication/ad-copy` and `/api/competitor-ugc-replication/watermark` both call OpenRouter (Gemini 2.5 Flash by default) to produce marketing text and watermark suggestions, constrained to JSON outputs for deterministic downstream parsing (`app/api/competitor-ugc-replication/ad-copy/route.ts:1`, `app/api/competitor-ugc-replication/watermark/route.ts:1`).
- KIE video prompts now send a structured JSON payload (segment metadata + `shots[]` beats) instead of a single prose string so the API can respect precise timing and continuity cues.
- `/api/competitor-ads/analyze-preview` is the standalone endpoint for analyzing competitor uploads on demand; it reuses `analyzeCompetitorAdWithLanguage` and returns the same schema the workflow expects (`app/api/competitor-ads/analyze-preview/route.ts:1`).

## Prompt requirements & `plan/expect.json`
- Every prompt we send to OpenRouter/KIE should instruct the model to output the `plan/expect.json` schema verbatim:
  - Each `segment` covers the model-specific runtime (Veo3 = 8 seconds, Grok = 6 seconds, etc.) and contains `shots[]` with `time_range`, `audio`, `action`, etc. (see `plan/expect.json:1`).
  - `is_continuation_from_prev` determines whether the current segment reuses the previous first frame; when `true`, we pass the prior frame URL back to KIE so frame generation literally builds on it.
  - `shots` need to divide the 8 seconds into logical mini-beats (e.g., 2 × 4-second chunks or 4 × 2-second beats) because SegmentInspector surfaces these as editable cues.
  - Include `contains_brand` and `contains_product` flags within each prompt payload so `createSmartSegmentFrame` can decide which asset pipeline to hit.

## Client experience
- `useCompetitorUgcReplicationWorkflow` manages uploads, guest limits, job submission, and per-project polling state (history IDs, workflow step, credits) for the dashboard (`hooks/useCompetitorUgcReplicationWorkflow.ts:38`).
- `CompetitorUgcReplicationPage` wires together selectors (platform, brand/product, competitor ad, requirements), configuration popovers, and the `GenerationProgressDisplay`. It also renders the `SegmentInspector` modal for plan/prompt editing and handles manual merge/regeneration actions (`components/pages/CompetitorUgcReplicationPage.tsx:1`).
- `SegmentInspector` presents the normalized plan + real generation output side-by-side, enables per-field edits with validation (including editing every shot beat + toggling `is_continuation_from_prev`), fetches additional product references for the linked brand, and triggers PATCH calls for either keyframe or video regeneration (`components/competitor-ugc-replication/SegmentInspector.tsx:1`).
- `GenerationProgressDisplay` and `CompetitorUgcReplicationRecentList` show progress bars, CTA buttons, and historical assets to keep users informed while monitor-tasks runs in the background.

## External services & configuration
- **OpenRouter (Gemini 2.5 Flash by default)**: used for competitor analysis, ad copy, watermark guidance, and any plan-generation prompt. Requires `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- **KIE API**: handles both image/keyframe generation (`api.kie.ai/api/v1/jobs/createTask`, `IMAGE_MODELS`) and Veo/Grok video generation (`api.kie.ai/api/v1/veo/generate`). Keys live in `KIE_API_KEY`.
- **fal.ai Merge API**: merges segmented clips, configured through `FAL_KEY`.
- **Supabase**: stores everything, using `getSupabase` on the client and `getSupabaseAdmin` on the server.
- Mandatory env vars are outlined in `AGENTS.md`, and the local dev flow still depends on `pnpm`.

## Implementation notes
- Always update `plan/expect.json` plus this document when evolving the prompt contract so both backend prompt builders and the UI stay aligned.
- When `is_continuation_from_prev` is true, make sure prompt templates mention the prior segment’s first frame explicitly—the downstream frame generator assumes it should recompose the opening pose from the previous description before applying any new motion.
- Any new API or workflow extension should integrate with `monitor-tasks` rather than introducing polling loops elsewhere; the hook intentionally avoids periodic fetches to keep the dashboard lightweight.
- Before shipping prompt changes, regenerate a few sample projects and verify `segment_plan` entries in Supabase adhere to the new schema, since both SegmentInspector and the fal.ai merge path rely on consistent `segment_index` ordering and `shots[]` durations.
