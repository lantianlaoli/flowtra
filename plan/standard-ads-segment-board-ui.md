# Standard Ads Segment Board UI Plan

This note details the scaffolding needed to render the expandable segment board for the Standard Ads dashboard (`components/pages/StandardAdsPage.tsx`). It is scoped to consuming the enhanced status payload (Step 1) and exposing per-segment summaries + inspector entry points. Actual regen APIs/inspector logic will land in later steps.

## 1. Data Plumbing in `StandardAdsPage`

**Types**
- Extend `StandardAdsStatusPayload.data` with:
  - `segmentStatus?: SegmentStatusPayload | null`
  - `segmentPlan?: { segments?: SegmentPrompt[] } | null`
  - `segments?: Array<{ index: number; status: string; firstFrameUrl?: string | null; videoUrl?: string | null; prompt?: Record<string, unknown> | null; updatedAt?: string | null }>`
- Update `Generation` (from `GenerationProgressDisplay`) or layer a `SegmentedGeneration` union so session state can store `segmentStatus`, `segmentPlan`, and `segmentDetails`.

**State shape**
- Add `segmentStatus?: SegmentStatusPayload | null` and `segments?: SegmentSummary[]` to each `SessionGeneration`.
- `updateGenerationFromStatus()` (lines ~470-550) already merges response data; enhance it to carry over the new fields. Because the poller runs every 8s, ensure merges are immutable and guard against undefined to avoid thrashing.

**Persisted session storage**
- The session storage snapshot (`SESSION_STORAGE_KEY`) should serialize new segment metadata. When removing fields to keep payload light, prefer storing only the latest `segmentStatus` + `segments` array; prompts can be refetched when a card opens if size is a concern.

## 2. UI State & Toggle Mechanics

**UI toggles**
- Introduce `const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);`.
- The progress list currently renders through `GenerationProgressDisplay`. Two options:
  1. Wrap `GenerationProgressDisplay` with a container that renders the progress card plus our new expandable panel.
  2. Fork/extend `GenerationProgressDisplay` to accept a `renderExpandedContent` render prop.
- For MVP, wrap: keep existing component for header/progress; add a caret button at bottom-right labeled “Segment breakdown” visible only when `generation.isSegmented && generation.segmentStatus`.

**Collapse animation**
- Use a simple `div` with Tailwind transitions (`transition-[max-height]`, `overflow-hidden`) to avoid adding new dependencies.
- When expanded, show:
  - Header row (`Shots ready 2/3`, `Videos ready 1/3`, `Last update…`).
  - Grid/list of segment cards.

## 3. Segment Card Component

Create `components/standard-ads/SegmentCard.tsx` (or inline for first iteration). Each card needs:
- Thumbnail: `segment.firstFrameUrl` fallback to skeleton. Use `<div className="aspect-video rounded-lg bg-neutral-100">`.
- Title: derive from `segmentPlan.segments[index]?.segment_title` or fallback `Shot ${index + 1}`.
- Status chip: map `segment.status` to colors (`generating_first_frame`, `first_frame_ready`, `generating_video`, `video_ready`, `failed`).
- CTA button: “Open editor” to launch inspector. Prop-drill `onSelectSegment(projectId, index)`.
- Secondary text: `segment.prompt?.action` or `segment.prompt?.segment_goal` for quick context.

Responsive layout: single column on mobile, 2-column grid on md+, scrollable if >5 shots.

## 4. Inspector Trigger Scaffold

Though inspector implementation is Step 3, we need the plumbing:
- Add `const [inspectorState, setInspectorState] = useState<{ projectId: string; segmentIndex: number } | null>(null);`.
- Segment card CTA sets this state; placeholder modal (e.g., `Dialog` component) can display “Coming soon” copy for now, ensuring event wiring is ready.

## 5. Empty/Error States

- When `generation.segmentStatus?.segments?.length` is 0, render an info banner (“Waiting for segments…”).
- If API errors out (no `segments` but `generation.isSegmented`), show fallback text encouraging refresh.

## 6. Analytics Hooks (optional now)

- Consider firing `posthog.capture('segment_board_opened', { projectId, segments: count })` when panel expands to measure usage.

## Next Actions

1. Update `StandardAdsStatusPayload` + `SessionGeneration` types.
2. Implement `expandedProjectId` toggle UI with placeholder content using real `segmentStatus`.
3. Introduce card component mapping statuses to UI tokens.
4. Wire inspector trigger with placeholder modal (actual editor arrives in Step 3).
