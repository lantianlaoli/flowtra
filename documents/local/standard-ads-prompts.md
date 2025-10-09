# Standard Ads Prompt Templates

This document contains all the AI prompts used in the Standard Ads workflow for generating professional video advertisements from product images.

## Workflow Overview

The Standard Ads workflow follows these steps:
1. **Image Description** - Analyze product image to extract features and benefits
2. **Creative Prompt Generation** - Transform description into structured creative elements
3. **Cover Generation** - Create enhanced advertising image with original product

## Step 1: Image Description

### Purpose
Analyze the uploaded product image to extract key features, benefits, and selling points for advertising purposes.

### AI Configuration
- **Provider**: OpenRouter AI
- **Model**: `google/gemini-2.0-flash-001`
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

### AI Configuration
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
${trimmedAdCopy ? `\nUse this exact ad copy for dialogue and on-screen headline. Do not paraphrase: "${trimmedAdCopy}".` : ''}

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
  "description": content,
  "setting": "Professional studio",
  "camera_type": "Close-up",
  "camera_movement": "Smooth pan",
  "action": "Product showcase",
  "lighting": "Soft professional lighting",
  "dialogue": trimmedAdCopy || "Highlighting key benefits",
  "music": "Upbeat commercial music",
  "ending": "Call to action",
  "other_details": "High-quality commercial style"
}
```

## Step 3: Cover Generation Prompt

### Purpose
Create an enhanced advertising image that maintains the exact original product appearance while improving presentation for marketing.

### AI Configuration
- **Provider**: KIE AI API
- **Models**: Nano Banana or Seedream (configurable)
- **Timeout**: 30 seconds
- **Retries**: 5

### System Prompt
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

### Additional Requirements (Conditional)

#### Watermark Requirements (if provided)
```typescript
`\n\nWatermark Requirements:
- Add text watermark: "${watermarkText}"
- Watermark location: ${watermarkLocation || 'bottom left'}
- Make the watermark visible but not overpowering
- Use appropriate font size and opacity for the watermark`
```

#### Ad Copy Requirements (if provided)
```typescript
`\n\nAd Copy Requirements:
- Prominently include the headline text "${escapedAdCopy}" in the design
- Keep typography clean and highly legible against the background
- Use the provided text exactly as written without paraphrasing`
```

### Prompt Length Management
The system ensures prompts don't exceed KIE API's 5000 character limit by truncating descriptions while preserving critical instructions.

## Key Features

1. **Product Preservation**: All prompts explicitly instruct AI to maintain the original product's exact appearance
2. **Ad Copy Integration**: User-provided ad copy is used exactly without modification
3. **Watermark Support**: Configurable text watermarks with positioning
4. **Error Handling**: Robust fallback mechanisms for JSON parsing failures
5. **Image Size Options**: Support for various aspect ratios (square, portrait, landscape)

## Usage Notes

- High-resolution product images yield best results
- Detailed product descriptions improve output quality
- User credits are checked before workflow initiation
- Progress tracking provides real-time updates
- Error recovery includes retry mechanisms for API failures