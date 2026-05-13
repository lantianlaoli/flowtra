# Agent Mode Production Readiness Test Plan

## Scope

This document defines the minimum production-readiness gate for the Agent prompt input and canvas mutation experience on `/dashboard/agent`.

The goal is not to prove every future agent workflow is perfect. The goal is to prove the current prompt surface is stable enough for a limited production rollout:

- Prompt input supports realistic user composition.
- Asset and function tokens behave like normal typed content.
- Prompt templates demonstrate supported capability with highlighted asset/function chips.
- Sending a supported prompt creates visible canvas changes.
- Failure and disabled states do not leave the UI stuck.
- The canvas feedback animation starts and stops predictably.

## Test Account

- Clerk user ID: `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
- Browser route: `/dashboard/agent`
- Test date: 2026-05-08
- Source of truth for global test assets: system assets returned by the app APIs and visible in the Agent prompt template menu.

## Baseline Assets

These tests should use system-provided assets so they are available to all users:

### Avatars

- `Lin Yuqing`

### Products

- `Collagen Peptides Jar`
- `Herbal Wellness Pouch`

### Creator Videos

- `CeraVe Hydrating Cleanser`
- `Goli Gummies Men Showcase`
- `Lavalier Mic Showcase`

### Functions

- `Video Clone`
- `Avatar Ads`
- `Motion Clone`
- `Text`

## Minimum Launch Gate

Agent mode is not ready for production unless every P0 and P1 item below passes.

### P0 Blockers

- `/dashboard/agent` loads for the test account without a blocking runtime error.
- The right chat column is not visible; the canvas occupies the main dashboard surface.
- The left vertical node toolbar is visible and usable.
- The bottom prompt input is visible, opaque, and interactive.
- Prompt templates are visible above the prompt input and do not block `+`, `@`, `/`, or send controls.
- `+` opens the asset creation menu above all prompt template chips.
- `@` opens concrete asset choices, not generic asset placeholders.
- `/` opens function choices only.
- Selecting `@` or `/` inserts an inline highlighted token at the current typing position.
- Backspace removes the preceding token when the text cursor is after it.
- Sending a supported prompt creates visible canvas nodes.
- Canvas flow feedback starts immediately on send and stops after the canvas action is applied or after the fallback timeout.
- The send button never remains disabled after a completed prompt unless the input is empty.

### P1 Required

- TikTok links are detected as highlighted chips while submitted text preserves the original URL.
- Prompt textarea auto-grows on multiline text without moving the bottom action row.
- The send button hover morphs from arrow to rocket without changing button size.
- The `+` button has tactile click/open feedback.
- The `+` menu has a visible entrance animation and staggered rows.
- Prompt template clicks inject highlighted asset/function chips, not plain text only.
- Failed agent requests show compact status feedback and do not leave canvas flow running.
- `git diff --check` passes.

### P2 Nice To Have

- Keyboard-only use works for `@`, `/`, arrows, Enter, Escape, Backspace, and send.
- Reduced motion mode disables continuous animations but keeps a static feedback highlight.
- Prompt templates remain visually readable on narrow desktop widths.

## Manual Browser Test Matrix

### T1: Prompt Surface Smoke Test

Steps:

1. Open `/dashboard/agent`.
2. Wait for the canvas and prompt input.
3. Confirm the vertical toolbar, prompt templates, prompt input, `+`, and send button are visible.

Expected:

- No blocking modal or construction overlay.
- The prompt input is opaque and readable.
- The send button is disabled when input is empty.

### T2: Plus Menu Layering

Steps:

1. Click `+`.
2. Confirm the menu shows `Avatar`, `Product`, and `Video`.
3. Confirm the menu is above prompt templates.
4. Click `+` again.

Expected:

- Menu opens and closes without layout shift.
- Prompt templates do not cover the menu.
- Menu item count is exactly 3.

### T3: Asset Token Insertion With `@`

Steps:

1. Type `Create a wellness ad with `.
2. Type `@`.
3. Select `Lin Yuqing`.
4. Type ` for `.
5. Type `@`.
6. Select `Collagen Peptides Jar`.

Expected:

- `Avatar: Lin Yuqing` appears after the first text segment.
- `Product: Collagen Peptides Jar` appears after `for`.
- The tokens do not jump to the beginning.

### T4: Function Token Insertion With `/`

Steps:

1. Continue from T3 or start fresh.
2. Type ` using `.
3. Type `/`.
4. Select `Avatar Ads`.

Expected:

- `Avatar Ads` appears as a highlighted function token at the current typing point.
- Existing text and asset tokens remain in order.

### T5: Prompt Template Chip Injection

Steps:

1. Click `CeraVe style collagen clone`.

Expected:

- The prompt input contains highlighted chips for `Video: CeraVe Hydrating Cleanser`, `Product: Collagen Peptides Jar`, and `Video Clone`.
- It is not plain text only.
- Send is enabled.

### T6: Deterministic Send Creates Canvas Nodes

Steps:

1. Use the `CeraVe style collagen clone` template.
2. Click send.
3. Watch the canvas for generated nodes.

Expected:

- Canvas flow feedback starts immediately.
- Nodes for video, product, text/details, and `Video Clone` appear.
- Canvas flow feedback stops after the nodes appear.

### T7: TikTok Link Highlight

Steps:

1. Paste `https://www.tiktok.com/@flowtra/video/7350000000000000000`.
2. Type ` adapt this for `.
3. Type `@` and select `Herbal Wellness Pouch`.

Expected:

- A TikTok link chip appears.
- The product token appears inline after the typed text.
- The textarea still contains the original URL for submission.

### T8: Multiline Text Stability

Steps:

1. Type a long prompt that wraps to at least three lines.
2. Observe the bottom action row.

Expected:

- Textarea height grows.
- `+` and send controls stay fixed in the bottom row.

### T9: Keyboard Navigation

Steps:

1. Type `@`.
2. Use ArrowDown several times.
3. Confirm the active option scrolls into view.
4. Press Enter.

Expected:

- The highlighted option remains visible while navigating.
- Enter inserts the selected token.

### T10: Error Recovery

Steps:

1. Send a natural-language prompt that the agent may not support.
2. Wait for response or failure.

Expected:

- No infinite loading state.
- Canvas flow feedback stops.
- A compact status note appears if the request fails.

## Automated Checks To Add Before Full Production

- Component or Playwright regression for token order after mixed typing, `@`, and `/`.
- Playwright regression for template injection producing chips.
- Playwright regression for `+` menu layering above prompt templates.
- Playwright regression for deterministic template send creating canvas nodes.
- Reduced motion style assertion for `.project-agent-surface-flowing`.

## Current Readiness Decision Rule

- Internal demo: allowed if T1-T6 pass.
- Limited beta: allowed if all P0 and P1 items pass.
- Full production: requires all P0/P1 items plus automated regressions for the critical prompt paths.

## Test Run Log

### 2026-05-08 Browser Run

Environment:

- Route: `http://localhost:3000/dashboard/agent`
- Test account: `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
- Method: Codex in-app Browser checks against the local dev server.

Results:

| Case | Status | Notes |
| --- | --- | --- |
| T1 Prompt Surface Smoke Test | Partial pass | Prompt, templates, `+`, and send controls were visible. Toolbar detection via text was inconsistent in automation and needs a more stable locator. |
| T2 Plus Menu Layering | Pass | `+` opens 3 menu items. Menu uses `z-[80]` and prompt box uses `z-30`, so it renders above prompt templates. |
| T5 Prompt Template Chip Injection | Pass | `CeraVe style collagen clone` injected highlighted chips for `Video: CeraVe Hydrating Cleanser`, `Product: Collagen Peptides Jar`, and `Video Clone`. |
| T6 Deterministic Send Creates Canvas Nodes | Partial pass | Canvas content contained expected product/function labels after send, but node counting via `.react-flow__node, .xyflow__node` was unreliable in Browser. |
| Canvas Flow Feedback | Fail | Automation consistently observed `.project-agent-surface-flowing` for the first sample only, then it disappeared before the minimum visible feedback window. |

Current decision:

- Internal demo: not cleared by this run because T6 feedback is unstable.
- Limited beta: blocked.
- Full production: blocked.

Blocking follow-up:

- Replace the current timer/class-based canvas flow feedback with a single owner state machine, preferably in `ProjectAgentPage`, where send start, deterministic canvas mutations, streamed tool actions, error, and fallback timeout all transition one explicit status.
- Add a stable `data-testid` contract to the prompt box, vertical toolbar buttons, canvas surface, prompt templates, and canvas nodes so Browser and Playwright assertions do not rely on class names or text snapshots.
- Add a Playwright regression for deterministic template send that verifies the feedback element remains visible for at least 900ms and then clears.
