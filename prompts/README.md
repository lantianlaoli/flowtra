# Flowtra AI Workflows Documentation

This directory contains comprehensive documentation for all AI-powered workflows in the Flowtra platform. Each workflow includes detailed prompts, model configurations, and step-by-step processes.

## Available Workflows

### 1. Standard Ads Workflow
**File**: [`standard-ads-workflow.md`](./standard-ads-workflow.md)
- **Purpose**: Generate single video advertisements from product images
- **Key Features**: AI product description, creative prompt generation, cover image creation, video generation
- **Models Used**: OpenRouter AI (GPT/Gemini), KIE API (Nano Banana/Seedream, Veo3)
- **Cost**: 30 credits (Veo3 Fast) / 150 credits (Veo3 High Quality)

### 2. Multi-Variant Ads Workflow
**File**: [`multi-variant-ads-workflow.md`](./multi-variant-ads-workflow.md)
- **Purpose**: Generate multiple advertisement variants from a single image
- **Key Features**: Image analysis, multi-element generation, batch processing
- **Models Used**: OpenRouter AI (GPT-4o-mini), KIE API (Nano Banana/Seedream, Veo3)
- **Cost**: Variable based on number of variants

### 3. Character Ads Workflow
**File**: [`character-ads-workflow.md`](./character-ads-workflow.md)
- **Purpose**: Create character-based advertisements with UGC style
- **Key Features**: Person and product analysis, scene generation, video merging
- **Models Used**: OpenRouter AI (GPT-4o-mini), KIE API (Nano Banana/Seedream, Veo3), FAL AI (video merging)
- **Duration**: 8, 16, 24, or 32 seconds

### 4. YouTube Thumbnail Workflow
**File**: [`youtube-thumbnail-workflow.md`](./youtube-thumbnail-workflow.md)
- **Purpose**: Generate professional YouTube thumbnails
- **Key Features**: Flat design, left-right composition, emotional expression matching
- **Models Used**: KIE API (Nano Banana/Seedream)
- **Cost**: 5 credits per thumbnail

## Technical Overview

### AI Models Integration
- **OpenRouter AI**: Text generation, image analysis, prompt creation
- **KIE API**: Image generation, video generation
- **FAL AI**: Video processing and merging

### Credit System
- Video generation: 30 credits (Veo3 Fast) or 150 credits (Veo3 High Quality)
- Image generation: Free (Nano Banana, Seedream)
- Download: 18 credits (60% of Veo3 Fast cost)
- Thumbnail generation: 5 credits
- Initial user credits: 100

### Processing Times
- **Images**: 1-4 minutes depending on model
- **Videos**: 2-8 minutes depending on quality setting
- **Character Ads**: Additional time for video merging

## Workflow Architecture

Each workflow follows a consistent pattern:
1. **Input Validation**: Check user credits and input requirements
2. **AI Analysis**: Analyze uploaded images/content
3. **Prompt Generation**: Create structured prompts for content generation
4. **Content Creation**: Generate images/videos using AI models
5. **Status Monitoring**: Track progress via polling and webhooks
6. **Result Delivery**: Provide final outputs to user

## Environment Variables

Key environment variables for AI model integration:
- `OPENROUTER_API_KEY`: OpenRouter AI access
- `OPENROUTER_MODEL`: Default model (google/gemini-2.0-flash-001)
- `KIE_API_KEY`: KIE API access
- `FAL_KEY`: FAL AI access for video processing
- `KIE_CREDIT_THRESHOLD`: Minimum credits for service availability

## Prompt Management

When modifying AI prompts in the codebase:
1. Update the corresponding workflow documentation
2. Document the reason for the change
3. Ensure consistency between code and documentation
4. Test the updated prompts thoroughly

## File Structure

```
prompts/
├── README.md                     # This overview file
├── standard-ads-workflow.md      # Standard ads complete workflow
├── multi-variant-ads-workflow.md # Multi-variant ads complete workflow
├── character-ads-workflow.md     # Character ads complete workflow
└── youtube-thumbnail-workflow.md # YouTube thumbnail complete workflow
```

## Support

For technical questions about these workflows, refer to:
- Individual workflow documentation files
- Main project documentation in `/CLAUDE.md`
- KIE API documentation in `/documents/`