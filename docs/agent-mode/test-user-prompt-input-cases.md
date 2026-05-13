# Agent Mode Prompt Input Test Cases

## Test Account

- User ID: `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
- Asset snapshot source: Supabase MCP read-only query on 2026-05-08.

## Verified Assets

### Products

- `medicube`
- `shoes`

### Creator Videos

- `Medicube Volufiline Stick Review`
- `Don't Waste Your Eye Cream`
- `Loewe X On Unboxing`

### Avatars

- No user-uploaded avatar assets were present for this user at the time of verification.
- System avatars available through `/api/user-avatars`: `Ethan Walker`, `Lin Yuqing`, `Misaki Sato`, `Sofia Garcia`.

## Prompt Input Cases

1. Product mention followed by a function token
   - Input flow: type `Create a direct response beauty ad with `, choose `@Lin Yuqing`, type ` for `, choose `@medicube`, type ` with a before-and-after hook`, then choose `/Avatar Ads`.
   - Expected prompt composition: the `Lin Yuqing` avatar chip and `medicube` product chip stay after their surrounding typed text, `/Avatar Ads` is appended after them, and the typed details remain editable.

2. Function token before product details
   - Input flow: choose `/Video Clone`, type ` using the pacing from `, choose `@Medicube Volufiline Stick Review`, type ` and feature `, choose `@medicube`.
   - Expected prompt composition: the function chip, creator video chip, and product chip all stay in the order selected, matching normal typing behavior.

3. Competitor-style product clone
   - Input flow: type `Make a concise try-on style clone inspired by `, choose `@Loewe X On Unboxing`, type ` for `, choose `@shoes`, type ` with a premium unboxing feel.`
   - Expected prompt composition: the creator video chip appears inline after `inspired by`, the product chip appears inline after `for`, and text wraps without moving the send button.

4. TikTok link with a product asset
   - Input flow: paste `https://www.tiktok.com/@flowtra/video/7350000000000000000`, type ` Adapt this structure for `, choose `@medicube`, then choose `/Video Clone`.
   - Expected prompt composition: the TikTok URL is highlighted as a link chip, the product chip is appended in typing order, and submitted text preserves the original URL unchanged.

5. Text node instruction with existing product context
   - Input flow: type `Add a concise callout next to `, choose `@shoes`, type ` that says Lightweight daily runner`, then choose `/Text`.
   - Expected prompt composition: the product chip stays inline with the sentence, the `/Text` chip is appended, and the final intent reads as an instruction to add supporting text near the shoes product node.
