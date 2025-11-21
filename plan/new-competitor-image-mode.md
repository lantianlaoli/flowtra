# Competitor Photo Replica Mode Plan

## 1. Detect & Gate Competitor Photo Mode
- Derive `isCompetitorPhotoMode` when `selectedCompetitorAd?.file_type === 'image'`.
- Lock workflow into `photoOnly` image generation when this flag is true.
- Hide/disable video-specific controls (duration, model, Grok tips) and force image model to Nano Banana Pro.
- Ensure validation requires a brand, selected product(s), and competitor photo before enabling generation.

## 2. UI Adjustments & Inputs
- Add a "Replica Photo" configuration panel that appears only in competitor photo mode:
  - Competitor asset preview pinned as the first slot.
  - Aspect ratio selector using Nano Banana Pro ratios (1:1, 2:3, …, 21:9).
  - Resolution selector (1K / 2K / 4K) + optional output format toggle (PNG/JPG).
  - Reference asset picker listing brand logo (if available) plus all user product photos; allow multi-select up to 9 additional images (KIE limit is 10 total inputs including competitor photo).
  - Display selection counter (e.g., `1/10` base + user picks).
- Disable/remove video CTA copy (“Generate video”) and replace with image-specific messaging (“Generate replica photos”).

## 3. State Management & Validation
- Track new states: `photoAspectRatio`, `photoResolution`, `photoOutputFormat`, `selectedReferenceAssets`.
- Default aspect ratio to match competitor metadata when possible; otherwise fallback to 9:16.
- Enforce at least one user-selected asset (brand logo or product photo). Show inline validation if none selected.
- When competitor ad changes, reset reference selections and state to ensure the first slot is always the competitor image.

## 4. Workflow Invocation Changes
- Extend `startWorkflowWithSelectedProduct` signature to accept:
  - `photoOnly` boolean, `referenceImageUrls: string[]`, `photoAspectRatio`, `photoResolution`, `photoOutputFormat`, and a `replicaMode` flag.
- When competitor photo mode is active:
  - `shouldGenerateVideo = false`, `photoOnly = true`.
  - Use Nano Banana Pro as `imageModel`.
  - Pass ordered inputs: `[competitorPhotoUrl, ...selectedReferenceAssets.slice(0, 9)]`.
- Update `/api/standard-ads/create` validation to ensure these fields exist when `replicaMode` is true.

## 5. Constants & Pricing Updates
- Add `nano_banana_pro` to `IMAGE_MODELS`, supported sizes, and type unions.
- Add a new CREDIT entry (24 credits) for this mode to `lib/constants.ts`.
- Update pricing UI to mention “Replica Photo (Nano Banana Pro) – 24 credits per generation, downloads free”.

## 6. Backend Workflow Adjustments
- Extend `StartWorkflowRequest` with new fields: `referenceImageUrls`, `photoAspectRatio`, `photoResolution`, `photoOutputFormat`, `replicaMode`.
- In `startWorkflowProcess`:
  - Detect replica mode (photoOnly + competitor image).
  - Fetch competitor analysis: if `analysis_result` exists on the stored competitor ad, reuse it; otherwise run `analyzeCompetitorAdWithLanguage` and persist the result for future requests (same behavior as video workflow).
  - Deduct 24 credits upfront regardless of video model.
  - Build prompt emphasizing exact scene recreation, referencing competitor analysis data plus user-selected brand/product context.
  - Call a new helper (e.g., `generateReplicaPhoto`) that invokes the Nano Banana Pro API with `image_input` array (competitor + user assets) and user-selected aspect ratio/resolution/output.
  - Store returned `taskId` in `cover_task_id` and set `photo_only = true`.

## 7. Monitoring & Output Handling
- Reuse existing `photo_only` path in `/api/standard-ads/monitor-tasks`; `checkCoverStatus` already handles Nano Banana responses.
- Ensure the result surfaces under history entries with a “Replica Photo” badge (optional future polish).
- No download billing adjustments required (downloads remain free).

## 8. Testing & Verification
- Manual QA: choose competitor image, pick products/logos, generate; ensure workflow completes with a cover image only.
- Verify credit deduction (24 credits) and refund path on failures.
- Confirm UI disables video controls and enforces asset selection limits.
- Update docs or tooltips describing the new flow for clarity.
