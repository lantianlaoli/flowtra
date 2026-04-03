# Project Agent Multi-Feature Video QA Results

## Run Metadata

- Date: 2026-03-30
- Environment: Local development server at `http://localhost:3000`
- Test surface: `/dashboard/agent`
- Method: Manual execution with Chrome MCP
- Scope: Conversation -> canvas reaction only

## Shared Notes

- Every scenario started from a fresh agent session after clearing local storage and reloading the page.
- The pass criteria for this run only covered whether the canvas materialized the expected feature types and preserved graph state across multiple turns.
- This run did **not** validate workflow execution. `Start` was not clicked.

## Visible Asset Fixture Used During This Run

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

## Scenario 1: Reuse One Video Across Video Clone and Motion Clone

### Conversation

1. `Build a video clone workflow for red lapel pin using Decorations 1 as the reference video.`
2. `Now use the same video to add a motion clone workflow for Default Female and keep the red lapel pin in the canvas.`
3. `Clean up the canvas but keep both workflows.`

### Observed Result

- Turn 1 passed:
  - The canvas created a `video` node for `Decorations 1`
  - The canvas created a `product` node for `red lapel pin`
  - The canvas created a `video_clone` feature node
  - The assistant replied: `I added a Video Clone workflow to the canvas with Decorations 1 and red lapel pin.`
- Turn 2 only partially worked:
  - The canvas added a `motion_clone` feature node
  - The assistant replied: `I added a Motion Clone node to the canvas.`
  - The agent did **not** add the expected `Default Female` avatar node
  - The new motion clone node remained incomplete with `Connect video and avatar or product to start`
- Turn 3 passed as a cleanup action:
  - The assistant replied: `I reorganized the canvas layout.`
  - The earlier `video_clone` graph remained visible
  - The `motion_clone` node also remained on canvas

### Verdict

- Partially passed

### Reason

The agent reused the session and added a second feature node around the same video context, but it did not fully materialize the supporting nodes for the second workflow.

## Scenario 2: Reuse One Video Across Video Clone and Avatar Ads

### Conversation

1. `Use Health Supplements 1 to build a video clone workflow for diet-1.`
2. `Using the same video context, also add an avatar ads workflow where Default Male sells diet-1.`
3. `Keep both workflows separate and do not convert either one into motion clone.`

### Observed Result

- Turn 1 passed:
  - The canvas created a `video` node for `Health Supplements 1`
  - The canvas created a `product` node for `diet-1`
  - The canvas created a `video_clone` node
  - The assistant replied: `I added a Video Clone workflow to the canvas with Health Supplements 1 and diet-1.`
- Turn 2 passed:
  - The canvas preserved the original video clone graph
  - The canvas added an `avatar` node for `Default Male`
  - The canvas added a `text` node with seeded copy
  - The canvas added an `avatar_ads` node
  - The assistant replied: `I added an Avatar Ads workflow to the canvas with Default Male and diet-1.`
- Turn 3 passed:
  - The assistant confirmed both workflows remained separate
  - No `motion_clone` node was created
  - The existing `video_clone` and `avatar_ads` workflows remained visible together

### Verdict

- Passed

## Scenario 3: Batch Out Three Workflow Types Around One Video

### Conversation

1. `Use Health Supplements 2 as the reference video and create a video clone workflow for red lapel pin.`
2. `With that same video, add a motion clone workflow for Default Founder and the same product.`
3. `With the same video context, add an avatar ads workflow for Default Female introducing red lapel pin.`
4. `Format the canvas so all three workflows stay readable.`

### Observed Result

- Turn 1 failed to fully materialize the expected graph:
  - The canvas created only a `video_clone` feature node
  - The assistant replied: `I added a Video Clone node to the canvas.`
  - The named video and product asset nodes were **not** materialized
- Turn 2 also only partially materialized:
  - The canvas added a `motion_clone` feature node
  - The assistant replied: `I added a Motion Clone node to the canvas.`
  - The named video, avatar, and product support nodes were **not** added
- Turn 3 partially worked:
  - The canvas added an `avatar_ads` workflow with `Default Female`, `red lapel pin`, and a `text` node
  - The assistant replied: `I added an Avatar Ads workflow to the canvas with Default Female and red lapel pin.`
- Turn 4 passed as a cleanup action:
  - The assistant replied: `I reorganized the canvas layout.`
  - All three feature nodes remained visible after formatting

### Verdict

- Failed

### Reason

The agent can stack multiple feature nodes over time, but this scenario did not preserve and materialize the same named video as a reusable anchor across all three turns. The first two turns degraded into feature-only node creation instead of full asset-aware workflow materialization.

## Overall Assessment

- Scenario 1: Partially passed
- Scenario 2: Passed
- Scenario 3: Failed

## Conclusion

The current agent behavior can reuse a video context across multiple turns in some cases, but it is not yet stable enough for broad pass criteria around "one video -> multiple different workflows".

The strongest path right now is:

- `video_clone` followed by `avatar_ads` around a clearly named short video

The weaker paths are:

- Adding `motion_clone` as a second workflow while expecting the agent to automatically carry over and re-bind all supporting assets
- Using `Health Supplements 2` as the anchor video while stacking three different workflow types in one conversation

## Suggested Follow-up Debug Focus

1. Compare why `Health Supplements 1` materializes as a full asset-backed `video_clone` workflow while `Health Supplements 2` falls back to feature-only node creation.
2. Inspect why follow-up `motion_clone` creation in a shared-video conversation adds only the feature node instead of also adding or reusing the expected avatar and product nodes.
3. Add a deterministic planner path for "same video context" follow-ups so later turns can bind to an already resolved video node instead of falling back to generic feature creation.
