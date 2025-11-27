# Standard Ads Segment Editing UX Notes

## Grounding in the Existing Workflow
- `lib/standard-ads-workflow.ts` inserts a `standard_ads_projects` row inside `startWorkflowProcess()` and, for segmented durations, hydrates `standard_ads_segments` via `startSegmentedWorkflow()`. Each row stores the serialized `SegmentPrompt` JSON at `prompt` and starts first-frame/closing-frame tasks with `createSmartSegmentFrame()`.
- The monitoring cron (`app/api/standard-ads/monitor-tasks/route.ts`) advances each shot from `pending_first_frame → first_frame_ready → generating_video → video_ready` and continuously rebuilds `segment_status` using `buildSegmentStatusPayload()`. Once every segment has `video_url`, it automatically calls `mergeVideosWithFal()` and marks the project `completed`.
- The dashboard UI (`components/pages/StandardAdsPage.tsx`) polls `/api/standard-ads/[id]/status` (currently missing `segment_status` + prompts), renders a single progress bar, and never surfaces per-segment detail. There is no concept of user-triggered merge or re-render.
- Editing must therefore plug into real tables (`standard_ads_segments`, `standard_ads_projects`) and orchestrators (e.g., `startSegmentVideoTask()` / `createSmartSegmentFrame()`) instead of inventing new storage.

## Target UX Journey
1. **Keep the top progress bar** – it continues to summarize project health for segmented replica runs. A small caret/“View segments” affordance on the right toggles a collapsible region directly below the bar.
2. **Segment board** – the expanded region lists cards sorted by `segment_index`. Each card shows the current first-frame thumbnail (if any), the derived step title (e.g., “Shot 2 · Hook with self-care ritual”), and a status chip mapped from `standard_ads_segments.status` (pending photo, photo ready, video running, failed, etc.) so users see the same lifecycle our cron writes today.
3. **Floating inspector** – clicking a card launches a centered modal (or large drawer for smaller screens). Layout:
   - **Left column**: visual focus. Top block shows the latest first-frame image with “Generated X min ago” metadata and a skeleton state while `first_frame_url` is null or currently regenerating. Bottom block either plays the `video_url` (when ready) or surfaces the queued status/error with retry copy. Both blocks share actions for “Open in new tab” and “Download asset”.
   - **Right column**: editable prompts. We split the stored `SegmentPrompt` into a “First-frame prompt” editor (driven by `first_frame_description`) and a “Video prompt” editor (grouped controls for action, subject, style, dialogue, etc.). Inline helper text clarifies that these values were inherited from the competitor analysis plus brand overrides inside `normalizeSegmentPrompts()`.
4. **Explicit regen buttons** – under each editor we surface “Regenerate First Frame” and “Regenerate Video”. Pressing one:
   - Validates the edited prompt, sends a PATCH to `/api/standard-ads/{projectId}/segments/{segmentIndex}` that updates `standard_ads_segments.prompt`, resets the relevant URLs/task IDs, reuses `createSmartSegmentFrame()` or `startSegmentVideoTask()` to queue a fresh job, and marks status back to `generating_*`.
   - Locks the corresponding preview with a spinner and disables conflicting actions until the poller reports the new result.
   - Deducts credits using the same helpers the initial workflow used (`checkCredits`, `deductCredits`, `recordCreditTransaction`) so billing stays consistent.
5. **Manual merge gate** – Instead of letting the monitor merge immediately once every `video_url` exists (current behavior at `processSegmentedRecord()`), we expose a “Merge Final Video” CTA on the right edge of the progress bar. The button stays disabled with a tooltip until `videosReady === total`. Clicking it calls a new API that flips a `ready_to_merge` flag and triggers `mergeVideosWithFal()` to stitch the clips. Only after this call do we set `merged_video_url` + `video_url` on the project, so users can iterate freely beforehand.

## Detailed UX States
- **Progress overview**: We continue to map backend statuses (`generating_segment_frames`, `generating_segment_videos`, `merging_segments`) to friendly copy via the existing `STATUS_MAP` in `StandardAdsPage.tsx`. When the panel is expanded the same progress data populates small badges inside each card.
- **Cards**: Each card contains: order number, short label from `segment_title`/`segment_goal` (derive from prompt fields or fallback to “Shot N”), readiness summary (photo ready / video queued / failed), and quick actions (“Edit”, “Preview”). Failed states borrow the red tones we already use for other workflow errors.
- **Inspector editing**:
  - We show live validation feedback (e.g., “Prompt exceeds 5k characters, matching `KIE_PROMPT_LIMIT` from `lib/standard-ads-workflow.ts`”) so users understand constraints we already enforce server-side.
  - Buttons display credit cost (“Uses 1 photo credit” vs. “Uses video credits based on current model/duration”) derived from `getGenerationCost()` and `REPLICA_PHOTO_CREDITS`.
  - On close with unsaved changes (text mutated but regen not triggered) we prompt for confirmation; once regeneration has been submitted the modal simply reflects backend status updates from polling.
- **Polling & refresh**: The existing 8s poll per project remains; we extend `/api/standard-ads/[id]/status` to return `segment_status` and optionally the slices of `standard_ads_segments.prompt` so the UI has a single source of truth. No sockets needed initially.
- **Manual merge visuals**: When every segment video is marked ready, the right-most progress node animates and the “Merge Final Video” button becomes primary. After merge completes, we swap it for a success pill that links to the combined `video_url`.

## Implementation Hooks (for future reference)
- **API extensions**:
  1. `GET /api/standard-ads/{id}/status` → include `segment_status` and latest prompts for each index (read directly from `standard_ads_segments` and `segment_plan`).
  2. `PATCH /api/standard-ads/{id}/segments/{index}` → validates ownership, updates the stored prompt JSON, resets URLs/task IDs, re-queues generation, and rebuilds `segment_status` via `buildSegmentStatusPayload()`.
  3. `POST /api/standard-ads/{id}/segments/{index}/regenerate-photo` + `/regenerate-video` (optional split) if we want more granular auditing, each invoking `createSmartSegmentFrame()` or `startSegmentVideoTask()` after credit checks.
  4. `POST /api/standard-ads/{id}/merge` → sets a `waiting_for_merge` flag that `processSegmentedRecord()` respects before calling `mergeVideosWithFal()`. We can reuse the existing Fal polling logic once the flag is true.
- **State machine tweaks**: Add new statuses such as `awaiting_merge` on the project and `needs_review` on segments when user edits before regen. Ensure `processSegmentedRecord()` no longer jumps straight to merge unless the project indicates user approval.

## Open Questions
- Should we keep historical renders per segment so users can roll back, or will we overwrite assets in-place?
- How do we throttle simultaneous regen requests so credit deductions remain predictable (e.g., limit to one active photo + one active video regen per segment)?
- Do we need collaboration affordances (comments, approvals) before unblocking merge?

This UX plan is grounded in the current code paths (`lib/standard-ads-workflow.ts`, `app/api/standard-ads/monitor-tasks/route.ts`, and `components/pages/StandardAdsPage.tsx`) and focuses on layering an intuitive editing surface without rewriting the core pipeline. The expanded panel + inspector give users confidence in each shot before they choose to merge the final output.
