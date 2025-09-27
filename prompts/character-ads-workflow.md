# Character Ads Workflow

## Overview

The Character Ads workflow creates character-based advertisements with UGC (User Generated Content) style. It analyzes both person and product images, generates authentic scene prompts, and produces videos with realistic character interactions. The workflow supports multiple video durations and includes advanced video merging capabilities.

## Workflow Steps

```
User Upload (Person + Product) → Image Analysis → Prompt Generation → Image Generation → Video Generation → Video Merging → Final Output
```

## Technical Implementation

**Location**: `/lib/character-ads-workflow.ts`
**API Endpoints**:
- `/api/character-ads/create` - Start workflow
- `/api/character-ads/[id]/status` - Check progress
- `/api/webhooks/character-ads` - KIE API callbacks

## Step 1: Dual Image Analysis

### Purpose
Analyze both person/character image and product image separately to extract comprehensive information for character-based advertisement creation.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini` (configurable via `OPENROUTER_MODEL`)
- **Timeout**: 30 seconds
- **Temperature**: 0.2 (for consistent analysis)

### Prompt Template

```typescript
const systemText = `You will be provided with TWO images for analysis:
1. The FIRST image shows a person/character
2. The SECOND image shows a product

Analyze BOTH images separately and return a combined analysis in the following JSON format:

{
  "type": "character",
  "character": {
    "outfit_style": "(Description of the person's clothing style, accessories, or notable features from the first image)",
    "visual_description": "(A full sentence or two summarizing what the character/person looks like, ignoring the background)"
  },
  "product": {
    "brand_name": "(Name of the brand shown in the product image, if visible or inferable)",
    "color_scheme": [
      {
        "hex": "(Hex code of each prominent color used in the product)",
        "name": "(Descriptive name of the color)"
      }
    ],
    "font_style": "(Describe any font family or style used on the product: serif/sans-serif, bold/thin, etc. Use 'N/A' if no text visible)",
    "visual_description": "(A full sentence or two summarizing what is seen in the product image, ignoring the background)"
  }
}

Important:
- Always analyze the character from the FIRST image and the product from the SECOND image
- Always use "type": "character" since this is for character spokesperson ads
- Provide detailed descriptions that will help generate realistic video prompts featuring the character with the product`;

const requestBody = {
  model: 'openai/gpt-4o-mini',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: systemText },
        { type: 'image_url', image_url: { url: personImageUrl } },
        { type: 'image_url', image_url: { url: productImageUrl } }
      ]
    }
  ],
  max_tokens: 700,
  temperature: 0.2
};
```

### Expected Output (JSON)
```json
{
  "type": "character",
  "character": {
    "outfit_style": "Casual business attire with modern accessories",
    "visual_description": "Professional woman in her 30s with confident expression and stylish appearance"
  },
  "product": {
    "brand_name": "Brand Name or Product Line",
    "color_scheme": [
      {
        "hex": "#FF5733",
        "name": "Vibrant Orange"
      },
      {
        "hex": "#1A1A1A",
        "name": "Deep Black"
      }
    ],
    "font_style": "Modern sans-serif, bold weight",
    "visual_description": "Sleek product packaging with premium finish and clear branding"
  }
}
```

## Step 2: UGC-Style Prompt Generation

### Purpose
Generate authentic UGC-style prompts for multiple scenes, including one image scene and multiple video scenes based on duration. Each scene maintains character consistency and includes natural dialogue.

### AI Model Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini`
- **Temperature**: 0.7 (for creative variation)
- **Max Tokens**: 2000

### Duration-Based Scene Calculation
```typescript
const videoScenes = videoDurationSeconds / 8; // Each scene is 8 seconds
// Supported durations: 8s (1 scene), 16s (2 scenes), 24s (3 scenes), 32s (4 scenes)
```

### Voice Type Detection and Accent Selection
```typescript
// Helper function to generate voice type based on accent and gender
function generateVoiceType(accent: string, isMale: boolean): string {
  const accentMap: Record<string, string> = {
    'australian': 'Australian',
    'american': 'American',
    'british': 'British',
    'canadian': 'Canadian',
    'irish': 'Irish',
    'south_african': 'South African'
  };

  const accentName = accentMap[accent] || 'Australian';
  const voiceGender = isMale ? 'deep male voice' : 'deep female voice';

  return `${accentName} accent, ${voiceGender}`;
}

const characterInfo = analysisResult?.character?.visual_description || '';
const isCharacterMale = characterInfo.toLowerCase().includes('man') ||
                       characterInfo.toLowerCase().includes('male') ||
                       characterInfo.toLowerCase().includes('boy') ||
                       characterInfo.toLowerCase().includes('guy');

const voiceType = generateVoiceType(accent, isCharacterMale);
```

### Prompt Template

```typescript
const systemPrompt = `
UGC Image + Video Prompt Generator 🎥🖼️
Have Scene 0 as the image prompt and Scenes 1 onward are the video prompts

Your task: Create 1 image prompt and ${videoScenes} video prompts as guided by your system guidelines. Scene 0 will be the image prompt, and Scenes 1 onward will be the video prompts.

Use **UGC - style casual realism** principles:
- Everyday realism with authentic, relatable environments
- Amateur iPhone photo/video style
- Slightly imperfect framing and natural lighting
- Candid poses, genuine expressions

For Scene 0 (image prompt):
- At the beginning, use this prefix: "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible"
- Use casual, amateur iPhone selfie style
- UGC, unfiltered, realistic
- IMPORTANT: Keep the character consistent with the reference image analysis

For Scene 1+ (video prompts):
- Each scene is 8 seconds long
- Include dialogue with casual, spontaneous tone (under 150 characters)
- Describe accent and voice style consistently
- Prefix video prompts with: "dialogue, the character in the video says:"
- Use ${voiceType}
- Camera movement: fixed
- Avoid mentioning copyrighted characters
- Don't refer back to previous scenes
- CRITICAL: Maintain character consistency - the same person from the reference image should appear in all scenes
- CRITICAL: Maintain product consistency - focus on the same product throughout all scenes

Return in JSON format:
{
  "scenes": [
    {
      "scene": 0,
      "prompt": {
        "action": "character holds product casually",
        "character": "inferred from image",
        "product": "the product in the reference image",
        "setting": "casual everyday environment",
        "camera": "amateur iPhone selfie, slightly uneven framing, casual vibe",
        "style": "UGC, unfiltered, realistic"
      }
    },
    {
      "scene": 1,
      "prompt": {
        "video_prompt": "dialogue, the character in the video says: [casual dialogue]",
        "voice_type": "Selected accent, deep female voice",
        "emotion": "chill, upbeat",
        "setting": "[casual environment]",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    }
    // ... additional video scenes based on duration
  ]
}`;

const userPrompt = `Description of the reference images are given below:
${JSON.stringify(analysisResult, null, 2)}

Generate prompts for ${videoScenes} video scenes (8 seconds each) plus 1 image scene.`;
```

### Expected Output Structure
```json
{
  "scenes": [
    {
      "scene": 0,
      "prompt": {
        "action": "Character showcasing product naturally",
        "character": "Character description from analysis",
        "product": "Product from reference image",
        "setting": "Casual everyday environment",
        "camera": "Amateur iPhone selfie style",
        "style": "UGC, unfiltered, realistic"
      }
    },
    {
      "scene": 1,
      "prompt": {
        "video_prompt": "dialogue, the character in the video says: 'Hey everyone, check this out!'",
        "voice_type": "Selected accent, deep female voice",
        "emotion": "excited, authentic",
        "setting": "Living room or casual space",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    }
  ]
}
```

## Step 3: Image Generation

### Purpose
Generate the hero image (Scene 0) using the character and product reference images with the UGC-style prompt.

### AI Model Configuration
- **Provider**: KIE API
- **Models**:
  - `google/nano-banana-edit` (Nano Banana - fast, 16:9 format)
  - `bytedance/seedream-v4-edit` (Seedream - high quality, landscape_16_9)
- **Retries**: 5
- **Timeout**: 30 seconds

### Model-Specific Parameters

#### Nano Banana Parameters
```json
{
  "image_size": "16:9",
  "output_format": "png"
}
```

#### Seedream V4 Parameters
```json
{
  "image_size": "landscape_16_9",
  "image_resolution": "1K",
  "max_images": 1
}
```

### Request Body Structure
```json
{
  "model": "google/nano-banana-edit", // or bytedance/seedream-v4-edit
  "input": {
    "prompt": "JSON stringified Scene 0 prompt",
    "image_urls": ["person_image_url", "product_image_url"],
    "image_size": "16:9", // or "landscape_16_9" for Seedream
    "output_format": "png" // Nano Banana only
  },
  "callBackUrl": "https://domain.com/api/webhooks/character-ads" // Optional
}
```

## Step 4: Video Generation

### Purpose
Generate video scenes using the enhanced image as reference and the scene-specific prompts with character dialogue.

### AI Model Configuration
- **Provider**: KIE API (Veo3)
- **Models**:
  - `veo3_fast` (30 credits, 2-3 min processing)
  - `veo3` (150 credits, 5-8 min processing)
- **Aspect Ratio**: 16:9
- **Audio**: Enabled
- **Duration**: 8 seconds per scene

### Request Body Structure
```json
{
  "prompt": "JSON stringified video prompt",
  "model": "veo3_fast", // or "veo3"
  "aspectRatio": "16:9",
  "imageUrls": ["generated_image_url"],
  "enableAudio": true,
  "audioEnabled": true,
  "generateVoiceover": false,
  "includeDialogue": false
}
```

### Processing Flow
```typescript
// Generate video for each scene
for (let i = 1; i <= videoScenes; i++) {
  const videoPrompt = prompts.scenes[i].prompt;

  const { taskId } = await generateVideoWithKIE(
    videoPrompt,
    project.video_model,
    project.generated_image_url // Use generated image as reference
  );

  videoTaskIds.push(taskId);
}
```

## Step 5: Video Merging (Multi-Scene Only)

### Purpose
For videos longer than 8 seconds, merge individual scene videos into a single cohesive advertisement.

### AI Model Configuration
- **Provider**: FAL AI
- **Service**: `fal-ai/ffmpeg-api/merge-videos`
- **Resolution**: `landscape_16_9` (HD quality)
- **Target FPS**: 30

### Merge Conditions
```typescript
if (project.video_duration_seconds === 8) {
  // For 8-second videos, use the single generated video directly
  merged_video_url = videoUrls[0];
} else {
  // For longer videos, proceed with merging
  const { taskId } = await mergeVideosWithFal(videoUrls);
}
```

### FAL AI Request Structure
```json
{
  "input": {
    "video_urls": ["scene1_url", "scene2_url", "scene3_url"],
    "target_fps": 30,
    "resolution": "landscape_16_9"
  },
  "logs": true
}
```

### Retry Logic for Network Issues
```typescript
async function checkFalTaskStatus(taskId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  try {
    const result = await fal.queue.status("fal-ai/ffmpeg-api/merge-videos", {
      requestId: taskId
    });

    return processResult(result);
  } catch (error) {
    const isNetworkError = error.message.includes('fetch failed') ||
                          error.message.includes('EAI_AGAIN') ||
                          error.message.includes('ENOTFOUND');

    if (isNetworkError && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return checkFalTaskStatus(taskId, retryCount + 1);
    }

    throw error;
  }
}
```

## Cost Structure

| Component | Credits | Notes |
|-----------|---------|-------|
| Image Analysis | ~1-2 | OpenRouter API |
| Prompt Generation | ~2-3 | OpenRouter API |
| Image Generation | Free | KIE API (Nano Banana/Seedream) |
| Video Generation (8s) | 30/150 | 1 scene (Veo3 Fast/HQ) |
| Video Generation (16s) | 60/300 | 2 scenes |
| Video Generation (24s) | 90/450 | 3 scenes |
| Video Generation (32s) | 120/600 | 4 scenes |
| Video Merging | Free | FAL AI |
| **Total (8s, Fast)** | **~35** | Single scene |
| **Total (32s, Fast)** | **~125** | Maximum duration |

## Processing Times

| Component | Duration | Notes |
|-----------|----------|-------|
| Image Analysis | 10-30s | Dual image processing |
| Prompt Generation | 15-45s | Multiple scenes |
| Image Generation | 1-4 min | Depends on model |
| Video Generation (per scene) | 2-8 min | Depends on quality |
| Video Merging | 2-5 min | FAL AI processing |
| **Total (8s)** | **4-12 min** | Single scene workflow |
| **Total (32s)** | **15-40 min** | Maximum duration workflow |

## Status Monitoring

### Workflow Steps
1. `analyze_images` - Dual image analysis
2. `generate_prompts` - Scene prompt creation
3. `generate_image` - Hero image creation
4. `check_image_status` - Image completion check
5. `generate_videos` - Video scene creation
6. `check_videos_status` - Video completion check
7. `merge_videos` - Multi-scene combining (if needed)
8. `check_merge_status` - Merge completion check

### Database States
- `processing` - Workflow in progress
- `completed` - All content ready
- `failed` - Error occurred

### Progress Tracking
- `analyze_images` (20%) - Understanding content
- `generate_prompts` (40%) - Creating scene structure
- `generate_image` (60%) - Hero image ready
- `generate_videos` (85%) - Video scenes ready
- `merge_videos` (95%) - Combining scenes (if applicable)
- `completed` (100%) - Final video ready

## Error Handling

### Common Failure Points
1. **Dual Image Analysis**: Missing or invalid person/product images
2. **Character Consistency**: Maintaining same person across scenes
3. **Video Generation Timeouts**: Long processing times for multiple scenes
4. **Network Issues**: FAL AI connectivity problems during merging

### Recovery Mechanisms
- **Image Validation**: Check both person and product images before processing
- **Scene Isolation**: Failed scenes don't affect others
- **Merge Fallbacks**: Use individual scenes if merging fails
- **Network Resilience**: Retry logic for FAL AI network issues

## Accent Selection Feature

### Supported Accents
The Character Ads workflow now supports multiple English accents for voice generation:

| Accent | Label | Description |
|--------|-------|-------------|
| `australian` | Australian 🇦🇺 | Warm, friendly Australian accent |
| `american` | American 🇺🇸 | Clear, professional American accent |
| `british` | British 🇬🇧 | Sophisticated British accent |
| `canadian` | Canadian 🇨🇦 | Friendly, approachable Canadian accent |
| `irish` | Irish 🇮🇪 | Charming, melodic Irish accent |
| `south_african` | South African 🇿🇦 | Distinctive South African accent |

### Frontend Implementation
The accent selection is implemented through the `AccentSelector` component in the Character Ads configuration panel. Users can choose their preferred accent which will be applied to all video scenes with dialogue.

### Database Schema
```sql
-- accent column in character_ads_projects table
accent VARCHAR(20) NOT NULL DEFAULT 'australian'
CHECK (accent IN ('australian', 'american', 'british', 'canadian', 'irish', 'south_african'))
```

### API Integration
The accent parameter is passed through the entire workflow:
1. **Frontend**: User selects accent in AccentSelector component
2. **API**: `/api/character-ads/create` validates and stores accent
3. **Workflow**: `generatePrompts()` uses accent to create voice_type
4. **Output**: Video prompts include the selected accent in dialogue instructions

## Configuration Variables

```typescript
// Environment Variables
OPENROUTER_API_KEY              // OpenRouter authentication
KIE_API_KEY                    // KIE API authentication
FAL_KEY                        // FAL AI authentication

// Callback URLs
KIE_CHARACTER_ADS_CALLBACK_URL  // Optional webhook endpoint

// Processing Settings
SCENE_DURATION = 8             // Seconds per video scene
MAX_SCENES = 4                 // Maximum scenes (32s total)
DEFAULT_VIDEO_MODEL = 'veo3_fast'  // Auto mode selection
DEFAULT_ACCENT = 'australian'  // Default accent selection
```

## Integration Points

### Frontend Components
- `/app/dashboard/character-ads/page.tsx` - Main interface
- Dual image upload (person + product)
- Duration selection and scene preview
- Accent selection with AccentSelector component
- Character consistency validation

### API Endpoints
- `POST /api/character-ads/create` - Initialize workflow
- `GET /api/character-ads/[id]/status` - Progress tracking
- `POST /api/webhooks/character-ads` - KIE API callbacks
- `GET /api/character-ads/history` - User project history

### Database Schema
- **Main Table**: `character_ads_projects`
- **Scene Table**: `character_ads_scenes`
- **Fields**: `user_id`, `person_image_urls`, `product_image_urls`, `video_duration_seconds`, `image_model`, `video_model`, `accent`, `status`, `current_step`, `progress_percentage`, `image_analysis_result`, `generated_prompts`, `generated_image_url`, `generated_video_urls`, `merged_video_url`, etc.

## Best Practices

1. **Character Consistency**: Ensure same person appears across all scenes
2. **Natural Dialogue**: Keep voice-overs casual and authentic
3. **UGC Authenticity**: Maintain amateur, unfiltered aesthetic
4. **Duration Planning**: Choose appropriate scene count for message complexity
5. **Quality vs Speed**: Balance video quality with processing time requirements
6. **Error Isolation**: Handle individual scene failures gracefully
7. **Network Resilience**: Implement robust retry mechanisms for video processing