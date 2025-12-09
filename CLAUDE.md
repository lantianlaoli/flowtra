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
The application implements two main AI workflows:

1. **Competitor UGC Replication** (`/dashboard/single-video-generator`)
   - Single video generation from product images
   - Uses OpenRouter AI for image description and prompt generation
   - Integrates with KIE API for cover image and video generation
   - Table: `competitor_ugc_replication_projects`
   - Workflow: `lib/competitor-ugc-replication-workflow.ts`

2. **Character Ads**
   - Character-based advertisement generation
   - Table: `character_ads_projects`
   - Workflow: `lib/character-ads-workflow.ts`

### Database Schema
- **Main Tables**: `competitor_ugc_replication_projects`, `character_ads_projects`
- **Legacy Tables**: Old table names (`single_video_projects`) have been migrated
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

### Credit System (Unified Generation-Time Billing - Version 2.0)
- **Billing Model**: Unified system - ALL models charge at generation, downloads are FREE
  - **ALL Video Models**: PAID generation → FREE download
  - **Generation Costs** (all models charge upfront):
    - Veo3: 150 credits per 8s segment
    - Veo3 Fast: 20 credits per 8s segment
    - Sora2: 6 credits per 10s video
    - Sora2 Pro: 75-315 credits (dynamic based on duration/quality)
    - Grok: 20 credits per 6s segment
    - Kling 2.6: 110 credits per 5s block
  - **Download Costs**: 0 credits (ALL downloads are FREE)
- **Image generation**: Always free (nano_banana, seedream)
- **Initial credits**: 100 for new users
- **Automatic refunds**: Credits refunded if generation fails

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
- `prompts/competitor-ugc-replication-workflow.md` - Competitor UGC Replication complete workflow
- `prompts/character-ads-workflow.md` - Character Ads complete workflow

---

## Implementation Notes

### **CURRENT: Unified Generation-Time Billing (Version 2.0 Restored)**

**Implementation Date**: 2025-12-09 (Restored from Version 3.0)

**Overview:**
Version 2.0 provides a unified, simple billing model where **ALL video models charge credits at generation time** and **downloads are always FREE**. This version was restored after temporarily implementing Version 3.0 mixed billing.

**Core Principles:**
1. **Unified Upfront Billing**: All video models (veo3, veo3_fast, sora2, sora2_pro, grok, kling_2_6) charge credits at generation start
2. **Free Downloads**: Download endpoints no longer deduct credits, only mark download status
3. **Automatic Refunds**: Workflow error handlers refund credits if generation fails
4. **Simple UX**: No confusion about "free generation" vs "paid generation" - all models work the same way

**Modified Files (Restoration):**
- `lib/constants.ts` - Removed FREE_GENERATION_MODELS/PAID_GENERATION_MODELS, consolidated costs
- `lib/competitor-ugc-replication-workflow.ts` - Updated comments to reflect unified billing
- `lib/character-ads-workflow.ts` - Added generation-time billing logic
- `app/api/download-video/route.ts` - Simplified to free downloads
- `app/api/character-ads/download/route.ts` - Simplified to free downloads
- `components/ui/VideoModelSelector.tsx` - Unified UI: "Generation: X credits, Download: FREE"
- `components/pages/landing/sections/ModelPricingSection.tsx` - All models show generation costs
- `components/pages/CompetitorUgcReplicationPage.tsx` - Removed download cost logic
- `components/pages/CharacterAdsPage.tsx` - Removed free generation badge logic
- `components/pages/HistoryPage.tsx` - Simplified download cost to 0

**Cost Structure (Version 2.0):**
```typescript
// ALL models charge at generation
export const GENERATION_COSTS = {
  'veo3': 150,        // Veo3 High Quality: 150 credits at generation
  'veo3_fast': 20,    // Veo3 Fast: 20 credits at generation (per 8s segment)
  'sora2': 6,         // Sora2: 6 credits at generation (per 10s video)
  'sora2_pro': 0,     // Sora2 Pro: See getSora2ProCreditCost() (75-315 credits)
  'grok': 20,         // Grok: 20 credits at generation (per 6s segment)
  'kling_2_6': 110    // Kling 2.6: 110 credits at generation (per 5s block)
} as const;

// ALL downloads are FREE
export function getDownloadCost(...): number {
  return 0; // Version 2.0: ALL downloads are FREE
}
```

**Technical Decisions:**
- **Why unified billing?** Simplifies UX, eliminates user confusion, consistent behavior across all models
- **Why rollback from Version 3.0?** Mixed billing created confusion - users didn't understand why some models were free to generate
- **Why automatic refunds?** User trust - they pay upfront, so failures must be refunded
- **Why generation-time for ALL models?** Prevents abuse, ensures committed users, fair pricing

**Benefits:**
- Clear, predictable pricing for all users
- No download friction - users can download unlimited times
- Encourages sharing and re-downloading
- Simpler codebase - no conditional billing logic
- Better user trust - pay only if satisfied (via refunds)

**Known Limitations:**
- Users pay upfront before seeing results (mitigated by refund policy)
- Sora2 Pro pricing complexity (4 tier system) may confuse some users
- Refunds depend on proper error handling in workflows

**Testing Considerations:**
- Test credit deduction timing (must be before API calls)
- Test refund logic for all failure scenarios
- Test all models charge correctly at generation
- Verify downloads work without credit checks
- Verify UI consistently shows "Generation: X, Download: FREE"

**Related Documentation:**
- `documents/local/pricing-and-billing-rules.md` - Should be updated to Version 2.0

---

### **DEPRECATED: Mixed Billing Model (Version 3.0)**

**Implementation Date**: 2025-10-13
**Deprecated Date**: 2025-12-09
**Status**: ❌ Rolled back to Version 2.0

**Reason for Deprecation:**
Version 3.0's mixed billing model created user confusion. Users did not understand why some models had "FREE generation" while others charged upfront. The dual billing strategies (free-gen + paid-download vs paid-gen + free-download) added unnecessary complexity to both the codebase and user experience.

**What Was Version 3.0:**
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
- `lib/competitor-ugc-replication-workflow.ts` - Generation billing logic
- `app/api/download-video/route.ts` - Download billing logic
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

### Dual-Mode Competitor UGC Replication Workflow (Version 2.0)

**Implementation Date**: 2025-01-16

**Overview:**
Competitor UGC Replication workflow now supports two distinct generation modes:
- **Traditional Auto-Generation Mode**: AI deeply analyzes product photos to create original creative content
- **Competitor Reference Mode**: AI analyzes competitor ads to clone creative structure for our product

The mode is automatically determined based on whether the user selects a competitor ad.

**Key Changes:**

1. **Workflow Path Separation** (`lib/competitor-ugc-replication-workflow.ts`):
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
- `lib/competitor-ugc-replication-workflow.ts` - Core prompt generation logic (lines 754-854)
- `prompts/competitor-ugc-replication-workflow.md` - Complete documentation of both modes
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
- `prompts/competitor-ugc-replication-workflow.md` - Complete prompt templates for both modes
