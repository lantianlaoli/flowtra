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
  - Video model: Veo3 (fast/high-quality variants)
  - API docs: `documents/banana.md`, `documents/seedream.md`
- **OpenRouter**: For AI text generation (image descriptions, prompts)
- **Supabase**: Database and file storage
- **Clerk**: Authentication

### API Structure
- **Creation endpoints**: `/api/{workflow}/create` - Start new workflows
- **Status endpoints**: `/api/{workflow}/[id]/status` - Check workflow progress
- **History endpoints**: `/api/{workflow}/history` - List user's projects
- **Monitor tasks**: `/api/{workflow}/monitor-tasks` - Background job processors
- **Webhooks**: `/api/webhooks/{workflow}` - Handle external API callbacks

### Credit System
- Costs defined in `lib/constants.ts`
- Video generation: 30 credits (veo3_fast) or 150 credits (veo3)
- Image generation: Free (nano_banana, seedream)
- Download: 18 credits (60% of veo3_fast cost)
- Initial credits: 100 for new users

### Environment Variables
Required environment variables (check existing code for complete list):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `KIE_API_KEY`, `OPENROUTER_API_KEY`
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Webhook URLs: `KIE_STANDARD_ADS_CALLBACK_URL`, etc.
- Credit thresholds: `KIE_CREDIT_THRESHOLD`

### Image Optimization
Next.js image optimization is configured for:
- Unsplash, Supabase storage, Clerk, aiquickdraw.com, aiproxy.vip domains
- WebP/AVIF formats with multiple device sizes
- Production console removal enabled

### Security & Routing
- Clerk middleware protects `/dashboard` and sensitive API routes
- Webhook routes are public (no auth required)
- Redirects: Legacy routes redirect to new standardized naming
- Security headers configured for XSS protection, content sniffing prevention

### Monitoring & Background Jobs
- Monitor tasks run periodically to check AI job status
- Webhook callbacks are preferred over polling when available
- Timeout handling: 15min for images, 30min for videos
- Failed jobs are marked with error messages for debugging

### Key Libraries
- **UI**: TailwindCSS v4, Heroicons, Lucide React, Framer Motion
- **Data**: Supabase client, React hooks for API calls
- **AI**: FAL AI client, custom fetch utilities with retry logic
- **Analytics**: Vercel Analytics, PostHog for user tracking