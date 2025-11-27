# Standard Ads Segment Inspector Plan

Goal: convert the existing placeholder modal into a full editor where users can preview assets, edit prompts, and trigger regen flows for first-frame photos and videos.

## Layout Overview

- **Shell**: full-screen modal (overlay) split into left/right panes. Sticky header shows “Segment X (Shot title)” plus status chips and metadata (brand, duration).
- **Left pane (media)**:
  - First-frame viewer with swap history (current + last render) and quick actions (open in new tab, download, copy URL).
  - Video player area (if `videoUrl` exists) with regen progress indicator when pending.
  - Placeholder states for “Regenerating…” or “Not generated yet”.
- **Right pane (prompts & actions)**:
  - Two collapsible sections:
    1. **Photo prompt** – text area seeded from `segment.prompt.first_frame_description`. Includes token count + limit (5000 chars). “Reset to original competitor shot” button pulls from `segmentPlan`.
    2. **Video prompt** – structured fields for action, subject, style, dialogue, etc. (map from `SegmentPrompt`).
  - Validation summary highlighting missing required fields.
  - CTA footer with:
    - “Regenerate First Frame” (uses edited photo prompt).
    - “Regenerate Video” (uses full prompt object).
    - Buttons disabled if nothing changed or regen already in-flight. Each shows credit cost context.

## Data Requirements

- `segment.prompt` (mutable JSON).
- `segmentPlan.segments[segmentIndex]` for reset defaults.
- `segmentStatus` for current progress & merge readiness.
- Additional metadata to display:
  - `segment.updatedAt`
  - `projectId`, `videoModel`, `videoDuration`, `segmentDurationSeconds`

## State & Hooks

- `segmentInspector` state should track:
  - `projectId`, `segmentIndex`, `generationId`.
  - Local copies of photo/video prompts, dirty flags, and API states (`isRegeneratingPhoto`, `isRegeneratingVideo`).
- Add `useEffect` to refresh inspector data when polling updates deliver new `segments`.
- Use `useDebouncedValue` (if available) or manual `setTimeout` to throttle autosave preview of prompts before regen.

## API Contracts (preview)

- `PATCH /api/standard-ads/:projectId/segments/:segmentIndex` with payload:
  ```json
  {
    "prompt": {
      "first_frame_description": "…",
      "action": "…",
      "...": "..."
    },
    "regenerate": "photo" | "video" | "both"
  }
  ```
- Server should:
  1. Validate ownership.
  2. Update `standard_ads_segments.prompt`.
  3. Reset relevant URLs/task IDs.
  4. Kick off `createSmartSegmentFrame` or `startSegmentVideoTask`.
  5. Return updated `segment_status`.

## UX Details

- Warn before closing when prompts are dirty but not regenerated.
- Surface inline errors from regen API (credit issues, validation failures).
- Allow keyboard shortcuts (`Cmd+Enter` to trigger focused regen button).
- Show merge banner when all videos ready but merge not triggered.

## Next Work Items

1. Build modal component skeleton with media/prompt sections.
2. Wire inspector state to real segment data (including resets when poll updates).
3. Implement local validation + button enablement logic.
4. Hook up backend regen endpoints once defined (Step 4).
