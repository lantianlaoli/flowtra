# Standard Ads Segment Editing – Implementation Tracker

_Last updated: <!-- date placeholder replaced by actual -->2025-02-14 00:00 UTC_

This document decomposes the new “segment editing + manual merge” feature into concrete steps, records what code surfaces they touch, and captures live progress so the work-in-progress can be resumed tomorrow without context loss.

## Step Breakdown

| # | Status | Scope | Key Files / APIs | Notes & Next Actions |
| --- | --- | --- | --- | --- |
| 1 | ✅ Completed | Extend project status payload to expose `segment_status` + per-segment prompt data so the dashboard can render cards and inspector content. | `app/api/standard-ads/[id]/status/route.ts`, `standard_ads_segments` | Added segment fetch + fallback status builder, returning per-shot prompts and plan data. Dashboard consumers now receive `segmentStatus`, `segmentPlan`, and `segments[]` with URLs/prompts. |
| 2 | **In progress** | Build collapsible segment board UI tied to the enhanced status payload (cards, statuses, CTA entry to inspector). | `components/pages/StandardAdsPage.tsx`, `components/ui/GenerationProgressDisplay.tsx` | Added `SegmentCardSummary` types, persisted segment metadata in state/session, shipped expandable board, wired segment select callback, and introduced a placeholder inspector modal that previews shot details. Next: polish inspector shell + prep for editable prompts. |
| 3 | **In progress** | Implement modal/drawer inspector showing previews + editable prompts. | `components/pages/StandardAdsPage.tsx`, `components/standard-ads/SegmentInspector.tsx` | Built dedicated inspector modal with media previews, editable prompt fields, reset UX, and regen CTA wiring (calls the upcoming PATCH endpoint). Next: polish validation + dirty-state prompts once backend lands. |
| 4 | **In progress** | Create regeneration APIs for first-frame + video and wire up credit checks & task restarts. | `app/api/standard-ads/[id]/segments/[segmentIndex]/route.ts`, `lib/standard-ads-workflow.ts` helpers | Implemented PATCH route that merges prompts, restarts smart-frame/video tasks, and updates `segment_status`. Added credit checks/deductions for photo/video regen. Next: add better error surfaces + guard double-submits. |
| 5 | **In progress** | Add manual merge gate (UI + backend flag) so merging waits for user confirmation. | `app/api/standard-ads/monitor-tasks/route.ts`, new merge API route, `components/pages/StandardAdsPage.tsx` | Authored `plan/standard-ads-merge-gate.md` covering schema flag, API, and UI states. Next: add `awaiting_merge` column + merge endpoint + CTA states. |
| 6 | Not started | QA plan + regression tests (status polling, credit deduction, failure handling). | Cypress/Playwright specs (if available), unit tests for new APIs, manual test checklist | Define fixtures for segmented projects to simulate regen/merge flows; ensure analytics and error tracking capture new actions. |

## Execution Log

- **2025-02-14** – Read through `lib/standard-ads-workflow.ts`, `app/api/standard-ads/monitor-tasks/route.ts`, and `components/pages/StandardAdsPage.tsx` to confirm how segments are created, polled, and merged. Documented findings inside Step 1 notes.
- **2025-02-14** – Implemented Step 1: `/api/standard-ads/[id]/status` now returns `segmentStatus`, `segmentPlan`, and a per-segment array with prompts/URLs when `is_segmented` is true.
- **2025-02-14** – Drafted UI scaffolding plan (`plan/standard-ads-segment-board-ui.md`) outlining data plumbing + component structure for the expandable segment board (Step 2).
- **2025-02-14** – Step 2 progress: updated `StandardAdsPage.tsx` + `GenerationProgressDisplay.tsx` to persist new segment metadata, added expand/collapse state, rendered placeholder cards, and introduced a modal shell that opens from each segment card.
- **2025-02-14** – Step 3 planning: created `plan/standard-ads-segment-inspector.md` covering inspector layout, state, and regen API expectations to guide the next implementation pass.
- **2025-02-14** – Step 3 execution: added `SegmentInspector` component and integrated it into the dashboard with editable prompt inputs + regen button placeholders.
- **2025-02-14** – Step 4 execution: added `/api/standard-ads/:id/segments/:index` PATCH route that merges prompts, restarts KIE tasks, and now enforces credit deductions/refunds for photo + video regenerations.
- **2025-02-14** – Step 5 progress: implemented `/api/standard-ads/:id/merge`, kept monitor in `awaiting_merge` state until user triggers merge, and surfaced the merge CTA in the dashboard.

## Next Session Checklist

1. Finish inspector validation polish (better inline errors, autosave hints) and consider warn-on-close improvements now that limits exist.
2. Harden regeneration endpoint responses (better error surfaces, guard repeated submissions) and bubble errors into the inspector.
3. Outline merge gate UX (button placement + disabled states) ahead of Step 5 work.
