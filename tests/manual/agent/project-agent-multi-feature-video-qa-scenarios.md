# Project Agent Multi-Feature Video QA Scenarios

## Summary

This document defines manual QA scenarios for `/dashboard/agent` that focus on a single reference video being reused across multiple conversation turns to create different feature nodes on the canvas.

The goal is to verify that the agent can:

- Keep one named video in context across multiple turns.
- Materialize different workflow types around that same video.
- Preserve earlier graph structure without confusing feature intent.

This pass is limited to **conversation -> canvas reaction**.
Do **not** click `Start` and do **not** validate execution, progress, or output media.

## Shared Validation Rules

For every scenario, record:

- The exact user message for each turn
- The visible assistant reply after each turn
- Which new nodes appear after each turn
- Whether the named video stays attached to the correct workflow
- Whether the agent creates the correct feature node for that turn
- Whether earlier nodes remain coherent after later turns

Treat a scenario as failed if any of these happens:

- The assistant replies in text only and the canvas does not change.
- The named video is ignored or replaced without the user asking for it.
- The wrong feature node appears for the turn's intent.
- A later turn destroys or corrupts previously created nodes unexpectedly.
- The agent keeps asking for the same named video again after it was already resolved.

## Test Account Fixture

The current QA account exposes these visible assets:

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

Use these exact names in the prompts.

## Preconditions

Before each scenario:

1. Open `http://localhost:3000/dashboard/agent`.
2. Start from a fresh session with an empty canvas.
3. Confirm the chat input is enabled and the canvas is interactive.
4. Do not click `Start`.

## Scenario 1: Reuse One Video Across Video Clone and Motion Clone

### Multi-turn Conversation

Turn 1:
`Build a video clone workflow for red lapel pin using Decorations 1 as the reference video.`

Turn 2:
`Now use the same video to add a motion clone workflow for Default Female and keep the red lapel pin in the canvas.`

Turn 3:
`Clean up the canvas but keep both workflows.`

### Expected Canvas Reaction

1. Turn 1 should create:
   - one `video` node for `Decorations 1`
   - one `product` node for `red lapel pin`
   - one `video_clone` feature node
2. The named video should connect to the `video_clone` node through the expected input.
3. Turn 2 should reuse the same named video context and add:
   - one `avatar` node for `Default Female`
   - one `motion_clone` feature node
4. Turn 2 should not delete the `video_clone` workflow.
5. Turn 2 should not create a second unrelated video asset node if the same video is already present and reusable.
6. Turn 3 may reorganize spacing or layout, but both workflows must still be visible and coherent.

### Failure Examples

- Turn 2 replaces `video_clone` instead of adding `motion_clone`.
- The agent asks again which video to use, even though the named video is already on canvas.
- A duplicate copy of the same video node is created without need.
- Cleanup wipes one of the workflows.

## Scenario 2: Reuse One Video Across Video Clone and Avatar Ads

### Multi-turn Conversation

Turn 1:
`Use Health Supplements 1 to build a video clone workflow for diet-1.`

Turn 2:
`Using the same video context, also add an avatar ads workflow where Default Male sells diet-1.`

Turn 3:
`Keep both workflows separate and do not convert either one into motion clone.`

### Expected Canvas Reaction

1. Turn 1 should create:
   - one `video` node for `Health Supplements 1`
   - one `product` node for `diet-1`
   - one `video_clone` feature node
2. Turn 2 should add:
   - one `avatar` node for `Default Male`
   - one `text` node or other required draft-copy node, if avatar ads currently uses one
   - one `avatar_ads` feature node
3. Turn 2 should keep the original `video_clone` workflow intact.
4. Turn 2 should continue to use the same named video context rather than dropping it from the conversation state.
5. Turn 3 should preserve both workflows and avoid creating any `motion_clone` node.

### Failure Examples

- The second turn deletes the earlier `video_clone` graph.
- The agent creates `motion_clone` even though the user explicitly asked not to.
- The agent asks for a product or avatar that was already named.
- The canvas collapses into one ambiguous workflow instead of two distinct feature nodes.

## Scenario 3: Batch Out Three Workflow Types Around One Video

### Multi-turn Conversation

Turn 1:
`Use Health Supplements 2 as the reference video and create a video clone workflow for red lapel pin.`

Turn 2:
`With that same video, add a motion clone workflow for Default Founder and the same product.`

Turn 3:
`With the same video context, add an avatar ads workflow for Default Female introducing red lapel pin.`

Turn 4:
`Format the canvas so all three workflows stay readable.`

### Expected Canvas Reaction

1. Turn 1 should create the initial `video_clone` graph around the named video and product.
2. Turn 2 should preserve that graph and add one `motion_clone` feature node with the required supporting asset nodes.
3. Turn 3 should preserve the previous graphs and add one `avatar_ads` feature node with the required supporting asset nodes.
4. By the end of Turn 3, the canvas should contain all three feature types:
   - `video_clone`
   - `motion_clone`
   - `avatar_ads`
5. The same named video should remain understandable as the reference anchor across the conversation.
6. Turn 4 should reorganize the graph without deleting any of the three workflow types.

### Failure Examples

- Any later turn clears the earlier workflow nodes.
- The third turn creates a second `video_clone` instead of `avatar_ads`.
- The agent loses track of the video context and asks the user to choose a new video.
- Canvas formatting detaches critical edges or removes nodes.

## Pass Criteria

This QA pass succeeds when:

- The agent can keep one named video in context across multiple turns.
- Different feature nodes can be added around that same video over time.
- Earlier workflows remain visible and coherent after later requests.
- Cleanup and formatting preserve the multi-workflow graph.

## Optional Debug Notes

If a scenario fails, capture:

- The exact user message
- The visible assistant reply
- A screenshot of the canvas after each turn
- Browser console errors, if any
- Relevant network failures for:
  - `/api/project-agent/session`
  - `/api/project-agent/chat`
