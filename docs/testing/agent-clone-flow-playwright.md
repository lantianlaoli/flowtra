# Agent Clone Flow Playwright Test Plan

## Scope
Validate the end-to-end experience in `/dashboard/agent` for:
1. Selecting a reference video
2. Choosing replacement avatar/product
3. Entering Step 3 prompt editing
4. Editing prompt fields (including spaces and `@` mention menu)

## Environment
- URL: `http://localhost:3000/dashboard/agent`
- Browser: Playwright MCP (Chrome)
- Date: 2026-02-20
- User: authenticated test account (`laoli+clerk_test@example.com`)

## Preconditions
- At least one video exists in Assets for Step 1 selection.
- At least one avatar and one product exist in user library.
- Network to model provider is available (required for clone draft generation API).

## Test Cases

### TC-01 Start New Chat and enter clone workflow
- Steps:
  1. Open history panel.
  2. Click `New chat`.
  3. Click `Clone Viral Video` quick action.
- Expected:
  - Left panel shows `Step 1: Choose Reference Video`.
  - Chat shows user intent and assistant guidance.
- Actual:
  - Pass.

### TC-02 Select reference video and move to replacements
- Steps:
  1. Click `View Details` on available reference video card.
  2. In modal, click `Select This Video`.
- Expected:
  - Flow moves to `Step 2: Replace Character & Product`.
  - User message `I selected "Uploaded" ...` appended once.
- Actual:
  - Pass.

### TC-03 Choose avatar/product and confirm replacements
- Steps:
  1. Choose avatar `Default Male`.
  2. Choose product `book`.
  3. Type `confirm replacements` in agent chat and send.
- Expected:
  - Intermediate `Working on it...` appears.
  - Then Step 3 prompt draft screen appears.
- Actual:
  - Two outcomes observed:
    - Pass in historical successful session.
    - **Fail/blocked** in new session due backend draft API error (see TC-06).

### TC-04 Edit Step 3 fields (space input regression check)
- Steps:
  1. In Step 3, focus `Subject` field under `Video Prompt (Shot Fields)`.
  2. Append text with double spaces (example: `  extra words`).
- Expected:
  - Spaces are accepted and persisted in textarea value.
- Actual:
  - Pass.
  - Verified with runtime check:
    - `value = "book Default Male and a 3-month-old baby  extra words"`
    - `hasDoubleSpace = true`.

### TC-05 Image Prompt `@` mention menu availability
- Steps:
  1. Focus `Image Prompt` in Step 3.
  2. Type ` @`.
- Expected:
  - Mention listbox opens.
  - Character and Product options are visible.
- Actual:
  - Pass.
  - Character and Product groups both populated.

### TC-06 Draft generation API reliability (blocking issue)
- Steps:
  1. Complete TC-03 in a fresh new chat.
- Expected:
  - Step 3 draft data generated normally.
- Actual:
  - **Fail (backend)**.
  - Left panel shows failure banner:
    - `Draft generation failed: 400 ... Provider returned error ... A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth ...`
  - Endpoint impacted:
    - `POST /api/project-agent/clone-replacement-draft`

## Notes / Observations
- New chat without available Assets shows:
  - `No videos found in Assets. Import a video first, then ask to clone.`
- This is expected behavior, but must be treated as hard precondition for clone-flow E2E tests.

## Recommended Regression Checklist
Run before release:
1. New chat -> clone quick action works.
2. Step 1 selection always transitions to Step 2.
3. Step 2 is chat-driven: sending `confirm replacements` transitions to Step 3 without fallback loops.
4. Step 3 all textareas accept spaces and keep caret behavior.
5. Image Prompt `@` menu opens with character/product options.
6. Refresh page in Step 3 keeps chat + draft state consistent.
7. No duplicate synthetic user messages are appended.
8. `clone-replacement-draft` API success path verified with provider.

## Status Summary
- Frontend interaction path: mostly pass.
- Known blocker: provider-side/adapter schema depth error in draft generation API.
