# Project Agent Canvas QA Results

## Run Metadata

- Date: 2026-03-29
- Environment: Local development server at `http://localhost:3000`
- Test surface: `/dashboard/agent`
- Method: Manual execution with Chrome MCP
- Scope: Conversation -> canvas reaction only
- Status: Post-fix regression run

## Shared Notes

- The test account exposes these visible assets in the agent picker:
- Avatars: `Default Male`, `Default Female`, `Default Founder`
- Products: `red lapel pin`, `diet-1`
- Videos:
    - `Decorations 1`
    - `Health Supplements 1`
    - `Health Supplements 2`
- `Diet Gatorade Trio Price Drop and Flash Sale` was mentioned by the assistant in an earlier broken run, but it is not part of the current visible `/api/assets` fixture, so it is not used in the final regression scenarios.
- The pass criteria below do not depend on workflow execution. `Start` was not clicked in any scenario.

## Scenario 1: Video Clone Canvas

### Conversation

1. `Build a video clone workflow for red lapel pin using Decorations 1 as the reference video.`
2. `Keep it focused on the product and do not add any avatar workflow.`
3. `If the canvas needs cleanup, only reorganize the current clone setup.`

### Observed Result

- Turn 1 created the expected canvas workflow immediately.
- The canvas showed:
  - one `video` node for `Decorations 1`
  - one `product` node for `red lapel pin`
  - one `video_clone` feature node
- The `video_clone` node reached a ready state in the UI.
- The assistant reply matched the actual canvas action instead of falling back to clarification.
- No unrelated avatar workflow was introduced.

### Verdict

- Passed

## Scenario 2: Avatar Ads Canvas

### Conversation

1. `Create an avatar ads workflow where Default Male introduces the red lapel pin.`
2. `Make it short and premium.`
3. `Keep the current avatar ads setup and only refine it. Do not switch to video clone.`

### Observed Result

- Turn 1 created the expected canvas workflow immediately.
- The canvas showed:
  - one `avatar` node for `Default Male`
  - one `product` node for `red lapel pin`
  - one `text` node with seeded draft copy
  - one `avatar_ads` feature node
- The `avatar_ads` node reached a ready state in the UI.
- The follow-up turns stayed in the avatar-ads context and did not switch to another feature type.

### Verdict

- Passed

## Scenario 3: Motion Clone Canvas

### Conversation

1. `Build a motion clone workflow using Default Female, red lapel pin, and Decorations 1.`
2. `Keep the product in the workflow and do not turn this into avatar ads.`
3. `Clean up and format the canvas.`

### Observed Result

- Turn 1 created the expected canvas workflow immediately.
- The canvas showed:
  - one `video` node for `Decorations 1`
  - one `avatar` node for `Default Female`
  - one `product` node for `red lapel pin`
  - one `motion_clone` feature node
- The `motion_clone` node kept the current validation warning because the selected reference video is 61 seconds long, which is outside the 3-30 second limit.
- Even with that warning, the graph materialized correctly on canvas, which was the purpose of this QA pass.
- Turn 2 preserved the motion-clone context and did not switch to avatar ads.
- Turn 3 triggered layout cleanup and preserved the existing graph instead of clearing it.

### Verdict

- Passed

## Overall Assessment

- Scenario 1: Passed
- Scenario 2: Passed
- Scenario 3: Passed

The current agent behavior now materializes named assets directly onto the canvas for the three key workflow types under test. Multi-turn follow-ups preserve context more reliably, and canvas cleanup requests now reorganize an existing graph instead of incorrectly reporting an empty canvas.

## Remaining Notes

1. Motion clone still enforces its own runtime validation rules after graph creation. In this regression run, the selected reference video remained too long, so the node displayed a warning rather than a startable state.
2. Clerk loading in local development is still somewhat unstable. A timed-out Clerk boot can temporarily block page hydration, but once the page loads successfully the canvas workflow behavior is now consistent.
