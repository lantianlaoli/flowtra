# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with Turbo (recommended)
- `pnpm dev:webpack` - Start development server with webpack (fallback)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

### Testing
- `@playwright/test` is installed for E2E testing
- No test scripts are currently configured in package.json

## Architecture Overview

### Core Application Structure
This is a Next.js 15 app using the App Router with TypeScript and Supabase integration. The application focuses on AI-powered video and image generation workflows.

### Key Workflows
The application implements three main AI workflows:

1. **Standard Ads** (`/dashboard/single-video-generator`)
   - Single video generation from product images
   - Uses OpenRouter AI for image description and prompt generation
   - Integrates with KIE API for cover image and video generation
   - Table: `standard_ads_projects`
   - Workflow: `lib/standard-ads-workflow.ts`

2. **Multi-Variant Ads** (`/dashboard/multi-variant-generator`)
   - Multiple variant generation from a single image
   - Direct cover generation without AI description step
   - Table: `multi_variant_ads_projects`
   - Workflow: `lib/multi-variant-ads-workflow.ts`

3. **Character Ads**
   - Character-based advertisement generation
   - Table: `character_ads_projects`
   - Workflow: `lib/character-ads-workflow.ts`

### Database Schema
- **Main Tables**: `standard_ads_projects`, `multi_variant_ads_projects`, `character_ads_projects`
- **Legacy Tables**: Old table names (`single_video_projects`, `multi_variant_projects`) have been migrated
- **Authentication**: Managed by Clerk
- **Credits System**: User credits stored in Supabase, costs defined in `lib/constants.ts`

### External APIs
- **KIE API**: Primary AI service for image and video generation
  - Image models: `google/nano-banana-edit`, `bytedance/seedream-v4-edit`
  - Video models: Veo3 (fast/high-quality), Sora2, Sora2 Pro
  - API docs: `documents/banana.md`, `documents/seedream.md`
- **OpenRouter**: For AI text generation (image descriptions, prompts)
- **Supabase**: Database and file storage
- **Clerk**: Authentication

### API Structure
- **Creation endpoints**: `/api/{workflow}/create` - Start new workflows
- **Status endpoints**: `/api/{workflow}/[id]/status` - Check workflow progress
- **History endpoints**: `/api/{workflow}/history` - List user's projects
- **Monitor tasks**: `/api/{workflow}/monitor-tasks` - Background job processors that handle all workflow progress updates

**IMPORTANT**: This application uses **monitor-tasks** for ALL workflow progress updates. The monitor-tasks endpoints poll KIE API to check task status and update database records accordingly. Legacy webhook endpoints have been removed.

### Credit System (Mixed Billing Model - Version 3.0)
- **Billing Model**: Dual-tier system for flexibility
  - **Basic Models (Veo3 Fast, Sora2)**: FREE generation → PAID download
  - **Premium Models (Veo3, Sora2 Pro)**: PAID generation → FREE download
- **Costs defined in** `lib/constants.ts`:
  - **Generation Costs** (paid models):
    - Veo3: 150 credits per 8s video
    - Sora2 Pro: 75-315 credits (dynamic based on duration/quality)
  - **Download Costs** (free-generation models):
    - Veo3 Fast: 20 credits per 8s video
    - Sora2: 6 credits per 10s video
- **Image generation**: Always free (nano_banana, seedream)
- **Initial credits**: 100 for new users
- **Automatic refunds**: Credits refunded if PAID generation fails

### Environment Variables
Required environment variables (check existing code for complete list):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-side only, for admin operations)
- `KIE_API_KEY`, `OPENROUTER_API_KEY`
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Credit thresholds: `KIE_CREDIT_THRESHOLD`

### Image Optimization
Next.js image optimization is configured for:
- Unsplash, Supabase storage, Clerk, aiquickdraw.com, aiproxy.vip domains
- WebP/AVIF formats with multiple device sizes
- Production console removal enabled

### Security & Routing
- Clerk middleware protects `/dashboard` and sensitive API routes
- Redirects: Legacy routes redirect to new standardized naming
- Security headers configured for XSS protection, content sniffing prevention

### Monitoring & Background Jobs
- **Monitor tasks are the PRIMARY mechanism** for checking AI job status and updating workflow progress
- Monitor endpoints (`/api/{workflow}/monitor-tasks`) poll KIE API periodically to check task completion
- Timeout handling: 15min for images, 30min for videos
- Failed jobs are marked with error messages for debugging

### Key Libraries
- **UI**: TailwindCSS v4, Heroicons, Lucide React, Framer Motion
- **Data**: Supabase client, React hooks for API calls
- **AI**: FAL AI client, custom fetch utilities with retry logic
- **Analytics**: Vercel Analytics, PostHog for user tracking

## Prompt Management Requirements

When modifying any AI prompts in the codebase:
1. **Synchronize Documentation**: Must update corresponding documentation in `prompts/` folder
2. **Document Changes**: Record version and reason for prompt modifications
3. **Maintain Consistency**: Ensure documentation stays consistent with actual prompts used in code
4. **Test Thoroughly**: Validate updated prompts before deployment
5. **Review Impact**: Consider effects on existing workflows and user experience

### Prompt Documentation Structure
- `prompts/README.md` - Overview of all workflows
- `prompts/standard-ads-workflow.md` - Standard Ads complete workflow
- `prompts/multi-variant-ads-workflow.md` - Multi-Variant Ads complete workflow
- `prompts/character-ads-workflow.md` - Character Ads complete workflow

---

## Implementation Notes

### Generation-Time Billing (Version 2.0)

**Implementation Date**: 2025-10-13

**Key Changes:**
1. **Unified Upfront Billing**: All video models (Sora2, Veo3, Veo3 Fast, Sora2 Pro) charge credits at generation start
2. **Free Downloads**: Download endpoints no longer deduct credits, only mark download status
3. **Automatic Refunds**: Workflow error handlers refund credits if generation fails

**Modified Files:**
- `lib/standard-ads-workflow.ts` - Upfront billing for all models
- `lib/multi-variant-ads-workflow.ts` - Upfront billing for all models
- `app/api/character-ads/create/route.ts` - Sora2 Pro support
- `app/api/download-video/route.ts` - Removed credit deduction
- `app/api/multi-variant-ads/[id]/download/route.ts` - Removed credit deduction
- `app/api/character-ads/download/route.ts` - Removed credit deduction
- `components/pages/PricingPage.tsx` - Updated messaging
- `components/pages/LandingPage.tsx` - Updated messaging

**Technical Decisions:**
- **Why generation-time billing?** Simplifies UX, eliminates download friction, encourages sharing
- **Why automatic refunds?** User trust - they pay upfront, so failures must be refunded
- **Why Sora2 Pro?** User demand for higher quality professional content

**Known Limitations:**
- Sora2 Pro pricing complexity (4 tier system) may confuse some users
- Refunds depend on proper error handling in workflows
- Auto mode selection may need adjustment based on user feedback

**Testing Considerations:**
- Test credit deduction timing (must be before API calls)
- Test refund logic for all failure scenarios
- Test Sora2 Pro dynamic pricing calculations
- Verify downloads work without credit checks

**Related Documentation:**
- `documents/local/pricing-and-billing-rules.md` - Complete billing rules (Version 2.0)

---

### Mixed Billing Model (Version 3.0)

**Implementation Date**: 2025-10-13

**Overview:**
Version 3.0 introduces a dual-tier billing model where different video models have different billing strategies to optimize user experience and cost:
- **Basic Models (Veo3 Fast, Sora2)**: FREE generation, PAID download (pay only if satisfied)
- **Premium Models (Veo3, Sora2 Pro)**: PAID generation, FREE download (upfront payment)

**Key Changes:**

1. **Model Classification** (`lib/constants.ts`):
```typescript
// FREE generation models (charge at download)
export const FREE_GENERATION_MODELS = ['veo3_fast', 'sora2'] as const;

// PAID generation models (charge at generation)
export const PAID_GENERATION_MODELS = ['veo3', 'sora2_pro'] as const;

// Separate cost structures
export const GENERATION_COSTS = { 'veo3': 150 }; // Sora2 Pro uses getSora2ProCreditCost()
export const DOWNLOAD_COSTS = { 'veo3_fast': 20, 'sora2': 6 };
```

2. **Generation Phase** (Workflows):
   - Only deduct credits for PAID generation models
   - FREE generation models generate without credit check
   - Refunds only apply to PAID generation models

3. **Download Phase** (Download APIs):
   - FREE generation models: Check credits and deduct at first download
   - PAID generation models: No credit deduction (already paid)

**Modified Files:**
- `lib/constants.ts` - Added model classification, helper functions
- `lib/standard-ads-workflow.ts` - Generation billing logic
- `lib/multi-variant-ads-workflow.ts` - Generation billing logic
- `app/api/download-video/route.ts` - Download billing logic
- `app/api/multi-variant-ads/[id]/download/route.ts` - Download billing logic
- `app/api/character-ads/download/route.ts` - Download billing logic
- `components/ui/VideoModelSelector.tsx` - UI shows "Generation: X credits" vs "Download: X credits"
- `components/pages/PricingPage.tsx` - Updated messaging
- `components/pages/LandingPage.tsx` - Updated messaging

**Helper Functions Added:**
```typescript
isFreeGenerationModel(model): boolean // Check if model has free generation
isPaidGenerationModel(model): boolean // Check if model has paid generation
getGenerationCost(model, ...): number // Get generation cost (0 for free models)
getDownloadCost(model): number // Get download cost (0 for paid models)
```

**Technical Decisions:**
- **Why mixed billing?** Provides flexibility for users - try basic models risk-free, premium models for professional quality
- **Why free generation for basic models?** Lowers entry barrier, users only pay if satisfied with result
- **Why paid generation for premium?** Prevents abuse of expensive models, ensures committed users only

**Benefits:**
- Lower risk for new users (try before you buy with basic models)
- Clear value proposition for premium models
- Reduces wasted generations (users preview before downloading)
- Flexibility for different use cases and budgets

**Known Limitations:**
- Users need to understand two different billing models
- UI must clearly communicate which model uses which billing
- Must prevent abuse of free generation (future: rate limiting)

**Testing Considerations:**
- Test credit deduction timing for both model types
- Verify download billing only applies to free-generation models
- Test insufficient credits at both generation and download phases
- Verify UI correctly shows billing timing per model

**Related Documentation:**
- `documents/local/pricing-and-billing-rules.md` - Should be updated to Version 3.0

---

### Dual-Mode Standard Ads Workflow (Version 2.0)

**Implementation Date**: 2025-01-16

**Overview:**
Standard Ads workflow now supports two distinct generation modes:
- **Traditional Auto-Generation Mode**: AI deeply analyzes product photos to create original creative content
- **Competitor Reference Mode**: AI analyzes competitor ads to clone creative structure for our product

The mode is automatically determined based on whether the user selects a competitor ad.

**Key Changes:**

1. **Workflow Path Separation** (`lib/standard-ads-workflow.ts`):
   - Modified `generateImageBasedPrompts()` function to support dual modes
   - Mode detection: `if (competitorAdContext)` → Competitor Reference Mode
   - Different prompt strategies for each mode

2. **Traditional Mode** (No competitor selected):
   ```
   Product Photo → Deep AI Analysis → Extract Product Features → Generate Original Creative → Cover & Video
   ```
   - AI analyzes product appearance, colors, textures, design
   - Infers product category and use cases
   - Generates completely original advertising creative
   - Product photo is the primary input for analysis

3. **Competitor Reference Mode** (Competitor selected):
   ```
   Competitor Video/Image → Extract Creative Structure → Apply to Our Product → Cover & Video
   ```
   - AI analyzes competitor's complete ad structure:
     - Complete video script and narrative flow
     - First frame composition (for cover generation)
     - Camera movements and transitions
     - Color palette and visual aesthetics
   - Product photo is used ONLY as "replacement material"
   - AI clones competitor structure but replaces their product with ours

**Modified Files:**
- `lib/standard-ads-workflow.ts` - Core prompt generation logic (lines 754-854)
- `prompts/standard-ads-workflow.md` - Complete documentation of both modes
- `CLAUDE.md` - This implementation note

**Prompt Strategy Differences:**

| Aspect | Traditional Mode | Competitor Reference Mode |
|--------|-----------------|---------------------------|
| Product Photo Role | Deep analysis for features & selling points | Visual reference for product replacement only |
| Creative Source | AI original generation | Clone competitor structure |
| Analysis Focus | Product appearance, category, use cases | Competitor script, cameras, style |
| Prompt Generation | Based on product features | Based on competitor structure |

**Technical Implementation:**

**Competitor Video Processing:**
- Gemini only accepts YouTube URLs or base64 for videos
- Use `fetchVideoAsBase64()` to download and convert competitor videos
- 60-second timeout limit
- Auto-detect MIME type (mp4/webm/mov)

**Prompt Structure (Competitor Mode):**
```
1. Upload competitor video/image (video_url or image_url)
2. Upload product photo (image_url)
3. Text instructions:
   - 🎯 COMPETITOR REFERENCE MODE
   - Extract complete video script and narrative structure
   - Analyze first frame composition and visual elements
   - Document camera movements and transitions
   - Capture color palette and lighting style
   - CRITICAL: Clone structure, replace product
```

**Prompt Structure (Traditional Mode):**
```
1. Upload product photo (image_url)
2. Text instructions:
   - 🤖 TRADITIONAL AUTO-GENERATION MODE
   - Analyze product visual elements
   - Infer product category and use cases
   - Generate original creative content
   - Consider brand identity and user requirements
```

**JSON Output Compatibility:**
- Both modes use identical JSON schema
- Ensures downstream workflow steps (cover generation, video generation) work without modification
- Same fields: description, setting, camera_type, action, dialogue, etc.

**Technical Decisions:**
- **Why dual mode?** Users need both original creativity AND ability to reference successful ads
- **Why auto-switching?** Simplifies UX - selecting competitor automatically enables reference mode
- **Why same JSON format?** Ensures no changes needed in cover/video generation logic
- **Why video-to-base64?** Gemini limitation requires YouTube URLs or base64 format

**Benefits:**
- Original creativity for unique product differentiation
- Proven creative structures from successful competitor ads
- Seamless mode switching without UI changes
- Product replacement accuracy maintained in both modes

**Known Limitations:**
- Video-to-base64 conversion limited to 60 seconds (large files may timeout)
- Gemini API may have rate limits on video analysis
- Quality of competitor cloning depends on AI's ability to extract structure

**Testing Considerations:**
- Test traditional mode: verify creative originality
- Test competitor mode with video: verify structure cloning
- Test competitor mode with image: verify style adaptation
- Test product replacement accuracy in both modes
- Verify JSON format consistency across modes

**Related Documentation:**
- `prompts/standard-ads-workflow.md` - Complete prompt templates for both modes
