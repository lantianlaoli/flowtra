## Character Ads Revamp Plan

1. **Duration Control Refresh**
   - Replace the existing segmented buttons with a dropdown selector sourcing options from the Nano Banana Pro config (8s → 1m20s, every 8 seconds).
   - Export the duration list from `lib/character-ads-dialogue.ts` so both the selector and dialogue helpers stay in sync.

2. **Default Model Simplification**
   - Remove the image and video model selectors from `CharacterAdsPage` and hardcode requests to Nano Banana Pro (images) and VEO3 Fast (video).
   - Drop the image format selector; only keep duration, video size, language, and custom dialogue controls on the configuration card.

3. **Backend Alignment**
   - Update `/api/character-ads/create` validation to accept the new duration list, include the Nano Banana Pro model, and reject non-VEO3 Fast video models.
   - Simplify the server-side resolution logic since we only support the single video model now, and keep credit math based on 8-second scenes.

4. **Testing & UI Polish**
   - Smoke-test the dashboard flow (upload images → select product → start generation) to confirm the new defaults post successfully.
   - Verify the dialogue word limit helper still clamps content sensibly for the extended durations.

5. **Layout Parity**
   - Adopt the Standard Ads preview + conversational composer layout: keep the storyboard preview up top and move the selectors + dialogue input into a fixed bottom bar.
   - Surface character/brand/product pickers via lightweight modals so the chat-style composer stays focused.
