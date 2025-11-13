# Standard Ads VEO3 32s Segmented Flow Plan

## Context & Goals
- Extend `dashboard/standard-ads` so that when users pick `veo3_fast` or `veo3`, they can request up to four 8-second clips that stitch into a single 32-second deliverable.
- Leverage the `FIRST_AND_LAST_FRAMES_2_VIDEO` capability described in `docs/kie/generate_veo3.md` so each 8-second clip accepts both entry and exit frames.
- Mirror the multi-stage orchestration we already ship for Character Ads (`lib/character-ads-workflow.ts`) where multiple video tasks are kicked off, polled, merged, and tracked in Supabase.

## Ideas & Key Constraints
- **Segment-first design**: Treat a 32s request as a collection of 8s segments, each with its own creative prompt and pair of reference frames. This keeps compatibility with current KIE limits and isolates retries to a single segment.
- **Frame chaining**: Generate “first frame” illustrations (cover-quality PNGs) for every planned segment. Use the next segment’s first frame as the previous one’s last frame; only the final segment needs a bespoke closing frame.
- **Prompt continuity**: Reuse the existing `video_prompts` schema but expand it to store per-segment metadata (scene description, dialogue, camera notes) to guarantee tone consistency across clips.
- **Incremental billing**: Charge credits per 8-second KIE task so that 32-second compilations cost 4× the base rate. This keeps the existing `getGenerationCost` infrastructure intact while allowing us to surface “FREE vs paid” messaging per clip.
- **Re-usable merge layer**: Pull the fal.ai merge helpers that Character Ads already rely on (`mergeVideosWithFal`, `checkFalTaskStatus`) into a shared utility (e.g., `lib/video-merger.ts`) so Standard Ads can reuse proven code paths and logging.
- **Progress UX parity**: Expand `GenerationProgressDisplay` to surface segment-level milestones (frames ready → clip rendering → merge) similar to the Character Ads timeline so creators can see which piece is stuck.

## Proposed Architecture Changes

### UX / Dashboard (`components/pages/StandardAdsPage.tsx` + children)
- Gate the “32s mode” behind a new `Segment Builder` panel that becomes active only when `selectedModel` is `veo3` or `veo3_fast`.
- Add duration preset `32s (4 clips x 8s)` that auto-sets `videoDurationSegments=4` while keeping legacy 8/10/15 options for other models.
- Allow optional per-segment notes (e.g., Scene 1: Hook, Scene 2: Feature, etc.) that feed into prompt generation; default to auto-generated structure when left blank.
- Update the composer footer chips to show total credit cost (`segments * costPerSegment`) and warn users when their balance only covers some clips.
- Display merged-video progress states (e.g., "Clip 2/4 rendering", "Stitching clips") with retry CTAs that target the failed segment only.

### Data Model & Persistence
- `standard_ads_projects`
  - Add columns: `is_segmented boolean`, `segment_count integer`, `merged_video_url text`, `segment_plan jsonb` (array of prompts + sequencing metadata), `fal_merge_task_id text`, `segment_status jsonb` (progress snapshots per clip).
- New table `standard_ads_segments`
  - Columns: `id uuid`, `project_id uuid FK`, `index integer`, `first_frame_task_id text`, `first_frame_url text`, `closing_frame_url text`, `video_task_id text`, `video_url text`, `status text`, `error_message text`, `prompt jsonb`, timestamps.
  - Enables webhook lookups by `task_id` without overloading the parent table and lets us retry/update a single segment.

### Workflow & Orchestration (`lib/standard-ads-workflow.ts`)
1. **Request parsing**
   - Accept `segmentCount` (default 1) and `segmentBriefs[]` when `videoModel` is `veo3(_fast)` and `videoDuration==='32'`.
   - Calculate `generationCost = baseCost * segmentCount` and short-circuit if credits insufficient.
2. **Project creation**
   - Store `is_segmented=true`, the serialized plan, and seed `standard_ads_segments` rows (status = `pending_first_frame`).
3. **Frame generation phase**
   - Derive frame prompts per segment (reuse cover prompt builder but tweak instructions for continuity vs hero shot).
   - Kick off one KIE image task per segment; store `first_frame_task_id`.
   - When a frame finishes, persist its URL and immediately trigger the following segment’s first-frame task if we want strict sequencing (or fire them all in parallel and only reuse their outputs later).
4. **Video generation phase**
   - For each segment `i`, call `/api/v1/veo/generate` with `generationType: FIRST_AND_LAST_FRAMES_2_VIDEO`.
   - `imageUrls = [segment[i].first_frame_url, segment[i+1]?.first_frame_url ?? segment[i].closing_frame_url]`.
   - For the final segment, generate a dedicated last-frame image (could reuse existing brand-ending logic or create a simple outro prompt) before calling the API.
5. **Merge phase**
   - After all `video_url`s exist, invoke fal.ai merge (same as Character Ads) and store `fal_merge_task_id` for status polling.
   - Update project + user download surfaces to point to `merged_video_url` once ready.
6. **Failure handling**
   - If a segment fails, mark only that segment as `failed` and keep the project in `requires_action`. Provide resume endpoint so UI can retry the single task without regenerating earlier segments.

### API Surface Updates
- `/api/standard-ads/start` (whatever handler currently wraps `startWorkflowProcess`)
  - Accept new segmentation payload, validate segment counts <=4 when `videoModel` is `veo3(_fast)`.
- `app/api/webhooks/standard-ads/route.ts`
  - Expand lookup logic to search `standard_ads_segments` by `cover_task_id`, `first_frame_task_id`, or `video_task_id`.
  - When a first-frame task completes, transition the segment state and, if applicable, kick off the next dependency.
  - When a video task completes, check whether all segments are done; if yes, enqueue merge job and update parent status to `merging`.
- `app/api/standard-ads/monitor-tasks`
  - Include per-segment polling plus fal.ai merge status, mirroring `processCharacterAdsProject`’s `check_merge_status` branch.
- `app/api/download-video`
  - When `is_segmented`, return merged video URL and optionally the raw clip list for debugging.

### Credit & Billing Considerations
- Update `getGenerationCost` to accept `segmentCount` multiplier for `veo3`/`veo3_fast` requests.
- Persist `credits_cost` as the aggregated total while still allowing refunds per segment if failures occur.
- UI should warn if the user downgrades to fewer clips so we can refund unused segments automatically.

### Observability & Safety
- Tag Segment logs with `projectId/segmentIndex` to simplify Kibana queries.
- Emit PostHog events for `segmented_standard_ad_started`, `segment_completed`, and `segment_failed` with timing metadata.
- Ensure all fal.ai and KIE requests include the same retry envelope / `fetchWithRetry` budget as existing flows.

## Delivery Plan
1. **Schema + Type updates**: Add columns/table via migration, extend Supabase types, and adjust `StandardAdsProject` TS types.
2. **Shared utilities**: Extract video merge helpers and create a `buildSegmentFramePrompt` helper for reuse.
3. **Backend orchestration**: Update `startWorkflowProcess`, background worker, and webhook handler for segmented mode; add retry APIs.
4. **Frontend UX**: Introduce segment builder UI, duration gating, and enhanced progress display.
5. **QA & Telemetry**: Backfill analytics events, add integration tests for segmented payloads, and document operator runbooks in `docs/prompt/stands_ads.md`.

## Open Questions
- What should the scripted narrative template be for four scenes (Hook → Problem → Solution → CTA) and should we allow fewer than four clips under the same 32s preset?
- Do we need a custom outro/brand frame generator for the final segment, or can we reuse the first frame with text overlays?
- Can we reuse Character Ads’ fal.ai credentials/quotas, or do we provision a dedicated key to isolate workloads?
- Should we allow auto-fallback to classic 8s mode when any segment fails repeatedly, or require the user to intervene?
