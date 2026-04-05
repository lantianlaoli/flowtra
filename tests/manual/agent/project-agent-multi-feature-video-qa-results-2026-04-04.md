# Project Agent Multi-Feature Video QA Results

## Run Metadata

- Date: 2026-04-04
- Environment: Local development server at `http://localhost:3000`
- Test surface: `/dashboard/agent`
- Method: Manual execution with Chrome DevTools MCP
- Scope: Conversation -> canvas reaction only
- Rule applied: Stop each scenario immediately after the first failed turn
- Overall status: Failed

## Fixture Reality Check

- The visible QA account still showed the expected sidebar fixture labels:
  - Avatars: `Default Male`, `Default Female`, `Default Founder`
  - Products: `red lapel pin`, `diet-1`
  - Videos: `Decorations 1`, `Health Supplements 1`, `Health Supplements 2`
- However, runtime behavior no longer matched the expected fixture guarantees:
  - Some exact-name prompts still asked the user to select a reference video again
  - `Default Female` resolved as ambiguous, even though the manual scenario assumes a unique visible match

## Scenario 1: Build One Complete Video Clone Graph

### Turn 1

- User: `I want to clone Decorations 1 for red lapel pin.`
- Assistant: `I added Decorations 1 and a Motion Clone node to the canvas. Next, choose the replacement avatar.`
- Observed canvas:
  - `video` node: `Decorations 1`
  - `product` node: `red lapel pin`
  - `motion_clone` feature node
  - 2 edges:
    - `video -> motion_clone` via `video`
    - `product -> motion_clone` via `product`
- Failure reason:
  - Wrong feature node was created
  - Expected `video_clone`, but actual result was `motion_clone`

### Turn 2

- User: `Keep it product-only and do not add any person node.`
- Assistant: repeated the previous motion-clone reply instead of applying the new constraint
- Observed canvas:
  - Still only the same 3 nodes and 2 edges
  - `motion_clone` became `ready` / startable
- Failure note:
  - The turn did not honor the negative constraint
  - Under the strict procedure, the scenario had already failed at Turn 1

### Turn 3

- User: `Tidy the canvas but keep this setup.`
- Assistant: `I reorganized the canvas layout.`
- Observed canvas:
  - Same wrong graph preserved
- Verdict:
  - Scenario failed on Turn 1

## Scenario 2: Reuse Existing Video for a Second Workflow Without Duplicating the Video Node

### Turn 1

- User: `Use Health Supplements 1 to build a video clone workflow for diet-1.`
- Assistant: `Choose the reference video below and I will place the Video Clone workflow on the canvas.`
- Observed canvas:
  - No nodes
  - No edges
- Failure reason:
  - Exact named assets were not materialized directly
  - The agent asked for selection instead of building the graph

### Verdict

- Failed on Turn 1

## Scenario 3: Add Avatar Ads Into an Existing Canvas Without Breaking Earlier Graphs

### Turn 1

- User: `Build a video clone workflow for red lapel pin using Decorations 1.`
- Assistant surface output: `{"error":"Internal server error"}`
- Observed canvas:
  - No nodes
  - No edges
- Failure reason:
  - Chat request failed before graph creation
  - The canvas did not change

### Verdict

- Failed on Turn 1

## Scenario 4: Respect Negative Constraints and Named Asset Reuse Across Multiple Turns

### Turn 1

- User: `Set up motion clone with Default Male, red lapel pin, and Decorations 1.`
- Assistant: `Choose the reference video below and I will place the Motion Clone workflow on the canvas.`
- Observed canvas:
  - No nodes
  - No edges
- Failure reason:
  - Exact named assets were not materialized directly
  - The agent asked for selection instead of building the graph

### Verdict

- Failed on Turn 1

## Scenario 5: Block Execution Commands in Chat While Preserving the Canvas

### Turn 1

- User: `Create an avatar ads workflow where Default Female introduces diet-1.`
- Assistant: `I found more than one avatar that could match your request. Please name the avatar more precisely.`
- Observed canvas:
  - No nodes
  - No edges
- Failure reason:
  - The named avatar was treated as ambiguous
  - The expected avatar-ads graph was not created

### Verdict

- Failed on Turn 1

## Overall Assessment

- The five-scenario acceptance gate failed immediately.
- None of the five scenarios completed successfully in this run.
- Four distinct regression patterns showed up:
  1. Wrong workflow inference:
     - Scenario 1 interpreted a generic `clone` request as `motion_clone` instead of `video_clone`
  2. Named-asset resolution regression:
     - Scenarios 2 and 4 asked for reference-video selection despite exact fixture names in the prompt
  3. Server-side instability:
     - Scenario 3 returned `Internal server error` on the first turn
  4. Asset uniqueness / disambiguation regression:
     - Scenario 5 treated `Default Female` as ambiguous instead of using the visible fixture item directly

## Evidence

- Artifacts directory:
  - `tests/manual/agent/artifacts/multi-feature-qa-2026-04-04/`
- Captured screenshots:
  - `scenario1-turn0.png`
  - `scenario1-turn1.png`
  - `scenario1-turn2.png`
  - `scenario1-turn3.png`
  - `scenario2-turn0.png`
  - `scenario2-turn1.png`
  - `scenario3-turn0.png`
  - `scenario3-turn1.png`
  - `scenario4-turn0.png`
  - `scenario4-turn1.png`
  - `scenario5-turn0.png`
  - `scenario5-turn1.png`

## Immediate Follow-up Suggestions

1. Re-check workflow intent routing for generic `clone` phrasing so product-only clone prompts prefer `video_clone`, not `motion_clone`.
2. Audit the named-asset resolver against the current QA account fixture, especially:
   - `Health Supplements 1`
   - `Decorations 1`
   - `Default Female`
3. Investigate the `/api/project-agent/chat` 500 on the Scenario 3 phrasing before running the multi-feature suite again.
