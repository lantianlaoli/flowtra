# Standard Ads Workflow

## Overview

The Standard Ads workflow generates professional video advertisements from product images. It uses AI to analyze the product, create compelling marketing content, and produce high-quality videos suitable for advertising campaigns.

## Workflow Steps

```
User Upload → Image Description → Creative Prompts → Cover Generation → Video Generation → Final Output
```

## Technical Implementation

**Location**: `/lib/standard-ads-workflow.ts`
**API Endpoints**:
- `/api/standard-ads/create` - Start workflow
- `/api/standard-ads/[id]/status` - Check progress
- `/api/webhooks/standard-ads` - KIE API callbacks

## Step 1: Image Description

### Purpose
Analyze the uploaded product image to extract key features, benefits, and selling points for advertising purposes.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `google/gemini-2.0-flash-001` (configurable via `OPENROUTER_MODEL`)
- **Timeout**: 30 seconds
- **Retries**: 3

### Prompt Template

```typescript
{
  role: 'user',
  content: [
    {
      type: 'text',
      text: 'Describe this product image in detail for advertising purposes. Focus on key features, benefits, and selling points that would appeal to potential customers.'
    },
    {
      type: 'image_url',
      image_url: { url: imageUrl }
    }
  ]
}
```

### Expected Output
Detailed text description highlighting:
- Product features and specifications
- Visual appeal and design elements
- Target audience benefits
- Marketing angles

## Step 2: Creative Prompt Generation

### Purpose
Transform the product description into structured creative elements for video advertisement production.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `google/gemini-2.0-flash-001`
- **Timeout**: 30 seconds
- **Retries**: 3

### Prompt Template

```typescript
`Based on this product description: "${description}"

Generate a creative video advertisement prompt with these elements:
- description: Main scene description
- setting: Location/environment
- camera_type: Type of camera shot
- camera_movement: Camera movement style
- action: What happens in the scene
- lighting: Lighting setup
- dialogue: Spoken content/voiceover
- music: Music style
- ending: How the ad concludes
- other_details: Additional creative elements

Return as JSON format.`
```

### Expected Output (JSON)
```json
{
  "description": "Main scene description",
  "setting": "Location/environment",
  "camera_type": "Type of camera shot",
  "camera_movement": "Camera movement style",
  "action": "What happens in the scene",
  "lighting": "Lighting setup",
  "dialogue": "Spoken content/voiceover",
  "music": "Music style",
  "ending": "How the ad concludes",
  "other_details": "Additional creative elements"
}
```

### Fallback Structure
If JSON parsing fails, the system creates a default structure:
```json
{
  "description": "Professional product advertisement showcase",
  "setting": "Professional studio",
  "camera_type": "Close-up",
  "camera_movement": "Smooth pan",
  "action": "Product showcase",
  "lighting": "Soft professional lighting",
  "dialogue": "Highlighting key benefits",
  "music": "Upbeat commercial music",
  "ending": "Call to action",
  "other_details": "High-quality commercial style"
}
```

## Step 3: Cover Image Generation

### Purpose
Create an enhanced advertising version of the product image while maintaining the original product's exact appearance.

### AI Model Configuration
- **Provider**: KIE API
- **Models**:
  - `google/nano-banana-edit` (Nano Banana - fast)
  - `bytedance/seedream-v4-edit` (Seedream - high quality)
- **Callback URL**: `/api/webhooks/standard-ads`
- **Retries**: 5
- **Timeout**: 30 seconds

### Base Prompt Template

```typescript
`IMPORTANT: Use the provided product image as the EXACT BASE. Maintain the original product's exact visual appearance, shape, design, colors, textures, and all distinctive features. DO NOT change the product itself.

Based on the provided product image, create an enhanced advertising version that keeps the EXACT SAME product while only improving the presentation for marketing purposes. ${baseDescription}

Requirements:
- Keep the original product's exact shape, size, and proportions
- Maintain all original colors, textures, and materials
- Preserve all distinctive design features and details
- Only enhance lighting, background, or add subtle marketing elements
- The product must remain visually identical to the original`
```

### Watermark Enhancement
When watermark is requested:
```typescript
`Watermark Requirements:
- Add text watermark: "${watermarkText}"
- Watermark location: ${watermarkLocation || 'bottom left'}
- Make the watermark visible but not overpowering
- Use appropriate font size and opacity for the watermark`
```

### Request Body Structure
```json
{
  "model": "google/nano-banana-edit", // or bytedance/seedream-v4-edit
  "callBackUrl": "https://your-domain.com/api/webhooks/standard-ads",
  "input": {
    "prompt": "Generated prompt text",
    "image_urls": ["https://original-product-image.jpg"],
    "output_format": "png",
    "image_size": "auto" // or specific size
  }
}
```

### Critical Requirements
- **Character limit**: 5000 characters (KIE API limit)
- **Product preservation**: Original product must remain visually identical
- **Enhancement only**: Only improve lighting, background, or add marketing elements
- **Watermark support**: Optional text watermark with configurable location

## Step 4: Video Generation

### Purpose
Generate the final video advertisement using the enhanced cover image and creative prompts.

### AI Model Configuration
- **Provider**: KIE API (Veo3)
- **Models**:
  - `veo3_fast` (30 credits, 2-3 min processing)
  - `veo3` (150 credits, 5-8 min processing)
- **Auto mode**: Defaults to `veo3_fast`

### Video Generation Process
The video generation process is automatically triggered after successful cover generation through webhook callbacks or polling mechanisms.

## Cost Structure

| Component | Credits | Notes |
|-----------|---------|-------|
| Image Description | ~1-2 | OpenRouter API usage |
| Prompt Generation | ~1-2 | OpenRouter API usage |
| Cover Generation | Free | KIE API (Nano Banana/Seedream) |
| Video Generation (Fast) | 30 | Veo3 Fast model |
| Video Generation (HQ) | 150 | Veo3 High Quality model |
| **Total (Fast)** | **~35** | Complete workflow |
| **Total (HQ)** | **~155** | Complete workflow |

## Processing Times

| Step | Duration | Notes |
|------|----------|-------|
| Image Description | 10-30s | OpenRouter processing |
| Prompt Generation | 10-30s | OpenRouter processing |
| Cover Generation | 1-4 min | Depends on image model |
| Video Generation (Fast) | 2-3 min | Veo3 Fast |
| Video Generation (HQ) | 5-8 min | Veo3 High Quality |
| **Total (Fast)** | **4-8 min** | End-to-end |
| **Total (HQ)** | **7-13 min** | End-to-end |

## Status Monitoring

### Database States
- `processing` - Workflow in progress
- `completed` - Successfully finished
- `failed` - Error occurred

### Progress Steps
- `describing` (10%) - Analyzing product image
- `generating_cover` (30%) - Creating enhanced cover image
- `generating_video` (60%) - Producing final video
- `completed` (100%) - Ready for download

## Error Handling

### Common Failure Points
1. **OpenRouter API failures**: Network issues, rate limits, invalid responses
2. **KIE API failures**: Credit insufficient, generation failures, timeout
3. **Image processing**: Invalid URLs, unsupported formats
4. **Prompt parsing**: JSON parsing failures, malformed responses

### Retry Logic
- **OpenRouter**: 3 retries with exponential backoff
- **KIE API**: 5 retries for robustness
- **Webhook failures**: Polling fallback mechanism

## Configuration Variables

```typescript
// Environment Variables
OPENROUTER_API_KEY        // OpenRouter authentication
OPENROUTER_MODEL          // AI model selection
KIE_API_KEY              // KIE API authentication
KIE_CREDIT_THRESHOLD     // Minimum credits for availability

// Callback URLs
KIE_STANDARD_ADS_CALLBACK_URL  // Webhook endpoint

// Processing Settings
MAX_PROMPT_LENGTH = 5000       // KIE API character limit
DEFAULT_VIDEO_MODEL = 'veo3_fast'  // Auto mode selection
```

## Integration Points

### Frontend Components
- `/app/dashboard/standard-ads/page.tsx` - Main interface
- Credit checking and user validation
- Real-time progress updates

### API Endpoints
- `POST /api/standard-ads/create` - Initialize workflow
- `GET /api/standard-ads/[id]/status` - Progress tracking
- `POST /api/webhooks/standard-ads` - KIE API callbacks
- `GET /api/standard-ads/history` - User project history

### Database Schema
- Table: `standard_ads_projects`
- Fields: `user_id`, `original_image_url`, `video_model`, `status`, `current_step`, `progress_percentage`, `cover_task_id`, `video_prompts`, `product_description`, `watermark_text`, `watermark_location`, etc.

## Best Practices

1. **Image Quality**: Use high-resolution product images for best results
2. **Prompt Clarity**: Ensure product descriptions are detailed and accurate
3. **Credit Management**: Monitor user credits before starting workflows
4. **Error Recovery**: Implement robust retry mechanisms for API failures
5. **User Feedback**: Provide clear progress indicators and error messages