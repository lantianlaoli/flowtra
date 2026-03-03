# Flowtra Developer Context (GEMINI.md)

This document provides essential context for AI agents working on the Flowtra codebase.

## Quick Reference

**Project**: Flowtra - AI-powered video generation SaaS for small businesses
**Framework**: Next.js 16 (App Router) + TypeScript + Supabase
**Package Manager**: `pnpm` (REQUIRED - updates pnpm-lock.yaml)
**Design**: Minimalist black-on-white (design_guide.md)
**UI Language**: English ONLY (except language selector native names)

## Project Structure

**Directory Rules**:
- **`docs/`** - Official API documentation (KIE, fal.ai, Creem, TikTok)
- **`scripts/`** - Test scripts and utility tools

**Rule**: ALL external API docs go in `docs/`, ALL test/utility scripts go in `scripts/`.

## Core Product: Two AI Video Features

### 1. Avatar Ads (Character-Based Advertisements)

**Purpose**: Generate talking head videos where a character discusses a product or topic.

**User Flow**:
1. Upload character photo
2. Select product (optional) or enter custom dialogue
3. Configure: Duration (8-80s), language, format (16:9/9:16)
4. AI generates: Cover image → Video scenes → Merged video

**Implementation**:
- Workflow: `lib/avatar-ads-workflow.ts`
- UI: `components/pages/AvatarAdsPage.tsx`
- API: `app/api/avatar-ads/` (create, status, download, webhooks)
- Database: `avatar_ads_projects` (main), `avatar_ads_scenes` (child)
- Models: veo3_fast (video), nano_banana_pro/seedream (image)
- Architecture: 100% event-driven (webhooks + Supabase Realtime)

**Workflow Steps**:
1. Prompt Generation → 2. Image Generation → 3. User Review → 4. Video Generation → 5. Merge → 6. Completion

**Two Modes**:
- Product-Based: Character showcases product
- Talking Head: Character speaks on topic (no product)

### 2. Competitor UGC Replication (Clone Feature)

**Purpose**: Analyze competitor ads and generate similar videos for your products.

**Two Modes**:
1. **Traditional**: Product photo → Original video
2. **Competitor Reference (Clone)**: Competitor ad + product → Cloned structure with your product

**Clone Process**:
1. Upload competitor video
2. AI analyzes: Shot breakdown (10 elements/shot), timing, style, camera work
3. AI generates prompts that clone structure but feature your product
4. **Manual Intervention (35% Progress)**: User clicks "Edit" to refine photos and prompts for each segment until satisfied.
5. **Video Generation**: User triggers video generation for segments individually after review.
6. **Final Merge**: Combine all approved segments into the final video.

**Implementation**:
- Workflow: `lib/competitor-ugc-replication-workflow.ts`
- UI: `components/pages/CompetitorUgcReplicationPage.tsx`
- API: `app/api/competitor-ugc-replication/` (create, status, merge, webhooks)
- Database: `competitor_ugc_replication_projects`, `competitor_ugc_replication_segments`
- Models: veo3 or veo3_fast (user choice)
- Architecture: 4-phase (Frame → Review → Video → Merge), event-driven

**4-Phase Workflow**:
1. Frame Generation (Starts at 35% progress)
2. Manual Review & Confirmation (User refines and triggers video generation)
3. Video Generation (Parallel segments)
4. Video Merge (Conditional - only for multi-segment)

## Credit System (Version 2.0)

**Billing Model**: Unified generation-time billing
- **ALL models**: Credits deducted at generation start (upfront)
- **ALL downloads**: FREE (no credit deduction)
- **Refunds**: Automatic if generation fails

**Costs**:
- Veo3.1: 150 credits per 8s segment
- Veo3.1 Fast: 20 credits per 8s segment
- Image generation: FREE
- Video merge: FREE

**Important**: Do NOT implement Version 3.0 mixed billing (deprecated).

## Database Schema (18 Tables)

### Projects (4)
- `competitor_ugc_replication_projects` - UGC clone projects
- `competitor_ugc_replication_segments` - 8-second video segments
- `avatar_ads_projects` - Character ad projects
- `avatar_ads_scenes` - Individual video scenes

### User & Credits (3)
- `user_credits` - Credit balance
- `credit_transactions` - Audit ledger
- `user_subscriptions` - Subscription management

### Assets (5)
- `user_brands` - Brand profiles
- `user_products` - Product catalog
- `user_product_photos` - Product images
- `user_avatars` - Character photos
- `competitor_ads` - Competitor analysis data

### Support (6)
- `articles` - Blog content
- `user_tiktok_connections` - TikTok integration
- `site-assets` - Canonical bucket for landing, blog, and shared static assets
- `subscription_events` - Billing events
- `temp-uploads` - Canonical temporary upload bucket

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, TailwindCSS v4
- **UI**: Radix UI (headless), Lucide Icons, Framer Motion
- **Backend**: Supabase (PostgreSQL + Storage + Realtime)
- **Authentication**: Clerk
- **AI APIs**: KIE (image/video), OpenRouter (Gemini 2.5 Flash), fal.ai (merge)
- **Package Manager**: pnpm (strict enforcement)

## Design System (design_guide.md)

### Philosophy
- Minimalism: High white space, clean geometry
- High Contrast: Black-on-white (#000000 on #FFFFFF)
- Geometric Precision: 8px border-radius, grid-aligned
- Typography: Geometric Sans-Serif (Inter/Plus Jakarta Sans)

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| color-bg-primary | #FFFFFF | Main background |
| color-bg-secondary | #F7F7F7 | Cards, sections |
| color-text-primary | #000000 | Headings, buttons |
| color-text-secondary | #666666 | Body text |
| color-border | #E5E5E5 | Borders |
| color-accent | #000000 | CTAs, active states |

### Typography
- H1: 48-64px Bold, Letter-spacing: -0.02em
- H2: 32-40px Semi-Bold
- H3: 20-24px Semi-Bold
- Body: 16px Regular, Line-height: 1.6

### Components (114 total)
- Base UI: 49 components in `/components/ui/`
- Feature pages: AvatarAdsPage, CompetitorUgcReplicationPage
- Managers: Brand, Product, Assets (CRUD interfaces)

## CRITICAL Requirements

### 1. UI Language: English ONLY

**ALL user-facing text must be in English**:
- ✓ Button labels: "Generate Video" (NOT "生成视频")
- ✓ Form inputs: placeholders, labels, validation messages
- ✓ Toasts: success/error notifications
- ✓ Modals: titles, descriptions
- ✓ Help text: tooltips, instructions

**Exception**: Language selector native names (e.g., '中文' for Chinese option)

**Why**: Product maintains English-first UX. Chinese language support is for AI prompt generation, not UI copy.

**Locations to Check**:
- `/components/ui/LanguageSelector.tsx`
- `/components/competitor-ugc-replication/SegmentInspector.tsx`
- `/components/EditCompetitorAdModal.tsx`

### 2. Package Manager: pnpm ONLY

**ALWAYS use pnpm** (never npm or yarn):

```bash
pnpm install                    # Install dependencies
pnpm add <package>              # Add package (updates pnpm-lock.yaml)
pnpm add -D <package>           # Add dev dependency
pnpm remove <package>           # Remove package (updates lock file)
```

**Lock File Rules**:
1. EVERY `pnpm add` or `pnpm remove` updates `pnpm-lock.yaml`
2. ALWAYS commit the updated lock file
3. NEVER manually edit pnpm-lock.yaml
4. Before commit: `git diff pnpm-lock.yaml` (verify changes)

**Why**: Lock file ensures deterministic builds. Mismatched dependencies cause Vercel build failures.

### 3. Database Schema Verification: Supabase MCP MANDATORY

**ALWAYS use Supabase MCP to verify schema BEFORE any database code**.

**Workflow**:
1. Identify table → 2. Run MCP query → 3. Document in code → 4. Use exact columns

**Example**:
```typescript
// Schema verified via MCP (2026-01-07):
// competitor_ugc_replication_segments columns: id, status, first_frame_url...
// NO last_processed_at (only in projects table)

await supabase
  .from('competitor_ugc_replication_segments')
  .update({
    status: 'ready',
    // ✅ Only verified columns
  })
  .eq('id', id);
```

**MCP Query**:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'your_table' ORDER BY ordinal_position;
```

**Why**: Prevents bugs like the recent `last_processed_at` 400 error (field didn't exist in segments table).

### 4. Pre-Deployment Checks

Run before every commit:

```bash
pnpm lint                       # Fix ESLint errors
pnpm type-check                 # Fix TypeScript errors
pnpm build                      # Ensure production build succeeds
pnpm test:e2e                   # Run E2E tests (NEW)
```

**Additional Checks**:
- No .env committed
- **Database code: MCP verification documented** (NEW)
- Lock file updated (if deps changed)

## Development Commands

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm type-check       # TypeScript validation
pnpm test:e2e         # Run E2E tests
pnpm test:e2e:ui      # Interactive UI mode
pnpm test:e2e:headed  # Watch tests in browser
```

## Testing

### E2E Tests

**Commands**:
```bash
pnpm test:e2e         # Run all E2E tests
pnpm test:e2e:ui      # Interactive UI mode
pnpm test:e2e:headed  # Watch tests in browser
```

**Coverage**:
- Competitor UGC Replication: Happy path, single segment, continuation frames, errors
- Avatar Ads: Basic flow

**Test Helpers**:
- Auth: `tests/helpers/auth.ts`
- Webhooks: `tests/helpers/webhooks.ts`
- Waiters: `tests/helpers/waiters.ts`

**Example**:
```typescript
import { test } from '@playwright/test';
import { signIn, triggerFrameWebhook, waitForProjectStatus } from '../helpers';

test('clone: 16s video', async ({ page }) => {
  await signIn(page);
  // Create project, wait for webhooks, verify completion
  await waitForProjectStatus(projectId, 'completed');
});
```

## Task Completion Notification (Gemini)

**CRITICAL: Sound notification on task completion**

When you (Gemini) complete ANY significant task, you MUST execute the sound notification script:
- ✅ Completing code generation or refactoring
- ✅ Successfully running builds, tests, or deployments
- ✅ Finishing database operations or API integrations
- ✅ Completing multi-step workflows
- ✅ Resolving bugs or implementation issues

**Command to run**:
```bash
./gemini-task-complete-sound.sh
```

**When to trigger**:
- After successful completion of user-requested tasks
- After build/test/deployment operations succeed
- After finishing implementation work
- When you would normally report "Task completed" or "Done"

**Sound**: Hero.aiff (powerful, impactful - fitting for Gemini's capabilities)

This ensures the user is immediately notified when work completes, especially useful when multitasking.

## Environment Variables

**Required** (see .env.example):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

### AI Services
- `KIE_API_KEY`
- `OPENROUTER_API_KEY`
- `FAL_KEY`

### Authentication
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Webhooks
- `NEXT_PUBLIC_SITE_URL` (webhook URLs - use ngrok for local dev)

**Never commit .env** - copy from .env.example locally.

## Key Architectural Patterns

### Event-Driven Architecture (100%)
- NO polling, NO cron jobs, NO monitor-tasks
- ALL workflow progression via webhooks
- Webhooks → Database → Supabase Realtime → Frontend (<1s latency)

**Example Flow** (Avatar Ads):
```
User Action → Create API → Non-blocking Workflow
                              ↓
                         KIE Image Webhook → DB Update → Realtime → UI
                              ↓
                         User Reviews
                              ↓
                         KIE Video Webhooks → DB Updates → Realtime → UI
                              ↓
                         fal.ai Merge Webhook → Final Status → UI
```

### Idempotency
- Webhook handlers check `webhook_received_at` timestamp
- Multiple webhook deliveries safe (no duplicate processing)
- Stateless webhook handlers

**Example**:
```typescript
if (segment.first_frame_webhook_received_at) {
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

### Non-Blocking Workflows
- API endpoints return immediately
- Background tasks run async (IIFE or fire-and-forget)
- User sees instant confirmation

**Example**:
```typescript
// Return immediately
const { data: project } = await supabase.from('avatar_ads_projects').insert({...}).single();

// Background workflow (fire-and-forget)
(async () => {
  await runAvatarAdsWorkflow(project.id);
})();

return new Response(JSON.stringify({ project_id: project.id }), { status: 200 });
```

### Continuation Frames (UGC Replication)
- Segment 2+ use previous segment's first frame as visual reference
- Ensures coherent narrative flow
- Frame webhook auto-triggers next segment generation

## Important "Do Nots"

1. **DO NOT** use npm or yarn (pnpm only)
2. **DO NOT** commit .env files
3. **DO NOT** add Chinese UI text (English only)
4. **DO NOT** implement Version 3.0 billing (use Version 2.0)
5. **DO NOT** skip pnpm-lock.yaml commits
6. **DO NOT** add polling/cron jobs (use webhooks)
7. **DO NOT** manually edit pnpm-lock.yaml
8. **DO NOT** use `setInterval` for status updates (use Supabase Realtime)
9. **DO NOT** skip type-check before building
10. **DO NOT** expose API keys in client code
11. **DO NOT** write database code without MCP schema verification
12. **DO NOT** assume database fields exist based on naming patterns

## Testing Guidelines

- **E2E**: Playwright tests (when present)
- **Linting**: `pnpm lint` before declaring task complete
- **Type Check**: `pnpm type-check` for TypeScript safety
- **Build**: `pnpm build` to verify production build

**Testing Realtime Updates**:
1. Open browser console and watch for Realtime logs
2. Create new project
3. Observe real-time status changes without page refresh
4. Verify no polling requests in Network tab

## Common Tasks

### Adding New Feature
1. Check `design_guide.md` for UI patterns
2. Add database table/migration if needed
3. Implement workflow in `lib/{feature}-workflow.ts`
4. Create UI in `components/pages/{Feature}Page.tsx`
5. Add API routes in `app/api/{feature}/`
6. Add webhook handlers if event-driven
7. Test: Create → Monitor → Verify

### Modifying Prompts
1. Update in `lib/{workflow}-workflow.ts`
2. Document change reason (comment)
3. Test with real projects
4. Verify JSON output format

### Debugging Webhooks
1. Check Supabase logs (database updates)
2. Check Vercel logs (webhook execution)
3. Verify `webhook_received_at` set
4. Test locally: ngrok + NEXT_PUBLIC_SITE_URL

### Managing Dependencies
```bash
# Add package
pnpm add @radix-ui/react-dialog

# Verify lock file updated
git diff pnpm-lock.yaml

# Commit both
git add package.json pnpm-lock.yaml
git commit -m "feat: add radix dialog component"
```

## Common Errors & Solutions

### Vercel Build Failure: Type Error
**Error**: `Type 'string' is not assignable to type 'VideoDuration'`

**Solution**: Check if type union changed in `lib/constants.ts`, update all components using the type

### Webhook Not Triggering
**Error**: Status stuck on `generating_image`

**Solution**: Check KIE API task_id, verify webhook URL, test endpoint with curl, check Vercel logs

### Realtime Not Updating
**Error**: UI not updating after webhook completes

**Solution**: Verify Supabase Realtime enabled:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE avatar_ads_projects;
```

### pnpm Lock File Conflict
**Error**: Merge conflict in `pnpm-lock.yaml`

**Solution**:
```bash
git checkout --theirs pnpm-lock.yaml
pnpm install
pnpm install --frozen-lockfile
```

## Performance Best Practices

### Database
- Use `.select()` to specify columns
- Use `.limit()` for pagination
- Create indexes on frequently queried columns

### Images
- Use Next.js Image component
- Compress images client-side before upload
- Configure domains in `next.config.js`

### Videos
- Generate segments in parallel
- Use webhooks instead of polling
- Cache merged videos in Supabase Storage

## Security Best Practices

### API Routes
- Use Clerk middleware for `/dashboard` routes
- Validate user ownership before operations
- Never expose API keys in client code

### Input Validation
- Use Zod schemas for request validation
- Sanitize user inputs before AI prompts
- Validate file types and sizes on upload

### Webhooks
- Verify webhook signatures (if available)
- Use idempotency checks
- Return 200 status even on errors (prevents retries)

## Key Libraries

### UI
- TailwindCSS v4, Radix UI, Lucide React, Framer Motion
- CVA (class-variance-authority) for component variants

### Data & Validation
- Supabase client, Zod (schema validation)
- React hooks for API calls

### AI & Media
- @fal-ai/client (video merge)
- Custom fetch utilities with retry logic
- Browser Image Compression

### Analytics
- Vercel Analytics, PostHog

## Project Context Summary

**Flowtra** helps small businesses generate UGC-style marketing videos using AI. The app has two primary features:

1. **Avatar Ads**: Character-based talking head videos (8-80s, multi-language support)
2. **Competitor UGC Replication**: Clone competitor ad structure for your products (8-64s, dual-mode)

Both features use **100% event-driven architecture** (webhooks + Supabase Realtime) for real-time status updates with <1s latency.

**Credit billing**: Generation-time (upfront), with free downloads and automatic refunds on failure.

**Design**: Minimalist black-on-white SaaS style (design_guide.md) with 114 components.

**Tech stack**: Next.js 16, React 19, TypeScript 5, Supabase, Clerk, KIE API, OpenRouter, fal.ai.

**Package management**: pnpm ONLY - always update pnpm-lock.yaml.

**UI language**: English ONLY (except language selector native names).
