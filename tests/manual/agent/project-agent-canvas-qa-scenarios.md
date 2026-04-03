# Project Agent Canvas QA Scenarios

## Summary

This document defines three manual QA scenarios for `/dashboard/agent`.

The scope is intentionally limited to **conversation -> canvas reaction**.
Do **not** click `Start` and do **not** validate workflow execution, progress, or output videos.

Each scenario validates:

- The agent understands the user's request in canvas-workflow terms.
- The canvas creates or updates the correct asset and feature cards.
- Follow-up messages keep the current canvas coherent instead of rebuilding unrelated flows.

## Shared Validation Rules

For every scenario, record:

- User input
- First assistant reply
- New node types that appear on the canvas
- Whether expected edges are created
- Whether unexpected or duplicate feature nodes appear
- Whether a follow-up request edits the current canvas instead of replacing it

Treat the scenario as failed if any of these happens:

- The assistant only replies in text and the canvas does not change.
- The wrong feature node is created.
- Required asset cards appear without the expected connections.
- A follow-up prompt creates an unrelated duplicate workflow.
- The conversation and visible canvas state drift out of sync.

## Test Account Fixture

The current QA account already exposes the following usable assets:

- Avatars:
  - `Default Male`
  - `Default Female`
  - `Default Founder`
- Products:
  - `red lapel pin`
  - `diet-1`
- Videos:
  - `Decorations 1`
  - `Health Supplements 1`
  - `Health Supplements 2`

Use these exact names in the conversation whenever a scenario needs a specific asset.

## Preconditions

Before each scenario:

1. Open `http://localhost:3000/dashboard/agent`.
2. Start from a fresh session if the current canvas already contains unrelated nodes.
3. Confirm the chat input is enabled and the canvas is interactive.
4. Do not click `Start`.

## Scenario 1: Build a Video Clone Canvas

### Multi-turn Conversation

Turn 1:
`Build a video clone workflow for red lapel pin using Decorations 1 as the reference video.`

Turn 2:
`Keep it focused on the product and do not add any avatar workflow.`

Turn 3:
`If the canvas needs cleanup, only reorganize the current clone setup.`

### Expected Canvas Reaction

1. Turn 1 should be enough to create the workflow without asset-clarification questions, because the product and reference video are explicitly named.
2. The assistant reply should describe creating a clone or video clone workflow, not a generic text-only recommendation.
3. The canvas should show:
   - One `product` node
   - One `video` node
   - One `video_clone` feature node
4. The `product` and `video` nodes should connect to the `video_clone` node through the expected handles.
5. No `avatar_ads` or `motion_clone` feature node should be added.
6. Turn 2 must not replace the clone workflow with another feature type.
7. Turn 3 may reorganize spacing or layout, but it must preserve the existing clone nodes and edges.

### Failure Examples

- The assistant creates `avatar_ads` instead of `video_clone`.
- The `video_clone` node appears without both expected asset inputs.
- Two clone feature nodes are created from one request.
- A later turn wipes the clone canvas or creates an unrelated second workflow.

## Scenario 2: Build an Avatar Ads Canvas

### Multi-turn Conversation

Turn 1:
`Create an avatar ads workflow where Default Male introduces the red lapel pin.`

Turn 2:
`Make it short and premium.`

Turn 3:
`Keep the current avatar ads setup and only refine it. Do not switch to video clone.`

### Expected Canvas Reaction

1. Turn 1 should clearly interpret the request as an avatar-led product promotion workflow.
2. The canvas should show:
   - One `avatar` node
   - One `product` node
   - One `avatar_ads` feature node
3. The `avatar` and `product` nodes should connect to the `avatar_ads` node.
4. Turn 1 should not create a `video_clone` node.
5. Turn 2 should refine the same avatar ads context instead of restarting from scratch.
6. Turn 3 should preserve the existing `Default Male` + `red lapel pin` pairing and must not create a second unrelated workflow.

### Failure Examples

- The assistant creates the wrong feature node.
- The second message creates a second unrelated workflow instead of editing the current one.
- The canvas loses either the avatar node or the product node after the follow-up.
- The assistant asks again for already named assets instead of using `Default Male` and `red lapel pin`.

## Scenario 3: Build and Organize a Motion Clone Canvas

### Multi-turn Conversation

Turn 1:
`Build a motion clone workflow using Default Female, red lapel pin, and Decorations 1.`

Turn 2:
`Keep the product in the workflow and do not turn this into avatar ads.`

Turn 3:
`Clean up and format the canvas.`

### Expected Canvas Reaction

1. Turn 1 should frame the request as a motion clone canvas workflow.
2. The canvas should show:
   - The relevant person/avatar asset node
   - The relevant product asset node
   - The relevant video asset node
   - One `motion_clone` feature node
3. Turn 1 should not add unrelated `video_clone` or `avatar_ads` feature nodes.
4. Turn 2 must keep the existing motion clone context and must not drop the product.
5. Turn 3 should reorganize the existing canvas rather than rebuild it.
6. Existing nodes and edges should still be present after the cleanup request.
7. The visible state after cleanup should be easier to read, with no evidence that the session jumped to an older canvas state.

### Failure Examples

- The cleanup request clears the canvas.
- The cleanup request creates a second motion clone workflow instead of reorganizing the existing one.
- Nodes disappear or detach unexpectedly after the follow-up.
- The assistant asks for asset clarification even though `Default Female`, `red lapel pin`, and `Decorations 1` were already named.

## Pass Criteria

This QA pass succeeds when:

- All three scenarios trigger the correct canvas-oriented response.
- All three scenarios create the correct feature node for the user's intent.
- All three scenarios prove that later turns preserve and refine the current canvas coherently.
- None of the scenarios degrade into text-only replies with no canvas update.

## Optional Debug Notes

If a scenario fails, capture:

- The exact user message
- The visible assistant reply
- A screenshot of the canvas
- Browser console errors, if any
- Relevant network failures for:
  - `/api/project-agent/session`
  - `/api/project-agent/chat`

These notes are diagnostic only and are not required for a pass.
