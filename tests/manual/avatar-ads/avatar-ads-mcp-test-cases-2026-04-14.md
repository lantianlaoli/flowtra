# Avatar Ads MCP Test Cases (2026-04-14)

## Scope
- Surface: `http://localhost:3000/dashboard/avatar-ads`
- Method: Chrome MCP interactive test + network inspection
- Goal: Validate Seedance 2 migration behavior and basic create-flow contract

## Test Cases

1. Page load and navigation
- Steps:
  - Open `/dashboard/avatar-ads`
  - Verify left navigation and page controls render
- Expected:
  - Page loads without crash
  - `Character`, `Product`, script box, `Config`, `Start` controls are visible

2. Character dropdown and system avatars
- Steps:
  - Click `Character`
- Expected:
  - Dropdown opens with built-in avatars:
    - `Default Male`
    - `Default Female`
    - `Default Founder`

3. Start button state transition
- Steps:
  - Without selecting character, verify `Start` is disabled
  - Select `Default Female`
- Expected:
  - `Start` becomes enabled

4. Default model request contract
- Steps:
  - Fill script
  - Click `Start`
  - Inspect `POST /api/avatar-ads/create` request payload in DevTools network
- Expected:
  - FormData includes `video_model=seedance_2_fast`
  - FormData includes `video_aspect_ratio=9:16` (default portrait)

5. Flexible duration acceptance for Seedance models
- Steps:
  - Trigger create request with UI-provided `video_duration_seconds=15`
- Expected:
  - API should not reject duration as invalid
  - Request proceeds to workflow enqueue state

## MCP Execution Notes
- Executed with Chrome MCP on `http://localhost:3000/dashboard/avatar-ads`.
- Observed results:
  - Page renders correctly with avatar ads controls.
  - Character dropdown opens and shows system avatars (`Default Male`, `Default Female`, `Default Founder`).
  - `Start` is disabled before selecting avatar and enabled after selecting `Default Female`.
  - Create request payload confirms:
    - `video_model=seedance_2_fast`
    - `video_duration_seconds=15`
    - `video_aspect_ratio=9:16`
  - Previous immediate `400 Invalid video duration` regression no longer reproduced in the follow-up run.
- Code change applied:
  - Duration options expanded to `4..60` in `lib/avatar-ads-dialogue.ts` to align frontend snapping and backend validation for Seedance models.

## Regression Targets
- `tests/unit/avatar-ads-model-contract.test.ts`
  - Asserts active model lineup is only `seedance_2_fast | seedance_2 | kling_3`
  - Asserts pricing per second (`33/41`)
  - Asserts avatar duration options include `15` and span `4..60`
  - Asserts duration snapping behavior for Seedance models
