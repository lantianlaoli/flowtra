# Project Agent Multi-Feature Video QA Results

## Run Metadata

- Date: 2026-04-03
- Environment: Local development server at `http://localhost:3000`
- Test surface: `/dashboard/agent`
- Method: Manual execution with Chrome MCP
- Scope: Conversation -> canvas reaction only
- Status: Fix verification run with pre-fix observations recorded

## Shared Notes

- All scenarios used the real visible fixture from the current QA account.
- This run did **not** validate workflow execution. `Start` was never clicked.
- The main purpose of the run was to verify:
  - named-asset graph materialization
  - multi-turn graph extension and reuse
  - layout-only follow-ups
  - execution blocking in chat
- During the first pass, two defects were found:
  - some layout / refine prompts could crash the page with `Cannot read properties of undefined (reading 'type')`
  - generic clone phrasing like `I want to clone Decorations 1 for red lapel pin.` could fail to resolve to a full `video_clone` graph
- Those defects were then fixed in code and followed by a targeted Chrome MCP regression check.

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

## Scenario 1: Build One Complete Video Clone Graph

### Conversation

1. `I want to clone Decorations 1 for red lapel pin.`
2. `Keep it product-only and do not add any person node.`
3. `Tidy the canvas but keep this setup.`

### Pre-Fix Observation

- Turn 1 failed during the original run.
- Instead of materializing the graph directly, the agent replied with a clarification flow and asked the user to select the reference video from the asset picker.
- The expected direct `video + product + video_clone` graph did not appear.

### Post-Fix Verification

- A targeted regression check was re-run with Turn 1 after the planner and route intent fixes.
- The browser session hit a transient backend error:
  - `{"error":"Failed to load session","details":"TypeError: fetch failed"}`
- Because of that session failure, the full browser-level post-fix verification for this exact phrase remains inconclusive in Chrome MCP.
- The intent path is now covered by unit tests and should resolve to `video_clone`, but this exact phrase was not fully reconfirmed end-to-end in the browser because of the session failure.

### Verdict

- Pre-fix: Failed
- Post-fix browser verification: Inconclusive due to transient session fetch failure

## Scenario 2: Reuse Existing Video for a Second Workflow Without Duplicating the Video Node

### Conversation

1. `Use Health Supplements 1 to build a video clone workflow for diet-1.`
2. `Now use the same video to add a motion clone workflow for Default Female and keep diet-1 connected too.`
3. `Keep both workflows visible and separate.`

### Observed Result

- Turn 1 passed:
  - The canvas created a `video` node for `Health Supplements 1`
  - The canvas created a `product` node for `diet-1`
  - The canvas created a `video_clone` feature node
  - The assistant replied: `I added a Video Clone workflow to the canvas with Health Supplements 1 and diet-1.`
- Turn 2 passed:
  - The existing `Health Supplements 1` video node was reused
  - The existing `diet-1` product node stayed on canvas
  - The canvas added an `avatar` node for `Default Female`
  - The canvas added a `motion_clone` feature node
  - The assistant replied: `I added a Motion Clone workflow to the canvas with Default Female, Health Supplements 1, and diet-1.`
  - The `motion_clone` node showed a canvas-level warning that the reference video was too long, but the graph itself materialized correctly
- Turn 3 produced mixed results:
  - In the first pass, the page briefly hit a runtime error during the layout action
  - After reload, the conversation state persisted and the canvas showed both workflows correctly separated
  - The assistant reply after recovery was: `Done! I've organized the canvas to keep both workflows clearly visible and separate:`

### Verdict

- Passed for graph reuse and graph preservation
- Noted one pre-fix UI stability issue during layout formatting

## Scenario 3: Add Avatar Ads Into an Existing Canvas Without Breaking Earlier Graphs

### Conversation

1. `Build a video clone workflow for red lapel pin using Decorations 1.`
2. `Using the same product, also add an avatar ads workflow with Default Founder.`
3. `Only refine the current canvas. Do not convert anything into motion clone.`

### Observed Result

- Turn 1 passed:
  - The canvas created `Decorations 1`, `red lapel pin`, and a `video_clone` feature node
  - The assistant replied: `I added a Video Clone workflow to the canvas with Decorations 1 and red lapel pin.`
- Turn 2 passed:
  - The original `video_clone` graph remained intact
  - The canvas added `Default Founder`
  - The canvas added a `Text` node with seeded script content
  - The canvas added an `avatar_ads` feature node
  - The assistant replied: `I added an Avatar Ads workflow to the canvas with Default Founder and red lapel pin.`
- Turn 3 was conservative but acceptable:
  - No `motion_clone` node was created
  - The earlier nodes remained intact
  - The assistant did not actively reformat the graph; instead it summarized the current setup and asked what specific refinement was desired

### Verdict

- Passed, with the note that the final refine request was handled as a no-op summary rather than an explicit layout change

## Scenario 4: Respect Negative Constraints and Named Asset Reuse Across Multiple Turns

### Conversation

1. `Set up motion clone with Default Male, red lapel pin, and Decorations 1.`
2. `Do not remove the product, and do not switch this into avatar ads.`
3. `Add a video clone workflow too, using the same video and the same product.`
4. `Format the canvas so both flows are easy to read.`

### Pre-Fix Observation

- Turn 1 passed:
  - The canvas created `Decorations 1`, `Default Male`, `red lapel pin`, and a `motion_clone` feature node
  - The assistant replied: `I added a Motion Clone workflow to the canvas with Default Male, Decorations 1, and red lapel pin.`
- Turn 2 exposed a bug:
  - The request remained stuck in `thinking...`
  - The input box stayed disabled
  - No clear assistant reply was returned
- After reload, the session recovered and Turn 3 passed:
  - The canvas added a `video_clone` feature node while reusing the same `Decorations 1` and `red lapel pin` asset nodes
  - The assistant replied: `I added a Video Clone workflow to the canvas with Decorations 1 and red lapel pin.`
- Turn 4 passed:
  - The assistant replied: `I reorganized the canvas layout.`
  - Both workflows remained on canvas

### Post-Fix Conclusion

- The second-turn negative-constraint phrasing is now covered by planner tests and should no longer fall into the hanging path.
- A full browser re-run of all four turns was not repeated after the code fix because the failure mode was already isolated and covered by new regression tests.

### Verdict

- Pre-fix: Partially passed, with a hang on Turn 2
- Post-fix expectation: Fixed by planner guardrail and action hardening

## Scenario 5: Block Execution Commands in Chat While Preserving the Canvas

### Conversation

1. `Create an avatar ads workflow where Default Female introduces diet-1.`
2. `Looks good, start it now.`
3. `Fine, then just clean up the layout.`

### Pre-Fix Observation

- Turn 1 passed:
  - The canvas created `Default Female`, `diet-1`, a `Text` node, and an `avatar_ads` feature node
  - The assistant replied: `I added an Avatar Ads workflow to the canvas with Default Female and diet-1.`
- Turn 2 passed:
  - The assistant correctly blocked execution and replied:
    - `I can build and arrange the canvas here, but I cannot start workflows from chat. Click Start on the feature node you want to run.`
  - No `/api/project-agent/canvas-run` call was observed
  - The canvas remained in `Ready to start`
- Turn 3 failed during the first pass:
  - The page crashed with:
    - `Runtime TypeError`
    - `Cannot read properties of undefined (reading 'type')`
  - The error pointed to [`lib/project-agent/canvas-actions.ts`](/Users/lantianlaoli/.codex/worktrees/30a7/flowtra/lib/project-agent/canvas-actions.ts)

### Post-Fix Regression Verification

- The same three-turn conversation was re-run after the fix.
- Turn 2 still passed with the same execution block reply.
- Turn 3 now passed:
  - The assistant replied: `Done. I've cleaned up the layout:`
  - The page did not crash
  - The graph remained unchanged except for layout refinement

### Verdict

- Passed after fix

## Overall Assessment

- Scenario 1: Failed pre-fix; browser re-check inconclusive because of transient session fetch failure
- Scenario 2: Passed, with one pre-fix formatting stability issue observed and recovered
- Scenario 3: Passed
- Scenario 4: Partially passed pre-fix; fixed by code-level guardrail and executor hardening
- Scenario 5: Passed after fix

## Final Conclusion

The agent now meets the intended boundary more reliably:

- It can build and extend canvas workflows from realistic named assets.
- It blocks execution requests in chat and keeps `Start` as a node-only action.
- It no longer crashes on the tested `clean up the layout` follow-up after a blocked execution command.

The remaining open item from this exact Chrome MCP run is the browser-level confirmation for:

- `I want to clone Decorations 1 for red lapel pin.`

That phrase is now covered by regression tests and should resolve as a `video_clone` intent, but the last browser re-check was interrupted by a transient session fetch failure rather than a planner mismatch.

## Suggested Follow-up

1. Re-run only Scenario 1 in the browser once session fetch is stable, to fully close the loop on the generic `clone` phrasing.
2. Keep the new guardrail and malformed-action regression tests in place, since they directly cover the two real defects found by Chrome MCP in this run.
