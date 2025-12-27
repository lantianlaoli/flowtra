# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

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

## Core Architecture

This is a Next.js 16 app using the App Router with TypeScript and Supabase integration. The application provides AI-powered video generation for small businesses with two main features:

1. **Avatar Ads** - Character-based talking head videos
2. **Competitor UGC Replication** - Product video generation with competitor reference (clone) mode

### Technology Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Database**: Supabase PostgreSQL (18 tables)
- **Storage**: Supabase Storage
- **Authentication**: Clerk
- **Styling**: TailwindCSS v4, Radix UI, Lucide Icons, Framer Motion
- **AI Services**: KIE API (image/video), OpenRouter (Gemini 2.5 Flash), fal.ai (video merge)
- **Realtime**: Supabase Realtime (PostgreSQL pub/sub)
- **Analytics**: Vercel Analytics, PostHog

## Feature 1: Avatar Ads (Character-Based Advertisements)

### Overview
AI-powered talking head videos where a character (avatar) discusses a product or topic. 100% event-driven architecture with webhooks and Supabase Realtime for instant status updates.

### User Flow
1. Upload character photo
2. Select product (optional) or enter custom dialogue
3. Configure: Duration (8-80s), language, format (16:9 or 9:16)
4. AI generates: Cover image → Video scenes → Merged video

### Key Implementation Details

**Files**:
- Workflow: `lib/avatar-ads-workflow.ts` (1,639 lines)
- UI: `components/pages/AvatarAdsPage.tsx` (1,402 lines)
- API: `app/api/avatar-ads/` (create, status, download, webhooks)

**Database Tables**:
- `avatar_ads_projects` - Main project records
- `avatar_ads_scenes` - Individual video scenes (8-second segments)

**Models**:
- Video: veo3_fast (fixed, 20 credits per 8s segment)
- Image: nano_banana_pro or seedream (user choice)

### Technical Architecture

**Workflow Steps**:
1. `generate_prompts` - Gemini 2.5 Flash analyzes character/product and generates scene prompts
2. `generate_image` - KIE API creates cover image
3. `check_image_status` - Polls until image complete, awaits user review
4. `generate_videos` - KIE API creates 8-second video segments in parallel
5. `check_videos_status` - Monitors video completion with retry logic
6. `merge_videos` - fal.ai combines segments (webhook-based)

**Event-Driven Architecture**:
- Webhook endpoints: `/api/avatar-ads/webhooks/{image|video|merge}`
- KIE webhooks push updates to database → Supabase Realtime → Frontend (<1s latency)
- NO polling loops, NO cron jobs, 100% event-driven
- Idempotency: `webhook_received_at` timestamps prevent duplicate processing

**Credit Billing**:
- Generation-time deduction: Credits charged before video generation starts
- Free downloads: No credit deduction for downloads
- Automatic refunds: Credits returned if generation fails after max retries

**Two Modes**:
1. **Product-Based**: Character showcases product with AI-generated dialogue
2. **Talking Head**: Character speaks about topic/script (no product selected)

## Feature 2: Competitor UGC Replication (Clone Feature)

### Overview
Product video generation with dual-mode system: Traditional (original creative) vs Competitor Reference Mode (clone competitor ad structure). Uses 8-second segments with continuation frames for visual coherence.

### User Flow
1. Upload product image(s)
2. Select brand and competitor ad (optional - triggers clone mode)
3. Choose video model (veo3 or veo3_fast), duration (8-64s), language
4. AI generates: Frame generation → Video generation → Merge

### Competitor Reference Mode (Clone)

**Purpose**: Analyze competitor advertisements and generate similar videos featuring the user's product.

**Process**:
1. User uploads competitor video
2. AI analyzes complete ad structure:
   - Shot-by-shot breakdown (10 elements per shot)
   - Complete video script and narrative flow
   - First frame composition for cover generation
   - Camera movements and transitions
   - Color palette and visual aesthetics
   - Brand/product containment flags
3. AI generates prompts that clone competitor's structure but replace with user's product
4. Video generated in 8-second segments with continuation frames

**Implementation**: `analyzeCompetitorAdWithLanguage()` in `lib/competitor-ugc-replication-workflow.ts` (lines 1219-1518)

### Key Implementation Details

**Files**:
- Workflow: `lib/competitor-ugc-replication-workflow.ts` (2,922 lines)
- UI: `components/pages/CompetitorUgcReplicationPage.tsx`
- API: `app/api/competitor-ugc-replication/` (create, status, merge, webhooks)
- Competitor shots: `lib/competitor-shots.ts` (shot data structure)

**Database Tables**:
- `competitor_ugc_replication_projects` - Main project records
- `competitor_ugc_replication_segments` - 8-second video segments with continuation support
- `competitor_ads` - Competitor analysis data (shot breakdown, timing, style)

**Models**:
- Video: veo3 (150 credits/8s) or veo3_fast (20 credits/8s) - user choice
- Image: nano_banana_pro or seedream for frame generation

### Technical Architecture

**3-Phase Workflow**:
1. **Frame Generation** (Sequential with continuation):
   - Generate first frame for each segment via KIE API
   - Segments with `is_continuation_from_prev=true` wait for previous segment's frame
   - Frame webhook auto-triggers next segment's frame generation
   - Smart routing: Brand/product shots use reference images
   - Duration: 30-60 seconds per frame

2. **Video Generation** (Parallel):
   - Once ALL frames ready, user triggers video generation
   - Each segment generates in parallel using KIE Veo3 API
   - Uses first frame + closing frame (if available) for smooth transitions
   - Duration: 60-180 seconds per segment

3. **Video Merge** (Conditional):
   - Single segment (8s) → No merge, directly marked completed
   - Multiple segments → User triggers fal.ai merge
   - Duration: 5-30 seconds

**Event-Driven Architecture**:
- Webhook endpoints: `/api/competitor-ugc-replication/webhooks/{frame|video|merge}`
- Frame webhook auto-triggers next segment when continuation dependency resolved
- Video webhook checks if all segments complete → auto-triggers merge or marks completed
- Merge webhook finalizes project to 100% completed status
- Supabase Realtime pushes updates to frontend (<1s latency)

**Smart Segment Calculation**:
- Priority 1: If competitor shots match user's segment count → 1:1 mapping
- Priority 2: Compress competitor shots to fit user's chosen duration
- Priority 3: Use pure AI generation with segment duration

**Continuation Frames**:
- Segment 2+ use previous segment's first frame as visual reference
- Ensures coherent narrative flow across segments
- Automatic triggering via frame webhook (event-driven)

## Database Schema (18 Tables)

### Core Project Tables (4)
- `competitor_ugc_replication_projects` - UGC clone projects with segment support
- `competitor_ugc_replication_segments` - Individual 8-second video segments
- `avatar_ads_projects` - Character-based advertisement projects
- `avatar_ads_scenes` - Individual video scenes for avatar ads

### User & Credits (3)
- `user_credits` - User credit balance and subscription credits
- `credit_transactions` - Complete audit ledger of all credit operations
- `user_subscriptions` - Subscription management and billing

### Assets (5)
- `user_brands` - Brand profiles with logos and slogans
- `user_products` - Product catalog with descriptions
- `user_product_photos` - Product image gallery (multiple photos per product)
- `user_avatars` - Character photos for avatar ads
- `competitor_ads` - Competitor video analysis data (shot breakdown, style, timing)

### Support Tables (6)
- `articles` - Blog and help documentation
- `user_tiktok_connections` - TikTok integration for direct posting
- `images` - Supabase Storage bucket for all media
- `subscription_events` - Subscription lifecycle events
- `competitor_videos` - Temporary storage for competitor video uploads

## Design System & UI Guidelines

### Design Philosophy (design_guide.md)

Follow minimalist SaaS design specification:
- **Minimalism**: High use of white space to reduce cognitive load
- **High Contrast**: Strict black-on-white palette for maximum readability
- **Geometric Precision**: Clean lines, consistent 8px border-radius, grid-aligned
- **Clarity**: Clear hierarchy using typography and subtle shadows

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| color-bg-primary | #FFFFFF | Main page background |
| color-bg-secondary | #F7F7F7 | Card backgrounds, section alternates |
| color-text-primary | #000000 | Headings, primary buttons, main text |
| color-text-secondary | #666666 | Subheadings, body descriptions |
| color-border | #E5E5E5 | Card borders, secondary button strokes |
| color-accent | #000000 | Primary CTAs, active states |

### Typography
- **Font Family**: Geometric Sans-Serif (Inter, Plus Jakarta Sans, or Satoshi)
- **H1**: 48-64px Bold, Letter-spacing: -0.02em
- **H2**: 32-40px Semi-Bold, Centered
- **H3**: 20-24px Semi-Bold
- **Body**: 16px Regular, Line-height: 1.6
- **Small/Label**: 12-14px Medium, All-caps or Title Case

### UI Component Structure (114 Components)

**Base UI**: 49 components in `/components/ui/`
- Buttons, cards, inputs, badges, dialogs, sheets, tabs, tooltips
- VideoModelSelector, VideoDurationSelector, VideoAspectRatioSelector
- ImageModelSelector, LanguageSelector, FormatSelector
- CreditsDisplay, DownloadButton, GenerationProgressDisplay

**Feature Pages**:
- `components/pages/CompetitorUgcReplicationPage.tsx` - UGC clone UI
- `components/pages/AvatarAdsPage.tsx` - Avatar ads UI
- `components/pages/HistoryPage.tsx` - Project history with legacy support

**Managers** (CRUD interfaces):
- BrandManager, ProductManager, AssetsManager
- CompetitorAdsList, CompetitorUgcReplicationRecentList

### CRITICAL: UI Language Requirement

**ALL user-facing UI text MUST be in English**. This includes:
- ✓ Button labels: "Generate Video" (NOT "生成视频")
- ✓ Form inputs: placeholders, labels, validation messages
- ✓ Toast notifications: success/error messages
- ✓ Modal titles and descriptions
- ✓ Error messages and help text
- ✓ Tooltips and instructions

**Exception**: Language selector native names for multi-language dropdown options (e.g., '中文' for Chinese option)

**Why**: Product maintains English-first UX for global audience. Chinese and other language support is for AI prompt generation (dialogue, narration), not UI copy.

**Locations to Check**:
- `/components/ui/LanguageSelector.tsx` - Language dropdown
- `/components/competitor-ugc-replication/SegmentInspector.tsx` - Segment inspector
- `/components/EditCompetitorAdModal.tsx` - Competitor ad modal

## Credit System (Version 2.0)

### Billing Model
Unified generation-time billing - ALL models charge credits at generation start, ALL downloads are FREE.

**Core Principles**:
- Upfront billing: Credits deducted before video generation starts
- Free downloads: Download endpoints do not deduct credits, only mark download status
- Automatic refunds: Credits refunded if generation fails after max retries
- Simple UX: All models work the same way (no confusion about "free generation" vs "paid generation")

### Credit Costs

**Video Generation** (charged at generation start):
- Veo3.1: 150 credits per 8s segment
- Veo3.1 Fast: 20 credits per 8s segment
- Sora2: 6 credits per 10s video (legacy - not available for new projects)
- Sora2 Pro: 75-315 credits (dynamic, legacy - not available for new projects)
- Grok: 20 credits per 6s segment (legacy - not available for new projects)
- Kling 2.6: 110 credits per 5s block (legacy - not available for new projects)

**Free Operations**:
- Image generation: FREE (nano_banana_pro, seedream)
- Video merge: FREE (fal.ai operation)
- ALL downloads: FREE (unlimited downloads)

**Initial Credits**: 100 credits for new users

### Examples
- 32-second veo3_fast video: 4 segments × 20 = 80 credits
- 64-second veo3 video: 8 segments × 150 = 1,200 credits

## External APIs

### KIE API (Primary AI Service)
- **Image Generation**: nano_banana_pro, seedream models
- **Video Generation**: Veo3, Veo3 Fast
- **API Docs**: `documents/banana.md`, `documents/seedream.md`
- **Webhooks**: Registered for frame/video completion callbacks

### OpenRouter (AI Text Generation)
- **Model**: Gemini 2.5 Flash
- **Usage**: Image descriptions, prompt generation, competitor ad analysis

### fal.ai (Video Processing)
- **Service**: Video merging/concatenation
- **API**: ffmpeg-api/video-concat
- **Webhooks**: Completion callback for merged videos

### Supabase
- **Database**: PostgreSQL with 18 tables
- **Storage**: File storage organized by workflow/user
- **Realtime**: PostgreSQL pub/sub for instant frontend updates

### Clerk
- **Service**: Authentication and user management
- **Integration**: `user_id` drives all data access

## Development Workflow

### CRITICAL: Dependency Management

**ALWAYS use pnpm for ALL dependency operations** (never npm or yarn):

```bash
pnpm install                    # Install dependencies
pnpm add <package>              # Add new package (UPDATES pnpm-lock.yaml)
pnpm add -D <package>           # Add dev dependency (UPDATES pnpm-lock.yaml)
pnpm remove <package>           # Remove package (UPDATES pnpm-lock.yaml)
pnpm install --frozen-lockfile  # CI/production installs (no updates)
```

**Lock File Rules**:
1. **EVERY** `pnpm add` or `pnpm remove` updates `pnpm-lock.yaml`
2. **ALWAYS** commit the updated lock file with your changes
3. **NEVER** manually edit pnpm-lock.yaml
4. **Before pushing**: Verify `git diff pnpm-lock.yaml` shows changes

**Why**: Lock file ensures deterministic builds. Mismatched dependencies cause Vercel build failures and hard-to-debug issues.

### Pre-Deployment Checklist

Run these commands before EVERY commit/push:

```bash
pnpm install --frozen-lockfile  # Verify lock file integrity
pnpm lint                       # Fix all ESLint errors
pnpm type-check                 # Fix all TypeScript errors
pnpm build                      # Ensure production build succeeds
```

**Additional Checks**:
- Verify no secrets in .env committed
- If dependencies changed: `git diff pnpm-lock.yaml` (must show updates)
- Test locally: `pnpm start` (production server)

### Local Development Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in required API keys (see Environment Variables below)

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Start development server:
   ```bash
   pnpm dev
   ```

5. Visit http://localhost:3000 and sign in via Clerk

## Environment Variables

Required environment variables (see `.env.example` for complete list):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Public key for client-side
- `SUPABASE_SECRET_KEY` - Secret key for server-side admin operations

### AI Services
- `KIE_API_KEY` - KIE API key for image/video generation
- `OPENROUTER_API_KEY` - OpenRouter API key for Gemini
- `FAL_KEY` - fal.ai API key for video merging
- `KIE_CREDIT_THRESHOLD` - Minimum KIE credits before blocking generation

### Authentication
- `CLERK_SECRET_KEY` - Clerk secret key (server-side)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key (client-side)

### Webhooks
- `NEXT_PUBLIC_SITE_URL` - Base URL for webhook callbacks (use ngrok URL for local dev)

### Analytics
- `NEXT_PUBLIC_POSTHOG_KEY` - PostHog API key (optional)
- `NEXT_PUBLIC_POSTHOG_HOST` - PostHog host (optional)

### Email
- `RESEND_API_KEY` - Resend API key for transactional emails
- `RESEND_FROM` - From email address
- `NOTIFY_EMAIL_TO` - Notification recipient email

**NEVER commit `.env`** - always copy from `.env.example` locally.

## Key Technical Patterns

### Event-Driven Architecture (100%)
- **NO polling loops**, **NO cron jobs**, **NO monitor-tasks**
- ALL workflow progression via webhooks
- Webhooks update database → Supabase Realtime → Frontend (<1s latency)
- Idempotency: `webhook_received_at` timestamps prevent duplicate processing
- Multiple webhook deliveries safe (stateless webhook handlers)

### Realtime Updates
- Frontend subscribes to Supabase Realtime (PostgreSQL pub/sub)
- Initial fetch + subscribe pattern (catches updates while page was closed)
- Automatic cleanup when projects complete
- Retry logic with exponential backoff for transient failures

### Non-Blocking Workflows
- API endpoints return immediately after database insert
- Background tasks run async (IIFE or fire-and-forget)
- User sees instant confirmation, not loading spinners
- Workflow steps triggered by webhooks, not API responses

### Continuation Frames (Competitor UGC Replication)
- Segment 2+ use previous segment's first frame as visual reference
- Ensures coherent narrative flow across segments
- Frame webhook auto-triggers next segment generation (event-driven)
- Smart routing: Brand/product shots use reference images

## Common Development Tasks

### Adding a New Feature
1. Review `design_guide.md` for UI patterns
2. Create database migration if needed (Supabase SQL Editor)
3. Add TypeScript types to `lib/supabase.ts` or workflow file
4. Implement workflow logic in `lib/{feature}-workflow.ts`
5. Create UI components in `components/pages/`
6. Add API routes in `app/api/{feature}/`
7. Add webhook handlers if event-driven
8. Test: Create project → Monitor database → Verify Realtime updates

### Modifying AI Prompts
1. Update prompt in `lib/{workflow}-workflow.ts`
2. Document change reason (comment)
3. Test with real projects (not just mock data)
4. Verify JSON output format matches downstream schema

### Debugging Webhooks
1. Check Supabase logs for database updates
2. Check Vercel logs for webhook handler execution
3. Verify idempotency: Is `webhook_received_at` set?
4. Test locally: Use ngrok + set NEXT_PUBLIC_SITE_URL to ngrok URL

### Testing Realtime Updates
1. Open browser console and watch for Realtime logs
2. Create new project
3. Observe real-time status changes without page refresh
4. Verify no polling requests in Network tab
5. Confirm webhook callbacks trigger next steps immediately

## Security & Routing

### Middleware Protection (Clerk)
- `/dashboard` routes require authentication
- API routes under `/api/{workflow}/` protected
- Webhook routes public but validate payloads

### Redirects
- Legacy routes redirect to new standardized naming
- Example: `/single-video` → `/competitor-ugc-replication`

### Security Headers
- XSS protection configured
- Content sniffing prevention
- Frame options set for clickjacking protection

## Image Optimization

Next.js image optimization configured for:
- Unsplash, Supabase storage, Clerk domains
- aiquickdraw.com, aiproxy.vip (KIE API domains)
- WebP/AVIF formats with multiple device sizes
- Production console removal enabled

## Key Libraries

### UI
- TailwindCSS v4
- Radix UI (headless components for accessibility)
- Heroicons, Lucide React (icon libraries)
- Framer Motion (animations)
- CVA (class-variance-authority) - Component variant system

### Data & Validation
- Supabase client (@supabase/supabase-js)
- Zod (schema validation)
- React hooks for API calls

### AI & Media
- @fal-ai/client (video merge)
- Custom fetch utilities with retry logic (`fetchWithRetry`, `httpRequest`)
- Browser Image Compression (client-side compression)

### Analytics & Monitoring
- Vercel Analytics
- PostHog (product analytics)
- Error tracking via PostHog (`captureServerException`)

### Email
- Resend (transactional emails)

## Git & Release Hygiene

### Commit Convention
Follow Conventional Commits format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### PR Guidelines
- Keep PRs focused (one feature/fix per PR)
- Run `pnpm lint && pnpm type-check && pnpm build` before pushing
- Document pricing changes in `lib/constants.ts` first
- Update corresponding UI components and documentation

### Build Parity Checklist
- **Always run `pnpm install --frozen-lockfile` before CI-critical builds**
- **For type union changes (e.g., `VideoDuration`): Audit every setter/handler that consumes the type**
- **Before pushing: Run `pnpm lint && pnpm build` from clean state (delete `.next`)**
- **If Vercel fails: Capture exact stack trace and add regression tests**

## Important Notes

### Prompt Management
When modifying AI prompts in the codebase:
1. **Synchronize Documentation**: Update corresponding documentation in `prompts/` folder
2. **Document Changes**: Record version and reason for prompt modifications
3. **Test Thoroughly**: Validate updated prompts before deployment

### Video Model Support
**Current Models** (for new projects):
- Veo3.1 (veo3) - 150 credits per 8s segment
- Veo3.1 Fast (veo3_fast) - 20 credits per 8s segment

**Legacy Models** (existing projects only):
- Sora2, Sora2 Pro, Grok, Kling 2.6 - Display with "(Legacy)" suffix in UI

### Billing Model
Current version: **Version 2.0** (Unified Generation-Time Billing)
- ALL models charge at generation start
- ALL downloads are FREE
- Do NOT implement Version 3.0 (deprecated mixed billing)
