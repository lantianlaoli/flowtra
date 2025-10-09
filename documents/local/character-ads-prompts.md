# Character Ads Prompt Templates

This document contains all the AI prompts used in the Character Ads workflow for creating character-based advertisements with UGC (User Generated Content) style.

## Workflow Overview

The Character Ads workflow follows these steps:
1. **Dual Image Analysis** - Analyze both person/character and product images
2. **Prompt Generation** - Create UGC-style prompts for image and video scenes
3. **Image/Video Generation** - Generate content based on prompts

## Step 1: Dual Image Analysis

### Purpose
Analyze both person/character image and product image separately to extract comprehensive information for character-based advertisement creation.

### AI Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini`
- **Timeout**: 30 seconds
- **Temperature**: 0.2 (for consistent analysis)

### System Prompt
```typescript
`Analyze the given images and provide structured information for character-based advertisement creation.

For the PERSON/CHARACTER image:
- Describe the person's appearance, clothing, style, and characteristics
- Note any distinctive features that should be maintained across scenes
- Identify the character's demographic and personality traits

For the PRODUCT image:
- Describe the product's appearance, features, and branding
- Identify key selling points and visual characteristics
- Note the product's target audience and use cases

Return the analysis in JSON format with separate sections for character and product information.`
```

### User Prompt
```typescript
{
  role: 'user',
  content: [
    { type: 'text', text: systemText },
    { type: 'image_url', image_url: { url: personImageUrl } },
    { type: 'image_url', image_url: { url: productImageUrl } }
  ]
}
```

### Expected Output
```json
{
  "character": {
    "visual_description": "Character appearance and style description",
    "demographic": "Age, gender, style indicators",
    "personality_traits": "Character personality characteristics"
  },
  "product": {
    "name": "Product name",
    "visual_description": "Product appearance and features",
    "selling_points": "Key product benefits",
    "target_audience": "Intended user demographic"
  }
}
```

## Step 2: UGC Prompt Generation

### Purpose
Generate UGC-style prompts for both image and video scenes that maintain character consistency throughout the advertisement.

### AI Configuration
- **Provider**: OpenRouter AI
- **Model**: `openai/gpt-4o-mini`
- **Max Tokens**: 2000
- **Temperature**: 0.7

### System Prompt
```typescript
`
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
- Each scene is ${unitSeconds} seconds long
- Include dialogue with casual, spontaneous tone (under 150 characters)
- Describe accent and voice style consistently
- Prefix video prompts with: "dialogue, the character in the video says:"
- Use ${voiceType}
- Camera movement: fixed
- Avoid mentioning copyrighted characters
- Don't refer back to previous scenes
- CRITICAL: Maintain character consistency - the same person from the reference image should appear in all scenes
- CRITICAL: Maintain product consistency - focus on the same product throughout all scenes
- If a user dialogue is provided, you MUST use it EXACTLY as given for Scene 1 without paraphrasing, summarizing, or changing words. Do not add prefixes/suffixes other than the required "dialogue, the character in the video says:". Preserve casing; you may only escape quotes when needed for JSON validity.

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
        "video_prompt": "dialogue, the character in the video says: ${userDialogue ? userDialogue.replace(/"/g, '\\"') : '[casual dialogue]'}",
        "voice_type": "${voiceType}",
        "emotion": "chill, upbeat",
        "setting": "[casual environment]",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    }
    // ... additional video scenes based on duration
  ]
}`
```

### User Prompt
```typescript
`Description of the reference images are given below:
${JSON.stringify(analysisResult, null, 2)}

Generate prompts for ${videoScenes} video scenes (${unitSeconds} seconds each) plus 1 image scene.`
```

### Voice Type Generation
The system automatically determines appropriate voice type based on character analysis:

```typescript
// Extract character information to determine appropriate voice type
const characterInfo = (analysisResult as { character?: { visual_description?: string } })?.character?.visual_description || '';

// Check for female indicators first
const isCharacterFemale =
  characterInfo.toLowerCase().includes('woman') ||
  characterInfo.toLowerCase().includes('female') ||
  characterInfo.toLowerCase().includes('girl') ||
  characterInfo.toLowerCase().includes('lady') ||
  characterInfo.toLowerCase().includes(' she ') ||
  characterInfo.toLowerCase().includes(' her ');

// Check for male indicators with word boundaries
const isCharacterMale = !isCharacterFemale && (
  characterInfo.toLowerCase().includes(' man ') ||
  characterInfo.toLowerCase().includes('businessman') ||
  characterInfo.toLowerCase().includes('gentleman') ||
  characterInfo.toLowerCase().includes(' male ') ||
  characterInfo.toLowerCase().includes(' boy ') ||
  characterInfo.toLowerCase().includes(' guy ') ||
  characterInfo.toLowerCase().includes(' he ') ||
  characterInfo.toLowerCase().includes(' his ')
);

const voiceType = generateVoiceType(accent, isCharacterMale);
```

### Voice Type Options
Based on accent and gender detection:
- **American Accent**: "American accent, deep male voice" / "American accent, warm female voice"
- **British Accent**: "British accent, sophisticated male voice" / "British accent, elegant female voice"
- **Australian Accent**: "Australian accent, friendly male voice" / "Australian accent, cheerful female voice"
- **Default**: "Neutral accent, clear male voice" / "Neutral accent, pleasant female voice"

## Key Features

1. **Character Consistency**: Maintains the same person throughout all scenes
2. **Product Consistency**: Focuses on the same product throughout all scenes
3. **UGC Style**: Amateur iPhone photo/video aesthetic for authenticity
4. **Voice Type Detection**: Automatically determines appropriate voice based on character analysis
5. **User Dialogue Preservation**: Exact user-provided dialogue is used without modification
6. **Scene Duration**: Configurable based on video model (8 seconds for Veo3, 10 seconds for Sora2)

## Usage Notes

- Both person and product images are required
- Character analysis determines voice type automatically
- User dialogue (if provided) is used exactly for Scene 1
- Video duration affects the number of scenes generated
- UGC style emphasizes casual, authentic presentation
- Fixed camera movement maintains amateur aesthetic
- No copyrighted characters or references are used