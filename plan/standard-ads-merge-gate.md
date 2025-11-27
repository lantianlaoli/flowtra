# Manual Merge Gate Plan

The current cron merges segment videos automatically once every segment has a `video_url`. We want a user-controlled “Merge Final Video” action in the dashboard. This doc outlines the backend + UI adjustments required.

## Desired Behavior
1. Progress bar shows a disabled merge CTA until `segmentStatus.videosReady === total`.
2. Once all segments are ready, the button becomes primary. User must click it to kick off the fal.ai merge.
3. While merge runs, the UI shows a “Merging…” state.
4. When merge finishes, the CTA becomes “Download merged video” (current behavior).

## Backend Changes

### Schema / flags
- Add boolean column `awaiting_merge` (default `false`) to `standard_ads_projects`. When true, monitor job should not trigger merge automatically.
- Alternatively, reuse `current_step` states; set `current_step = 'awaiting_merge'` when videos are ready but not merged.

### API
- `POST /api/standard-ads/:id/merge`
  - Validates ownership, checks that `segment_status.videosReady === total`.
  - Sets `awaiting_merge = false`, kicks off `mergeVideosWithFal` (same helper used by cron).
  - Returns task id / status.
- Monitor task (`app/api/standard-ads/monitor-tasks/route.ts`) adjustments:
  - When `videosReady` is true but `awaiting_merge` is false, current logic auto-merges. We need to gate it:
    - If `awaiting_merge` is true → skip merge.
    - If `awaiting_merge` is false but `user_merge_requested_at` exists (set by API) → proceed.
  - Update `segment_status.mergedVideoUrl` once merge completes.

## UI Changes (StandardAdsPage)
- Add a merge CTA near the progress bar summary (right edge).
- CTA states:
  - Disabled w/ tooltip: “Segments still rendering (3/5 ready)”
  - Primary button: “Merge Final Video” → calls merge API.
  - During request: show spinner + “Merging…”.
  - After success: replace button with success badge linking to `merged_video_url`.
- Should rely on `segmentStatus` fields returned by `/api/standard-ads/:id/status`.

## Telemetry / Safety
- Capture PostHog events: `standard_ads_merge_requested`, `standard_ads_merge_completed`.
- Handle fal merge failures by surfacing error in UI and allowing retry.

## Next Steps
1. Add `awaiting_merge` column + update monitor logic.
2. Implement merge API route.
3. Add CTA + states in dashboard.
