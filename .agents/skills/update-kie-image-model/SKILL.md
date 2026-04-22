---
name: update-kie-image-model
description: Update Flowtra's KIE image-generation model integration from current provider documentation. Use when switching image models, refreshing KIE image API payload fields, replacing deprecated image model IDs, or updating landing/pricing/model copy for Flowtra image generation.
---

# Update KIE Image Model

## Workflow

Use the model documentation as the source of truth before editing code.

1. Read the relevant KIE docs in `docs/kie/` or `references/`.
2. Identify the exact model IDs, endpoint, request fields, callback shape, status endpoint, and result URL path.
3. Centralize request construction in `lib/kie-image-generation.ts` instead of duplicating provider payloads.
4. Migrate every Flowtra image-generation caller to the centralized helper.
5. Update user-facing model names in landing, pricing, showcase, and credit-history displays.
6. Run static searches and build checks before reporting completion.

## References

- `references/gpt_2_img.md` — GPT Image 2 Text-to-Image API documentation
- `references/gpt_2_img_api.md` — GPT Image 2 Image-to-Image OpenAPI specification

## Flowtra Image Call Sites

Search these first:

```bash
rg -n "NON_AGENT_IMAGE_MODEL|nano-banana|seedream/5-lite|image_input|image_urls|input_urls|output_format|google_search|quality|createTask" lib app components
```

Cover these paths when changing image models:

- Avatar ads cover/portrait image generation.
- Video clone keyframes, replica photos, raw-prompt frame regeneration, and continuation frames.
- Product photo purification.
- Reference-video share image generation.
- AI reference angle primary and fallback generation.
- Motion Clone preview image generation.

Do not rewrite video-model payloads that intentionally use `image_urls`, `input_urls`, or `element_input_urls` for video APIs.

## Payload Rules

For GPT Image 2, use only the documented KIE fields:

- Text-to-image: `model`, `input.prompt`, optional `input.aspect_ratio`, optional `input.nsfw_checker`, optional `callBackUrl`.
- Image-to-image: same fields plus `input.input_urls`.
- Select image-to-image when reference URLs exist; select text-to-image when they do not.
- Keep `POST https://api.kie.ai/api/v1/jobs/createTask`.
- Keep callback/status parsing compatible with `data.resultJson` containing `{ "resultUrls": [...] }`.

Remove old provider fields when unsupported by the new docs:

- `image_input`
- `image_urls` for image generation
- `resolution`
- `output_format`
- `google_search`
- Seedream-only `quality`

## Validation

Run these checks after edits:

```bash
rg -n "nano-banana|seedream/5-lite|image_input|image_urls|resolution|output_format|google_search|quality" lib app components
pnpm lint
pnpm type-check
pnpm build
```

Review any remaining search matches. They must be unrelated video API fields, historical compatibility keys, or intentionally unchanged docs/comments.

For route-level confidence, inspect generated request payloads and confirm:

- Text-only image tasks use the text-to-image model and no `input_urls`.
- Reference-image tasks use the image-to-image model and include `input_urls`.
- Landing desktop and mobile model pricing copy names the new image model.
