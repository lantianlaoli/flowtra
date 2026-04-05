# Project Agent Multi-Feature Video QA Scenarios

## Summary

This document defines five manual QA scenarios for `/dashboard/agent` that focus on realistic multi-turn user prompts in agent mode.

The goal is to verify that the agent can fully operate the canvas layer without executing workflows:

- Add the correct asset and feature nodes from named assets
- Reuse existing nodes instead of duplicating them unnecessarily
- Connect the expected edges for each workflow
- Preserve earlier graph state across later turns
- Reorganize layout without corrupting the graph
- Refuse execution requests from chat and keep execution user-clicked from canvas feature nodes

This pass is limited to **conversation -> canvas reaction only**.
Do **not** click `Start` and do **not** validate execution, progress, or output media.
Execution must remain user-clicked from canvas feature nodes.

## Shared Validation Rules

For every scenario, record:

- The exact user message for each turn
- The visible assistant reply after each turn
- Which new nodes appear after each turn
- Whether expected edges are created
- Whether the agent reuses existing nodes when the prompt says `same video` or `same product`
- Whether the graph remains coherent after later turns
- Whether any execution-intent prompt is correctly blocked in chat

Treat a scenario as failed if any of these happens:

- The assistant replies in text only and the canvas does not change.
- The wrong feature node appears for the user intent.
- Named assets are ignored even though they exist in the visible fixture.
- The agent creates unnecessary duplicate asset nodes when reuse is expected.
- A later turn deletes, corrupts, or detaches an earlier workflow unexpectedly.
- A chat execution request starts a project, changes runtime to running, or creates output nodes.

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

## Strict Test Procedure

Run every scenario with the same discipline:

1. Start a new session and take an initial screenshot of the empty canvas.
2. Submit exactly one user turn at a time.
3. After every turn, wait for the assistant reply and the canvas mutation to settle.
4. Capture:
   - full-page screenshot
   - browser console errors
   - failed network requests
   - visible node count and edge count
5. Before moving to the next turn, verify:
   - the expected feature node exists
   - the expected assets are connected
   - no duplicate asset node was introduced unless the scenario explicitly allows it
6. If any turn fails, stop the scenario and log the failure instead of improvising a recovery prompt.

## Evidence Template

Record the following for every turn:

- Scenario ID
- Turn number
- User message
- Assistant reply
- Visible nodes by type
- Visible edges by target handle
- Duplicate asset check
- Unexpected feature node check
- Console / network issues
- Pass or fail

## Five-Scenario Acceptance Gate

The full pass is only valid if all five scenarios succeed in one QA run. Do not mark partial success.

## Scenario 1: Build One Complete Video Clone Graph

### Multi-turn Conversation

Turn 1:
`I want to clone Decorations 1 for red lapel pin.`

Turn 2:
`Keep it product-only and do not add any person node.`

Turn 3:
`Tidy the canvas but keep this setup.`

### Expected Canvas Reaction

1. Turn 1 should materialize a full video-clone graph without asking for asset clarification.
2. The canvas should show:
   - one `video` node for `Decorations 1`
   - one `product` node for `red lapel pin`
   - one `video_clone` feature node
3. The `video` and `product` nodes should connect to the `video_clone` node through the expected input handles.
4. Turn 2 must preserve the graph as product-only and must not add any `avatar` node.
5. Turn 3 may reposition or reformat the nodes, but it must not rebuild the workflow or change the feature type.

### Failure Examples

- The agent asks again which video or product to use.
- An `avatar` node appears after Turn 2.
- Turn 3 creates a second `video_clone` node instead of formatting the existing graph.
- The `video_clone` node loses one of its required asset edges after cleanup.

## Scenario 2: Reuse Existing Video for a Second Workflow Without Duplicating the Video Node

### Multi-turn Conversation

Turn 1:
`Use Health Supplements 1 to build a video clone workflow for diet-1.`

Turn 2:
`Now use the same video to add a motion clone workflow for Default Female and keep diet-1 connected too.`

Turn 3:
`Keep both workflows visible and separate.`

### Expected Canvas Reaction

1. Turn 1 should materialize a full `video_clone` graph with `Health Supplements 1` and `diet-1`.
2. Turn 2 should reuse the existing `video` node for `Health Supplements 1` instead of creating a second copy of that same video.
3. Turn 2 should add:
   - one `avatar` node for `Default Female`
   - one `motion_clone` feature node
4. The original `video_clone` graph must remain intact after Turn 2.
5. The existing `diet-1` product node should stay available to both workflows where the canvas logic supports reuse.
6. Turn 3 may improve layout, but both workflows must remain visible and separate.

### Failure Examples

- A second `Health Supplements 1` video node is created unnecessarily.
- Turn 2 replaces the `video_clone` workflow instead of adding a `motion_clone` workflow.
- The product node disappears or detaches from the first graph.
- Turn 3 merges the two workflows into one ambiguous graph.

## Scenario 3: Add Avatar Ads Into an Existing Canvas Without Breaking Earlier Graphs

### Multi-turn Conversation

Turn 1:
`Build a video clone workflow for red lapel pin using Decorations 1.`

Turn 2:
`Using the same product, also add an avatar ads workflow with Default Founder.`

Turn 3:
`Only refine the current canvas. Do not convert anything into motion clone.`

### Expected Canvas Reaction

1. Turn 1 should create a complete `video_clone` graph around `Decorations 1` and `red lapel pin`.
2. Turn 2 should preserve that original graph and add:
   - one `avatar` node for `Default Founder`
   - one `text` node if avatar ads still requires seeded copy
   - one `avatar_ads` feature node
3. Turn 2 should reuse the existing `red lapel pin` product node rather than creating an unnecessary duplicate, if the current canvas logic supports direct reuse.
4. Turn 3 must not create any `motion_clone` node.
5. No earlier node should disappear, and no earlier edge should break.

### Failure Examples

- Turn 2 deletes or replaces the original `video_clone` workflow.
- The agent creates `motion_clone` despite the negative instruction.
- A second `red lapel pin` node appears without need when the original one could have been reused.
- The avatar ads graph appears without its expected `avatar` or `text` support node.

## Scenario 4: Respect Negative Constraints and Named Asset Reuse Across Multiple Turns

### Multi-turn Conversation

Turn 1:
`Set up motion clone with Default Male, red lapel pin, and Decorations 1.`

Turn 2:
`Do not remove the product, and do not switch this into avatar ads.`

Turn 3:
`Add a video clone workflow too, using the same video and the same product.`

Turn 4:
`Format the canvas so both flows are easy to read.`

### Expected Canvas Reaction

1. Turn 1 should create a complete `motion_clone` graph with:
   - one `video` node for `Decorations 1`
   - one `avatar` node for `Default Male`
   - one `product` node for `red lapel pin`
   - one `motion_clone` feature node
2. Turn 2 must preserve the product edge and must not change the workflow into `avatar_ads`.
3. Turn 3 should add one `video_clone` feature node while reusing the existing `video` and `product` nodes if possible.
4. Turn 3 should not create duplicate `Decorations 1` or `red lapel pin` nodes unless the current implementation truly requires it.
5. Turn 4 should only improve layout and should preserve both feature graphs.

### Failure Examples

- Turn 2 drops the product from the motion-clone graph.
- Turn 2 changes the feature type despite the negative constraint.
- Turn 3 creates a second `motion_clone` node instead of a `video_clone` node.
- Turn 4 removes nodes or detaches required edges while formatting.

## Scenario 5: Block Execution Commands in Chat While Preserving the Canvas

### Multi-turn Conversation

Turn 1:
`Create an avatar ads workflow where Default Female introduces diet-1.`

Turn 2:
`Looks good, start it now.`

Turn 3:
`Fine, then just clean up the layout.`

### Expected Canvas Reaction

1. Turn 1 should create a complete `avatar_ads` graph with:
   - one `avatar` node for `Default Female`
   - one `product` node for `diet-1`
   - one `text` node if avatar ads still requires seeded copy
   - one `avatar_ads` feature node
2. Turn 2 must not start a project.
3. Turn 2 must not change runtime state to running, must not create any output node, and must not add execution-related graph artifacts.
4. The assistant reply on Turn 2 should explicitly tell the user to click `Start` on the feature node.
5. Turn 3 should still work as a valid formatting request and should only refine layout.

### Failure Examples

- Turn 2 starts execution or changes the node to a running state.
- Turn 2 creates an output node or any project-backed runtime state.
- Turn 2 replies as if execution already started.
- Turn 3 fails because the blocked execution request left the canvas in an inconsistent state.

## Pass Criteria

This QA pass succeeds when all five scenarios prove that:

- asset-backed graph materialization works from realistic named prompts
- follow-up turns refine or extend the current graph instead of replacing it
- `same video` and `same product` reuse stays stable across turns
- duplicate asset nodes are avoided when reuse is expected
- formatting and cleanup preserve graph structure
- chat-based execution is blocked and redirected to the feature node `Start` control

## Optional Debug Notes

If a scenario fails, capture:

- The exact user message
- The visible assistant reply
- A screenshot of the canvas after each turn
- Browser console errors, if any
- Relevant network failures for:
  - `/api/project-agent/session`
  - `/api/project-agent/chat`

These notes are diagnostic only and are not required for a pass.
