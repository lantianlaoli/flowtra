# Segment Regeneration API Plan

We need backend endpoints that let the inspector update prompts and trigger targeted regeneration flows for a single segment. This document proposes the API shape and the server responsibilities.

## Endpoint Overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/standard-ads/:projectId/segments/:segmentIndex` | `PATCH` | Update prompt JSON for a segment and optionally trigger regeneration for `photo`, `video`, or `both`. |
| `/api/standard-ads/:projectId/segments/:segmentIndex/reset` | `POST` (optional) | Restore prompt to the original `segmentPlan` definition without triggering regen (used for “Reset to competitor shot”). |
| `/api/standard-ads/:projectId/merge` | `POST` (future Step 5) | Signals readiness to merge once every segment video is ready. |

We can implement the reset UI client-side by pulling `segmentPlan`, so the dedicated reset endpoint is optional. The critical piece is the `PATCH` route.

## PATCH Request Schema

```jsonc
{
  "prompt": {
    "first_frame_description": "Highly detailed keyframe description",
    "action": "Talent unboxes the product",
    "style": "Warm lifestyle docu-style",
    "subject": "Parent and toddler",
    "dialogue": "“Morning routines made easy.”",
    "audio": "Light acoustic guitar",
    "composition": "Medium-wide handheld",
    "context_environment": "Sunlit kitchen",
    "camera_motion_positioning": "Slow push-in",
    "ambiance_colour_lighting": "Soft daylight",
    "language": "en",
    "contains_brand": true,
    "contains_product": true
  },
  "regenerate": "photo" | "video" | "both" | "none"
}
```

Rules:
- `prompt` uses the same schema as `SegmentPrompt`; missing fields should default to the previous value (merge instead of replace).
- `regenerate` defaults to `"none"` (just save prompt) if omitted.
- If `regenerate` includes `"photo"`, server should:
  1. Update `standard_ads_segments.prompt`.
  2. Clear `first_frame_url`, `first_frame_task_id`, `closing_frame_url` (if last segment).
  3. Call `createSmartSegmentFrame()` with the updated prompt.
  4. Update `segment_status` via `buildSegmentStatusPayload`.
  5. Record a credit deduction if applicable (`REPLICA_PHOTO_CREDITS`).
- If `regenerate` includes `"video"`, server should:
  1. Reset `video_url`, `video_task_id`, `status` to `generating_video`.
  2. Invoke `startSegmentVideoTask()` with new prompt + first frame.
  3. Update `segment_status`.
  4. Deduct credits if the selected video model requires them.
- Both actions may run sequentially if `"both"`; ensure we await photo result for closing frame URLs before video regen when necessary.

## Response Schema

```jsonc
{
  "success": true,
  "segment": {
    "index": 1,
    "status": "generating_video",
    "firstFrameUrl": null,
    "videoUrl": null,
    "prompt": { ... updated prompt ... }
  },
  "segmentStatus": {
    "total": 3,
    "framesReady": 2,
    "videosReady": 1,
    "segments": [ ... ],
    "mergedVideoUrl": null
  },
  "credits": {
    "deducted": 2,
    "remaining": 98
  }
}
```

Errors should include:
- `400`: invalid prompt schema / missing required fields / `segmentIndex` out of range.
- `403`: project doesn’t belong to user.
- `409`: regeneration already running (prevent duplicate requests).
- `422`: insufficient credits.

## Server Implementation Notes

- Reuse existing helpers:
  - `normalizeSegmentPrompts()` for validation fallback.
  - `createSmartSegmentFrame()` for photo regeneration.
  - `startSegmentVideoTask()` for video regeneration.
  - `buildSegmentStatusPayload()` to refresh project snapshot.
- Wrap credit deductions in transactions: check → deduct → record. If regen fails, refund immediately.
- Emit PostHog events (optional) for telemetry: `segment_regen_photo` / `segment_regen_video`.
- Update monitor cron to recognize user-triggered regenerations (e.g., avoid overriding custom prompts).

## Client Flow Hook-up

1. Inspector modal collects edited prompts.
2. When user clicks regen:
   - Validate fields locally (length, empties).
   - Call `PATCH`.
   - Show spinner + disable buttons until response returns.
3. Poller picks up new status; inspector state refreshes from `segments` array.

This design keeps the regen surface minimal (single endpoint) while allowing future extensions (e.g., multi-field history, undo, etc.).
