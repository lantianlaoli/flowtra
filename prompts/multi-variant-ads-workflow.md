# Multi-Variant Ads Workflow

## Overview

The Multi-Variant Ads workflow generates multiple advertisement variants from a single image. It analyzes the uploaded content, creates diverse creative elements for each variant, and produces multiple unique advertisements with different tones, moods, or creative angles.

## Workflow Steps

```
User Upload → Image Analysis → Elements Generation → Cover Prompt Creation → Cover Generation (per variant) → Final Outputs
```

## Technical Implementation

**Location**: `/lib/multi-variant-ads-workflow.ts`
**API Endpoints**:
- `/api/multi-variant-ads/create` - Start workflow
- `/api/multi-variant-ads/[id]/status` - Check progress
- `/api/webhooks/multi-variant-ads` - KIE API callbacks

## Step 1: Image Analysis

### Purpose
Analyze the uploaded image to determine content type (product, character, or both) and extract detailed visual information for variant generation.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini` (configurable via `OPENROUTER_MODEL`)
- **Timeout**: 30 seconds
- **Retries**: 3
- **Temperature**: 0.2 (for consistent analysis)

### Prompt Template

```typescript
const systemText = `Analyze the given image and determine if it primarily depicts a product or a character, or BOTH.`;

// Strict JSON Schema structure
const jsonSchema = {
  name: "image_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["product", "character", "both"],
        description: "The type of content in the image: product, character, or both"
      },
      product: {
        type: "object",
        description: "Product details (required if type is 'product' or 'both')",
        properties: {
          brand_name: {
            type: "string",
            description: "Name of the brand shown in the image, if visible or inferable"
          },
          color_scheme: {
            type: "array",
            description: "List of prominent colors used in the product",
            items: {
              type: "object",
              properties: {
                hex: {
                  type: "string",
                  description: "Hex code of the color (e.g., #FF5733)"
                },
                name: {
                  type: "string",
                  description: "Descriptive name of the color (e.g., 'Vibrant Red')"
                }
              },
              required: ["hex", "name"]
            }
          },
          font_style: {
            type: "string",
            description: "Description of the font family or style used (serif/sans-serif, bold/thin, etc.)"
          },
          visual_description: {
            type: "string",
            description: "A full sentence or two summarizing what is seen in the product, ignoring the background"
          }
        },
        required: ["brand_name", "color_scheme", "visual_description"]
      },
      character: {
        type: "object",
        description: "Character details (required if type is 'character' or 'both')",
        properties: {
          outfit_style: {
            type: "string",
            description: "Description of clothing style, accessories, or notable features"
          },
          visual_description: {
            type: "string",
            description: "A full sentence or two summarizing what the character looks like, ignoring the background"
          }
        },
        required: ["outfit_style", "visual_description"]
      }
    },
    required: ["type"],
    additionalProperties: false
  }
}
```

### Expected Output (JSON)
```json
{
  "type": "product|character|both",
  "product": {
    "brand_name": "Brand name if visible",
    "color_scheme": [
      {
        "hex": "#FF5733",
        "name": "Vibrant Red"
      }
    ],
    "font_style": "Sans-serif, bold",
    "visual_description": "Product description ignoring background"
  },
  "character": {
    "outfit_style": "Clothing and accessory description",
    "visual_description": "Character appearance description"
  }
}
```

## Step 2: Multiple Elements Generation

### Purpose
Create multiple distinct creative elements sets, each with different tone, mood, or creative angle for generating diverse advertisement variants.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini`
- **Timeout**: 30 seconds
- **Retries**: 3
- **Temperature**: 0.7 (for creative variety)

### Prompt Template

```typescript
const systemPrompt = `### A - Ask:
Create exactly ${elementsCount} different sets of ELEMENTS for the uploaded ad image.
Each set must include **all required fields** and differ in tone, mood, or creative angle.

### G - Guidance:
**role:** Creative ad concept generator
**output_count:** ${elementsCount} sets

**constraints:**
- product → Product or line name
- character → Target user/consumer who would use this product (e.g., for jewelry: "young professional woman", for pet food: "golden retriever", for skincare: "woman in her 30s", for sports gear: "athletic young man")
${adCopyInstruction}
- visual_guide → Describe character's pose, product placement, background mood
- Primary color → Main color (from packaging/ad)
- Secondary color → Supporting color
- Tertiary color → Accent color

### E - Examples:
{
  "elements": [
    {
      "product": "Happy Dog Sensible Montana",
      "character": "Short-haired hunting dog",
      "ad_copy": "Natural energy, every day.",
      "visual_guide": "The hunting dog sits calmly beside the pack, background is a soft green gradient, product facing forward and clearly highlighted.",
      "Primary color": "#1A3D2F",
      "Secondary color": "#FFFFFF",
      "Tertiary color": "#C89B3C"
    }
  ]
}`;

const userPrompt = `Description of the reference image: ${JSON.stringify(imageAnalysis, null, 2)}

Generate ${elementsCount} sets of elements for this image.`;
```

### Ad Copy Handling
```typescript
const adCopyInstruction = userAdCopy
  ? `- ad_copy → Use this exact ad copy for all variants: "${userAdCopy}"`
  : `- ad_copy → Short, catchy slogan`;
```

### JSON Schema Response Format
```json
{
  "elements": [
    {
      "product": "Product or line name",
      "character": "Target character description",
      "ad_copy": "Short, catchy slogan",
      "visual_guide": "Character pose, product placement, background mood",
      "Primary color": "#HEX_CODE",
      "Secondary color": "#HEX_CODE",
      "Tertiary color": "#HEX_CODE"
    }
  ]
}
```

## Step 3: Cover Prompt Generation

### Purpose
Transform each element set into a detailed image generation prompt that maintains the user's exact ad copy while creating visually distinct variants.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini`
- **Temperature**: 0.5 (balanced creativity and consistency)

### Prompt Template

```typescript
const systemPrompt = `## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent

### A - Ask:
Create exactly 1 structured image ad prompt with all required fields filled.

The final prompt should be written like this:

"""
Make an image ad for this product with the following elements. The product looks exactly like what's in the reference image.

product:
character:
ad_copy:
visual_guide:
text_watermark:
text_watermark_location:
Primary color of ad:
Secondary color of ad:
Tertiary color of ad:
"""

### G - Guidance:
**role:** Creative ad prompt engineer
**output_count:** 1
**constraints:**
- Always include all required fields.
- Integrate the user's special request as faithfully as you can in the final image prompt.
- **CRITICAL: If ad_copy is provided by the user, you MUST use it EXACTLY as given. DO NOT modify, rephrase, or replace user-provided ad_copy under any circumstances.**
- If user input is missing, apply smart defaults:
  - **text_watermark_location** → "bottom left of screen"
  - **primary_color** → "decide based on the image provided"
  - **secondary_color** → "decide based on the image provided"
  - **tertiary_color** → "decide based on the image provided"
  - **font_style** → "decide based on the image provided"
  - **ad_copy** → ONLY generate if not provided by user. Keep short, punchy, action-oriented.
  - **visual_guide** → (as defined by the user). If the user's special request is detailed, expand this portion to accommodate their request.

### N - Notation:
**format:** text string nested within an "image_prompt" parameter. Avoid using double-quotes or new line breaks.
**example_output:** |
{
  "image_prompt": "final prompt here"
}`;

const userPrompt = `Your task: Create 1 image prompt as guided by your system guidelines.

Description of the reference image: ${JSON.stringify(imageAnalysis, null, 2)}

ELEMENTS FOR THIS IMAGE:

product: ${firstElement.product}
character: ${firstElement.character}
ad copy: ${firstElement.ad_copy} [USER PROVIDED - USE EXACTLY AS GIVEN]
visual_guide: ${firstElement.visual_guide}
text_watermark: ${textWatermark || ''}
text_watermark_location: ${textWatermarkLocation || 'bottom left'}

Primary color: ${firstElement['Primary color']}
Secondary color: ${firstElement['Secondary color']}
Tertiary color: ${firstElement['Tertiary color']}

IMPORTANT: The ad_copy "${firstElement.ad_copy}" was provided by the user and must be used EXACTLY as written in the final prompt. Do not modify, rephrase, or replace it.`;
```

### Expected Output
```json
{
  "image_prompt": "Complete structured prompt text that includes all required elements formatted for image generation"
}
```

## Step 4: Cover Image Generation

### Purpose
Generate the actual cover image for each variant using the structured prompts and original reference image.

### AI Model Configuration
- **Provider**: KIE API
- **Models**:
  - `google/nano-banana-edit` (Nano Banana - fast)
  - `bytedance/seedream-v4-edit` (Seedream - high quality)
- **Callback URL**: `/api/webhooks/multi-variant-ads`
- **Retries**: 5

### Request Body Structure
```json
{
  "model": "google/nano-banana-edit", // or bytedance/seedream-v4-edit
  "callBackUrl": "https://your-domain.com/api/webhooks/multi-variant-ads",
  "input": {
    "prompt": "Generated image_prompt from Step 3",
    "image_urls": ["https://original-reference-image.jpg"],
    "output_format": "png",
    "image_size": "auto" // mapped from user selection
  }
}
```

### Image Size Mapping
```typescript
const sizeMap = {
  'auto': 'auto',
  '1024x1024': '1:1',
  '1080x1080': '1:1',
  '1200x630': '16:9',
  'square': '1:1',
  'landscape': '16:9',
  'portrait': '9:16'
};
```

## Optimized Workflow Process

### Batch Processing Strategy
The workflow optimizes performance by:

1. **Single Image Analysis**: Analyze the reference image once for all variants
2. **Batch Elements Generation**: Generate all element sets in one API call
3. **Parallel Cover Generation**: Create covers for each variant simultaneously
4. **Individual Project Tracking**: Each variant gets its own project record

### Processing Flow
```typescript
async function startOptimizedMultiVariantWorkflow(projectIds: string[], request: MultiVariantAdsRequest) {
  // Step 1: Analyze image (execute only once)
  const imageAnalysis = await analyzeImage(request.imageUrl);

  // Step 2: Generate multiple elements (execute only once)
  const elementsData = await generateMultipleElements(imageAnalysis, projectIds.length, request.adCopy);

  // Step 3 & 4: Generate different cover prompts and covers for each project
  for (let i = 0; i < projectIds.length; i++) {
    const element = elements[i] || elements[0];

    // Generate cover prompt for current project
    const coverPrompt = await generateCoverPrompt(imageAnalysis, { elements: [element] });

    // Generate cover image
    const coverTaskId = await generateMultiVariantCover(request);
  }
}
```

## Cost Structure

| Component | Credits | Notes |
|-----------|---------|-------|
| Image Analysis | ~1-2 | OpenRouter API (once per batch) |
| Elements Generation | ~2-3 | OpenRouter API (once per batch) |
| Cover Prompt (per variant) | ~1-2 | OpenRouter API (per variant) |
| Cover Generation | Free | KIE API (Nano Banana/Seedream) |
| **Total per variant** | **~4-7** | Excluding initial analysis |
| **Total for 2 variants** | **~6-10** | Most common use case |
| **Total for 3 variants** | **~8-13** | Maximum variants |

## Processing Times

| Step | Duration | Notes |
|------|----------|-------|
| Image Analysis | 10-30s | Once per batch |
| Elements Generation | 15-45s | Once per batch |
| Cover Prompt (per variant) | 10-30s | Per variant |
| Cover Generation (per variant) | 1-4 min | Depends on image model |
| **Total for 2 variants** | **3-10 min** | End-to-end |
| **Total for 3 variants** | **4-15 min** | End-to-end |

## Status Monitoring

### Database States
- `analyzing_images` - Initial image analysis
- `generating_elements` - Creating element variations
- `generating_cover_prompt` - Building structured prompts
- `generating_cover` - Creating final images
- `completed` - All variants ready
- `error` - Workflow failed

### Progress Tracking
- `analyzing_images` (10%) - Understanding content
- `generating_elements` (20%) - Creating variations
- `generating_cover_prompt` (30%) - Building prompts
- `generating_cover` (40-90%) - Creating images
- `completed` (100%) - All variants ready

## Error Handling

### Common Failure Points
1. **JSON Parsing Errors**: Malformed AI responses
2. **Element Generation Failures**: Insufficient creative diversity
3. **Image Generation Timeouts**: KIE API processing delays
4. **Prompt Length Limits**: Exceeding API character limits

### Recovery Mechanisms
- **Prompt Fallbacks**: Default structures when parsing fails
- **Retry Logic**: 3-5 retries with exponential backoff
- **Individual Variant Isolation**: Failed variants don't affect others
- **Graceful Degradation**: Use first element for missing variants

## Configuration Variables

```typescript
// Environment Variables
OPENROUTER_API_KEY              // OpenRouter authentication
OPENROUTER_MODEL               // AI model selection
KIE_API_KEY                   // KIE API authentication

// Callback URLs
KIE_MULTI_VARIANT_ADS_CALLBACK_URL  // Webhook endpoint

// Processing Settings
MAX_ELEMENTS_COUNT = 3         // Maximum variants per request
DEFAULT_IMAGE_MODEL = 'auto'   // Auto mode selection
```

## Integration Points

### Frontend Components
- `/app/dashboard/multi-variant-ads/page.tsx` - Main interface
- Multiple variant preview and management
- Batch processing status indicators

### API Endpoints
- `POST /api/multi-variant-ads/create` - Initialize workflow
- `GET /api/multi-variant-ads/[id]/status` - Progress tracking
- `POST /api/webhooks/multi-variant-ads` - KIE API callbacks
- `GET /api/multi-variant-ads/history` - User project history

### Database Schema
- Table: `multi_variant_ads_projects`
- Fields: `user_id`, `original_image_url`, `status`, `current_step`, `progress_percentage`, `product_description`, `elements_data`, `image_prompt`, `cover_task_id`, `watermark_text`, `watermark_location`, etc.

## Best Practices

1. **Batch Efficiency**: Process common steps once for all variants
2. **Element Diversity**: Ensure each variant has distinct creative angle
3. **Ad Copy Preservation**: Never modify user-provided ad copy
4. **Error Isolation**: Handle individual variant failures gracefully
5. **Progress Clarity**: Provide clear status updates for batch operations
6. **Resource Management**: Monitor API usage across multiple variants