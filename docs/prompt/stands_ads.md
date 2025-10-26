# Standard Ads Prompt Reference

Canonical documentation for the Standard Ads workflow (`lib/standard-ads-workflow.ts`). The flow converts a single product image into a KIE cover and a structured video brief.

## Step 1 · Product Image Description

- **Provider / Model**: OpenRouter → `google/gemini-2.0-flash-001`
- **API call**: one `chat.completions` request created by `describeImage`
- **Prompt payload**
    
    ```json
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Describe this product image in detail for advertising purposes. Focus on key features, benefits, and selling points that would appeal to potential customers."
        },
        { "type": "image_url", "image_url": { "url": "<imageUrl>" } }
      ]
    }
    ```
    
- **Output**: free-form marketing description stored on the project (`product_description`).
- **Retry/timeout**: `fetchWithRetry` w/ 3 attempts and 30s timeout.

## Step 2 · Creative Video Brief

`generateCreativePrompts(description, adCopy?)` turns the description into the video instructions consumed later by KIE video generation.

Prompt template (exact string in source):

```
Based on this product description: "{description}"

Generate a creative video advertisement prompt with these elements:
- description: …
- setting: …
- camera_type: …
- camera_movement: …
- action: …
- lighting: …
- dialogue: …
- music: …
- ending: …
- other_details: …
{Use this exact ad copy …}

Return as JSON format.
```

Behavioural guarantees:
- The request uses the same OpenRouter model/timeout policy as Step 1.
- If the user supplies `adCopy`, the function appends “Use this exact ad copy…” and hard-overwrites the `dialogue`, `ad_copy`, and `tagline` fields with verbatim text after parsing.
- Markdown fences are removed before `JSON.parse`.
- When parsing fails, a fully-populated fallback object is returned (see `generateCreativePrompts` for exact defaults) and `ad_copy`/`tagline` are preserved.

## Step 3 · KIE Cover Prompt

`generateCover(imageUrl, prompts, request)` converts the creative brief into the text payload sent to KIE (`generatePromptFromElements`).

Baseline instructions:

```
IMPORTANT: Use the provided product image as the EXACT BASE. Maintain the original product's exact visual appearance…
…
- Keep the original product's exact shape, size, and proportions
- Maintain all original colors, textures, and materials
- Preserve all distinctive design features and details
- Only enhance lighting, background, or add subtle marketing elements
- The product must remain visually identical to the original
```

Additional clauses:
- **Watermarks**: appended when `request.watermark?.text` is present. Location defaults to `bottom left`.
- **Ad copy**: appended when either `request.adCopy` or `prompts.ad_copy` exists; the text is escaped and must be used verbatim.
- **Sora2 safety**: when `request.shouldGenerateVideo !== false` and `request.videoModel === 'sora2'`, the prompt adds:
`Sora2 Safety Requirements:   - Do not include photorealistic humans, faces, or bodies   - Focus entirely on the product…   - Maintain a people-free composition…`
- **Length guard**: prompts longer than 5000 chars are truncated while preserving mandatory instructions, watermark text, and (if applicable) the Sora2 safety section.

## Step 4 · Cover Rendering & Video Generation

- **Image generation**: `generateCover` itself sends the KIE request (`https://api.kie.ai/api/v1/jobs/createTask`) using the mapped model (`IMAGE_MODELS`), the original product image as reference, and the size normalisation helper (`mapUiSizeToBanana`).
- **Video**: the JSON from Step 2 is stored as `video_prompts` on the project and later drives video creation; downstream steps rely on these fields without further mutation.

## Step 5 · Brand Ending Frame Generation (Optional)

`generateBrandEndingFrame(brandId, productImageUrl, aspectRatio, imageModel?)` creates a professional brand ending frame by combining the product image with the brand logo.

**Trigger conditions:**

- Only available for `veo3` and `veo3_fast` video models
- User must select a brand via the integrated ProductSelector → Brand Selection flow
- Brand must have a valid `brand_logo_url`
- Product cover image must be successfully generated first

**Prompt template** (exact string from `lib/standard-ads-workflow.ts:607-626`):

```jsx
Create a professional brand ending frame for video advertisement by combining the product image and brand logo provided.

Brand Information:
- Brand Name: {brand.brand_name}
{brand.brand_slogan ? `- Brand Slogan: "${brand.brand_slogan}"` : ''}

Design Requirements:
- Reference both the product image (first image) and brand logo (second image)
- Create a cohesive ending frame that showcases the product with prominent brand identity
- Position the brand logo strategically (bottom-third, corner, or integrated into the design)
{brand.brand_slogan ? `- Display "${brand.brand_slogan}" in elegant, readable typography` : ''}
- Maintain the product's visual appeal from the first image
- Professional composition that combines product showcase with brand elements
- Clean, premium aesthetic suitable for video conclusion
- Aspect ratio: {aspectRatio}
- Style: Modern, polished, memorable brand impression
- Ensure brand logo is clearly visible and recognizable
- Balance between product visibility and brand prominence
- High contrast for readability
- Professional color scheme that complements both product and brand identity
```

**Key points:**

- ✅ Uses **dual-image input**: Product cover image + Brand logo
- ✅ Prompt instructs to "Reference both the product image (first image) and brand logo (second image)"
- ✅ Creates a cohesive composition combining product and brand elements
- ✅ Images passed via `image_urls: [productImageUrl, brand.brand_logo_url]`
- ✅ AI generates a professional ending frame that balances product visibility with brand identity

**Technical details:**

- **API endpoint**: Same KIE endpoint as cover generation ([`https://api.kie.ai/api/v1/jobs/createTask`](https://api.kie.ai/api/v1/jobs/createTask))
- **Reference images**:
    - First image: Product cover image from Step 3 (`coverResult.imageUrl`)
    - Second image: Brand logo (`brand.brand_logo_url`)
- **Image model**: Defaults to `nano_banana`, supports `seedream`
- **Aspect ratio mapping**:
    - `nano_banana`: Uses `"16:9"` or `"9:16"` directly
    - `seedream`: Uses `"landscape_16_9"` or `"portrait_16_9"`
- **Output format**: PNG
- **Storage**: Task ID stored in `brand_ending_task_id`, final URL in `brand_ending_frame_url`

**Dual-image video workflow:**

When brand ending is enabled:

1. Cover image generated from product (Step 3)
2. Brand ending frame generated from **product cover + brand logo** (Step 5)
3. Video generation uses **two images**: cover as first frame, brand ending as last frame
4. Fallback: If brand frame fails, video uses single cover image only

**Database fields:**

- `selected_brand_id` - Reference to `user_brands` table
- `brand_ending_task_id` - KIE task ID for brand frame generation
- `brand_ending_frame_url` - Final generated brand ending frame URL

**Error handling:**

- If brand not found or brand logo missing → Skip brand ending, continue with single-image workflow
- If KIE generation fails → Log error, fallback to single-image video
- Monitor task checks `brand_ending_task_id` alongside `cover_task_id`

**Function signature change (2025-10-17):**

- **Old**: `generateBrandEndingFrame(brandId, aspectRatio, imageModel?)`
- **New**: `generateBrandEndingFrame(brandId, productImageUrl, aspectRatio, imageModel?)`
- **Reason**: Enable dual-image generation combining product and brand

## Sync Checklist

- Any edits to `describeImage`, `generateCreativePrompts`, or `generateCover` must be mirrored here immediately.
- Keep the ad-copy insertion rules in sync; downstream code assumes `dialogue` already matches the UI text.
- Watermark and Sora safety instructions should not diverge from the literal strings in `generateCover`.