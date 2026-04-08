# Flowtra Agent Handbook

## Quick Rules

- **Package Manager**: ALWAYS use `pnpm` for ALL dependency operations
- **Lock File**: EVERY pnpm operation must update `pnpm-lock.yaml` - commit it
- **Database Schema Verification**: ALWAYS use Supabase MCP to verify schema BEFORE any database code
- **RLS**: For CRUD features, do NOT configure Supabase RLS policies. User identity and access are handled by Clerk.
- **RLS**: Do NOT configure RLS when building CRUD features; user identity and access are handled by Clerk
- **Language**: Application code, docs, comments: English. UI copy: English ONLY.
- **Design**: Follow minimalist SaaS style from design_guide.md
- **Secrets**: Never commit .env - copy from .env.example locally
- **Project Structure**:
  - `docs/` - Official API documentation (KIE, fal.ai, Creem, TikTok)
  - `scripts/` - Test scripts and utility tools

## OpenCode MCP Configuration

### Overview

OpenCode uses `opencode.json` for MCP server configuration (NOT `.mcp.json` which is Claude Desktop format).

### Configured MCP Servers

**opencode.json**:

```json
{
  "mcp": {
    "supabase": { "type": "local", "enabled": true },
    "github": { "type": "remote", "enabled": false },
    "context7": { "type": "remote", "enabled": false },
    "gh_grep": { "type": "remote", "enabled": true }
  }
}
```

### Environment Variables Required

Add to `.env`:

- `SUPABASE_ACCESS_TOKEN` - For Supabase MCP database operations
- `CONTEXT7_API_KEY` - (Optional) For Context7 doc search (higher rate limits)

### MCP Usage Guidelines

**Supabase MCP** (Always Enabled):

- Use `mcp__supabase__execute_sql()` to verify database schema
- Use `mcp__supabase__list_tables()` to explore table structure
- Use `mcp__supabase__generate_typescript_types()` to generate types
- Document schema verification in comments with date (see Database Schema Verification section below)

**GitHub MCP** (Disabled Globally - High Token Usage):

- Enables GitHub repository access and operations
- Disabled by default (adds significant context tokens)
- Enable in specific agent config if needed

**Context7** (Disabled Globally - Opt-in):

- Search technical documentation (Next.js, Supabase, TailwindCSS, etc.)
- Optional: Use without API key for basic rate limits
- To enable: Add `"context7": true` to `tools` section or prompt explicitly

**gh_grep** (Enabled):

- Search code snippets on GitHub
- Useful for finding code examples and patterns
- Add `use the gh_grep tool` to prompts when needed

### Example MCP Usage

**Verify Database Schema**:

```typescript
// Schema verified via Supabase MCP (2026-01-11):
await mcp__supabase__execute_sql({
  query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_credits'`,
});
```

**Search Documentation** (Context7):

```
Search Next.js 16 App Router caching documentation. use context7
```

**Search GitHub Code** (gh_grep):

```
Find examples of Supabase Realtime subscriptions in Next.js. use the gh_grep tool
```

### Managing MCP Servers

**Disable MCP Tool**:

```json
{
  "tools": {
    "github": false,
    "context7": false
  }
}
```

**Enable Per Agent**:

```json
{
  "agent": {
    "my-agent": {
      "tools": {
        "context7": true
      }
    }
  }
}
```

### MCP Commands

```bash
# List all MCP servers and status
opencode mcp list

# Authenticate with OAuth-enabled MCP (e.g., GitHub)
opencode mcp auth github

# Debug MCP connection issues
opencode mcp debug supabase

# Remove stored credentials
opencode mcp logout github
```

## Core Product: Two AI Video Generation Features

### 1. Avatar Ads (Character-Based Advertisements)

**What it is**: AI-powered talking head videos where a character (avatar) discusses a product or topic.

**User Flow**:

1. Upload character photo
2. Select product (optional) or enter custom dialogue
3. Choose duration (8-80s), language, format (16:9 or 9:16)
4. AI generates: Cover image → Video scenes → Merged video

**Key Files**:

- Workflow: `lib/avatar-ads-workflow.ts` (1,639 lines)
- UI: `components/pages/AvatarAdsPage.tsx` (1,402 lines)
- API: `app/api/avatar-ads/` (create, status, download, webhooks)
- Database: `avatar_ads_projects`, `avatar_ads_scenes`

**Technical Details**:

- Fixed model: veo3_fast (20 credits per 8s segment)
- AI services: Gemini 2.5 Flash (prompts), KIE API (image/video), fal.ai (merge)
- 100% event-driven: Webhooks + Supabase Realtime (no polling)
- Generation-time billing: Credits deducted upfront, downloads free

**Workflow Steps**:

1. **Prompt Generation**: Gemini analyzes character + product → generates scene prompts with dialogue
2. **Image Generation**: KIE creates cover image → User reviews in Inspector modal
3. **Confirmation**: User approves or regenerates cover
4. **Video Generation**: KIE generates each 8-second segment in parallel
5. **Merging** (Multi-scene only): fal.ai stitches segments together
6. **Completion**: Project marked 100% complete → Available for download

**Two Modes**:

- **Product-Based**: Character showcases product with AI dialogue
- **Talking Head**: Character speaks about topic/script (no product)

### 2. Competitor UGC Replication (Clone Feature)

**What it is**: Analyze competitor ads and generate similar videos for your products, or create original videos from product photos.

**Two Modes**:

1. **Traditional Mode**: Product photo → AI creates original video
2. **Competitor Reference Mode (Clone)**: Competitor ad + product photo → AI clones structure, replaces product

**Competitor Cloning Process**:

1. User uploads competitor video
2. AI analyzes (via Gemini 2.5 Flash):
   - Shot-by-shot breakdown (10 elements per shot)
   - Complete video script and narrative flow
   - Timing, style, camera movements
   - Color palette and visual aesthetics
   - Brand/product containment flags
3. AI generates prompts that clone competitor's structure but feature user's product
4. Video generated in 8-second segments with continuation frames

**User Flow**:

1. Upload product image(s)
2. Select brand and competitor ad (optional - triggers clone mode)
3. Choose video model (veo3 or veo3_fast), duration (8-64s), language
4. AI generates: Frame generation → Video generation → Merge

**Key Files**:

- Workflow: `lib/video-clone-workflow.ts` (2,922 lines)
- UI: `components/pages/VideoClonePage.tsx`
- API: `app/api/video-clone/` (create, status, merge, webhooks)
- Database: `video_clone_projects`, `video_clone_segments`
- Competitor shots: `lib/reference-video-shots.ts` (shot data structure)

**Technical Details**:

- Models: veo3 (150 credits/8s) or veo3_fast (20 credits/8s) - user choice
- 3-phase workflow: Frame → Video → Merge
- Continuation frames: Previous segment as visual reference
- Event-driven: Webhooks auto-trigger next steps

**3-Phase Workflow**:

1. **Frame Generation** (Sequential):
   - Generate first frame for each segment via KIE API
   - Segments with `is_continuation_from_prev=true` wait for previous frame
   - Frame webhook auto-triggers next segment generation
   - Smart routing: Brand/product shots use reference images
   - Duration: 30-60 seconds per frame

2. **Video Generation** (Parallel):
   - Once ALL frames ready, user triggers video generation
   - Each segment generates independently using KIE Veo3 API
   - Uses first frame + closing frame for smooth transitions
   - Duration: 60-180 seconds per segment

3. **Video Merge** (Conditional):
   - Single segment (8s) → No merge, directly completed
   - Multiple segments → fal.ai merge operation
   - Duration: 5-30 seconds

## Architecture Overview

- **Framework**: Next.js 16 (App Router) + TypeScript + Supabase
- **Authentication**: Clerk (user_id drives all data access)
- **Database**: Supabase PostgreSQL (18 tables)
- **Storage**: Supabase Storage (organized by workflow/user)
- **AI Services**: KIE API (image/video), Vercel AI Gateway (LLM routing), fal.ai (merge)
- **Realtime**: Supabase Realtime (PostgreSQL pub/sub)
- **Package Manager**: pnpm (strict enforcement)

## Database Schema (18 Tables)

### Core Project Tables (4)

- `video_clone_projects` - UGC clone projects with brand/competitor references
- `video_clone_segments` - 8-second video segments with continuation support
- `avatar_ads_projects` - Character ad projects with dialogue/language
- `avatar_ads_scenes` - Individual video scenes for avatar ads

### User & Credits (3)

- `user_credits` - Credit balance, subscription credits, purchase history
- `credit_transactions` - Complete audit ledger (deductions, refunds, adjustments)
- `user_subscriptions` - Subscription management and billing cycles

### Assets (5)

- `user_brands` - Brand profiles with logos, slogans, brand_details
- `user_products` - Product catalog with descriptions and brand associations
- `user_product_photos` - Product image gallery (multiple photos per product)
- `user_avatars` - Character photos for avatar ads with optimization
- `reference_videos` - Competitor video analysis data (shot breakdown, style, timing, language)

### Support Tables (6)

- `articles` - Blog and help documentation content
- `user_tiktok_connections` - TikTok authentication for direct posting
- `site-assets` - Canonical bucket for landing, blog, and shared static assets
- `subscription_events` - Subscription lifecycle events (created, updated, cancelled)
- `temp-uploads` - Canonical temporary upload bucket for analysis and draft flows

## Design System (design_guide.md)

### Color Palette

- Background: #FFFFFF (white)
- Secondary: #F7F7F7 (light gray)
- Text Primary: #000000 (black)
- Text Secondary: #666666 (gray)
- Border: #E5E5E5 (light gray)
- Accent: #000000 (black)

### Typography

- Font: Geometric Sans-Serif (Inter, Plus Jakarta Sans, Satoshi)
- H1: 48-64px Bold, Letter-spacing: -0.02em
- H2: 32-40px Semi-Bold, Centered
- H3: 20-24px Semi-Bold
- Body: 16px Regular, Line-height: 1.6
- Small/Label: 12-14px Medium

### Components (114 total)

- **Base UI**: 49 components in `/components/ui/`
  - Buttons, cards, inputs, badges, dialogs, sheets, tabs, tooltips
  - VideoModelSelector, VideoDurationSelector, VideoAspectRatioSelector
  - ImageModelSelector, LanguageSelector, FormatSelector
  - CreditsDisplay, DownloadButton, GenerationProgressDisplay

- **Feature Pages**:
  - `VideoClonePage.tsx` - UGC clone UI
  - `AvatarAdsPage.tsx` - Avatar ads UI
  - `HistoryPage.tsx` - Project history with legacy support

- **Managers** (CRUD interfaces):
  - BrandManager, ProductManager, AssetsManager
  - ReferenceVideosList, VideoCloneRecentList

### CRITICAL: UI Language Requirement

**ALL user-facing UI text must be in English**:

- ✓ Button labels: "Generate Video" (NOT "生成视频")
- ✓ Form inputs: placeholders, labels, validation messages
- ✓ Toasts: success/error notifications
- ✓ Modals: titles, descriptions
- ✓ Help text: tooltips, instructions

**Exception**: Language selector native names (e.g., '中文' label for Chinese option in dropdown)

**Why**: Product maintains English-first UX for global audience. Chinese language support is for AI prompt generation (dialogue, narration), not UI text.

**Locations to Check**:

- `/components/ui/LanguageSelector.tsx` - Language dropdown (native name: '中文')
- `/components/video-clone/SegmentInspector.tsx` - Segment inspector
- `/components/EditReferenceVideoModal.tsx` - Competitor ad modal

## Credit System (Version 2.0)

### Billing Model

- **Generation**: Credits deducted when video generation starts (upfront)
- **Download**: FREE (no credit deduction, unlimited downloads)
- **Refunds**: Automatic if generation fails after max retries

### Costs

- **Veo3.1**: 150 credits per 8-second segment
- **Veo3.1 Fast**: 20 credits per 8-second segment
- **Image generation**: FREE (nano_banana_pro, seedream)
- **Video merge**: FREE (fal.ai operation)

### Examples

- 32-second veo3_fast video: 4 segments × 20 = 80 credits
- 64-second veo3 video: 8 segments × 150 = 1,200 credits
- 8-second single segment: 1 segment × cost = 20 or 150 credits

**Important**: Do NOT implement Version 3.0 mixed billing (deprecated). All models use unified generation-time billing.

## Development Workflow

### Task Completion Notification (AI Agents)

**CRITICAL: Sound notification on task completion**

When you (AI Agent) complete ANY significant task, you MUST execute the sound notification script:

- ✅ Completing planned implementation tasks
- ✅ Finishing code generation or refactoring work
- ✅ Successfully running builds, tests, or deployments
- ✅ Completing database migrations or API integrations
- ✅ Finishing multi-step workflow execution

**Command to run**:

```bash
./task-complete-sound.sh
```

**When to trigger**:

- After marking all todos as completed
- After successful build/test/deployment operations
- After finishing any task that took multiple steps
- When you would normally report "Completed successfully" or "Done"

**Sound**: Ping.aiff (clean, professional - suitable for agent workflows)

**Example workflow**:

1. User requests: "Implement feature X"
2. You plan and execute the feature
3. You verify it works (run build, tests, etc.)
4. You run `./task-complete-sound.sh` to notify the user
5. You report completion to the user

This ensures the user is immediately notified when tasks complete, especially useful when they're working on other things.

### CRITICAL: pnpm Dependency Management

**ALWAYS use pnpm** (never npm or yarn):

```bash
pnpm install                    # Install dependencies
pnpm add <package>              # Add package (updates pnpm-lock.yaml)
pnpm add -D <package>           # Add dev dependency (updates pnpm-lock.yaml)
pnpm remove <package>           # Remove package (updates lock file)
pnpm install --frozen-lockfile  # CI/production installs (no updates)
```

**Lock File Rules**:

1. EVERY `pnpm add` or `pnpm remove` updates `pnpm-lock.yaml`
2. ALWAYS commit the updated lock file with your changes
3. NEVER manually edit pnpm-lock.yaml
4. Before pushing: Verify `git diff pnpm-lock.yaml` shows changes

**Why**: Lock file ensures deterministic builds. Mismatched dependencies cause Vercel build failures.

**Example Workflow**:

```bash
# Add a new package
pnpm add react-query

# Verify lock file updated
git diff pnpm-lock.yaml

# Commit both changes together
git add package.json pnpm-lock.yaml
git commit -m "feat: add react-query for data fetching"
```

### CRITICAL: Database Schema Verification

**ALWAYS verify database schema via Supabase MCP BEFORE writing any INSERT/UPDATE/SELECT code**.

**Mandatory Workflow**:

1. **Identify Target Table**:

   ```typescript
   // Example: Need to update video_clone_segments
   ```

2. **Verify Schema via MCP**:

   ```typescript
   // Use Supabase MCP to get column list
   await mcp__supabase__execute_sql({
     query: `
       SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'video_clone_segments'
       ORDER BY ordinal_position;
     `,
   });
   ```

3. **Document Verification in Code**:

   ```typescript
   // Schema verified via Supabase MCP (2026-01-07):
   // video_clone_segments has: status, first_frame_url,
   // first_frame_webhook_received_at (NO last_processed_at)

   await supabase
     .from("video_clone_segments")
     .update({
       status: "first_frame_ready",
       first_frame_webhook_received_at: new Date().toISOString(),
       // ✅ Only using verified columns
     })
     .eq("id", segment.id);
   ```

4. **Use Exact Column Names**:
   - Copy-paste from MCP output
   - Never assume fields exist based on naming patterns
   - Check nullable constraints before setting null

**Real-World Example (Wrong)**:

```typescript
// ❌ NO schema verification, assumed field exists

await supabase
  .from("video_clone_segments")
  .update({
    status: "ready",
    last_processed_at: new Date().toISOString(), // ❌ Field doesn't exist!
  })
  .eq("id", segment.id);

// Result: 400 error, stuck segments, manual repair required
```

**Real-World Example (Correct)**:

```typescript
// Schema verified via Supabase MCP (2026-01-07):
// video_clone_segments columns:
// - id, project_id, segment_index, status, prompt
// - first_frame_task_id, first_frame_url, first_frame_webhook_received_at
// - video_task_id, video_url, video_webhook_received_at
// - error_message, retry_count, contains_brand, contains_product
// NOTE: No last_processed_at field (only exists in projects table)

await supabase
  .from("video_clone_segments")
  .update({
    status: "first_frame_ready",
    first_frame_url: imageUrl,
    first_frame_webhook_received_at: new Date().toISOString(),
    // ✅ All fields verified via MCP
  })
  .eq("id", segment.id);
```

**Why This Matters**:
The `last_processed_at` bug (2026-01-07) was caused by assuming this field existed in the segments table when it only existed in the projects table. This caused:

- 400 database errors
- Segment continuation chain breakage
- 3 stuck projects requiring manual repair
- MCP verification would have caught this immediately

**MCP Tool Reference**:

- `list_tables(schemas: ["public"])` - Table overview
- `execute_sql(query: "SELECT...")` - Schema inspection
- `generate_typescript_types()` - Type generation (run after migrations)

**Type Safety (Recommended)**:

```bash
# Generate TypeScript types from database schema
pnpm db:types
# Commit lib/database.types.ts to git
```

### Pre-Deployment Checklist

Run these commands before EVERY commit/push:

```bash
pnpm lint                       # Fix all ESLint errors
pnpm type-check                 # Fix all TypeScript errors
pnpm build                      # Ensure production build succeeds
pnpm test:e2e                   # Run E2E tests (NEW)
git diff pnpm-lock.yaml         # Verify lock file updated (if deps changed)
```

**Additional Checks**:

- Verify no secrets in .env committed
- **Database code: MCP verification documented in comments** (NEW)
- Test locally: `pnpm start` (production server)
- If dependencies changed: Lock file MUST be updated

### Local Development

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

### Testing

**E2E Tests (Playwright)**:

```bash
pnpm test:e2e         # Run all E2E tests
pnpm test:e2e:ui      # Interactive UI mode
pnpm test:e2e:headed  # Watch tests in browser
pnpm test:e2e:debug   # Step-by-step debugging
```

**Test Structure**:

```
tests/e2e/
├── video-clone/
│   ├── happy-path.spec.ts          # 16s 2-segment flow
│   ├── single-segment.spec.ts      # 8s no-merge
│   ├── continuation-frames.spec.ts # Auto-trigger test
│   └── error-handling.spec.ts      # Retry scenarios
└── avatar-ads/
    └── basic-flow.spec.ts
```

**Test Helpers**:

- `tests/helpers/auth.ts` - Clerk authentication
- `tests/helpers/webhooks.ts` - Simulate KIE/fal.ai callbacks
- `tests/helpers/waiters.ts` - Smart polling (exponential backoff)
- `tests/helpers/database.ts` - Test data setup/cleanup

**Writing Tests**:

1. Use helpers for auth, webhooks, waiting
2. Always cleanup test data in afterEach
3. Use smart waiters (exponential backoff) not hardcoded sleeps
4. Simulate webhooks for deterministic testing

**Example**:

```typescript
import { test, expect } from "@playwright/test";
import { signIn } from "../helpers/auth";
import { triggerFrameWebhook } from "../helpers/webhooks";
import { waitForProjectStatus } from "../helpers/waiters";

test("clone: 16s video generation", async ({ page }) => {
  await signIn(page);
  // ... test flow
  await waitForProjectStatus(projectId, "segment_frames_ready");
  expect(await page.locator(".progress").textContent()).toBe("70%");
});
```

## Environment Variables

**Required** (see .env.example for full list):

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Public key for client-side
- `SUPABASE_SECRET_KEY` - Secret key for server-side admin operations

### AI Services

- `KIE_API_KEY` - KIE API key for image/video generation
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway API key for local development
- `AI_GATEWAY_MODEL` - Default Vercel AI Gateway model for chat, prompt, and general image-analysis tasks
- `OPENROUTER_API_KEY` - OpenRouter API key for creator video analysis only
- `OPENROUTER_MODEL` - OpenRouter model for creator video analysis only
- `FAL_KEY` - fal.ai API key for video merging

### Authentication

- `CLERK_SECRET_KEY` - Clerk secret key (server-side)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key (client-side)

### Webhooks

- `NEXT_PUBLIC_SITE_URL` - Base URL for webhook callbacks (use ngrok URL for local dev)

**Never commit .env** - always copy from .env.example locally.

## Key Technical Patterns

### Event-Driven Architecture (100%)

- NO polling loops, NO cron jobs, NO monitor-tasks
- ALL workflow progression via webhooks
- Webhooks update database → Supabase Realtime → Frontend (<1s latency)

**Flow Example** (Avatar Ads):

```
User Action → Create API → Non-blocking Workflow
                              ↓
                         KIE Image Generation
                              ↓
                         Image Webhook → DB Update → Realtime Push → UI
                              ↓
                         User Reviews & Approves
                              ↓
                         KIE Video Generation (per scene)
                              ↓
                         Video Webhooks → DB Updates → Realtime Push → UI
                              ↓
                         Auto-trigger Merge (if multi-scene)
                              ↓
                         Merge Webhook → Final Status → Realtime Push → UI
```

### Idempotency

- Webhook handlers check `webhook_received_at` timestamp
- Multiple webhook deliveries safe (no duplicate processing)
- Stateless webhook handlers

**Example** (Frame Webhook):

```typescript
// Check if already processed
if (segment.first_frame_webhook_received_at) {
  console.log("Frame webhook already processed, skipping");
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

// Process webhook
const { data, error } = await supabase
  .from("video_clone_segments")
  .update({
    first_frame_url: resultUrl,
    status: "first_frame_ready",
    first_frame_webhook_received_at: new Date().toISOString(),
  })
  .eq("id", segment.id);
```

### Non-Blocking Workflows

- API endpoints return immediately after database insert
- Background tasks run async (IIFE or fire-and-forget)
- User sees instant confirmation, not loading spinners

**Example** (Non-Blocking Background Task):

```typescript
// API returns immediately
const { data: project } = await supabase
  .from("avatar_ads_projects")
  .insert({ user_id, status: "pending" })
  .select()
  .single();

// Background workflow (fire-and-forget)
(async () => {
  try {
    await runAvatarAdsWorkflow(project.id);
  } catch (error) {
    console.error("Workflow error:", error);
  }
})();

// Return to user immediately
return new Response(JSON.stringify({ project_id: project.id }), {
  status: 200,
});
```

### Continuation Frames (UGC Replication)

- Segment 2+ use segment 1's first frame as visual reference
- Ensures coherent narrative flow across segments
- Frame webhook auto-triggers next segment (event-driven)

**Example** (Auto-Trigger Next Segment):

```typescript
// After current segment's frame is ready
if (currentSegment.segment_index < totalSegments - 1) {
  const nextSegment = segments[currentSegment.segment_index + 1];

  if (nextSegment.prompt.is_continuation_from_prev) {
    // Auto-trigger next segment's frame generation (non-blocking)
    (async () => {
      await generateFrame(nextSegment.id, {
        prompt: nextSegment.prompt,
        referenceImage: currentSegment.first_frame_url, // Use as visual reference
      });
    })();
  }
}
```

## Common Tasks

### Adding a New Feature

1. **Review Design Guide**:

   ```bash
   cat design_guide.md
   ```

2. **Create Database Migration** (if needed):
   - Use Supabase SQL Editor
   - Add new table or columns
   - Update TypeScript types in `lib/supabase.ts`

3. **Implement Workflow Logic**:

   ```bash
   # Create workflow file
   touch lib/{feature}-workflow.ts
   ```

4. **Create UI Components**:

   ```bash
   # Create page component
   touch components/pages/{Feature}Page.tsx
   ```

5. **Add API Routes**:

   ```bash
   # Create API routes
   mkdir -p app/api/{feature}
   touch app/api/{feature}/create/route.ts
   touch app/api/{feature}/\[id\]/status/route.ts
   ```

6. **Add Webhook Handlers** (if event-driven):

   ```bash
   mkdir -p app/api/{feature}/webhooks
   touch app/api/{feature}/webhooks/completion/route.ts
   ```

7. **Test**:
   - Create project via UI
   - Monitor database in Supabase Dashboard
   - Verify Realtime updates in browser console

### Modifying AI Prompts

1. **Update Prompt** in `lib/{workflow}-workflow.ts`:

   ```typescript
   const prompt = `
   You are an expert video creator...
   
   [NEW REQUIREMENTS]
   - Add constraint here
   - Modify behavior here
   `;
   ```

2. **Document Change Reason** (comment):

   ```typescript
   // 2025-12-27: Modified prompt to emphasize product features
   // Reason: Users reported dialogue was too generic
   ```

3. **Test with Real Projects** (not just mock data):
   - Create test project via UI
   - Review generated output
   - Verify JSON format matches schema

4. **Verify JSON Output Format**:
   ```typescript
   const expectedSchema = {
     segments: [{ first_frame_description: string, shots: [...] }]
   };
   ```

### Debugging Webhooks

1. **Check Supabase Logs** for database updates:
   - Supabase Dashboard → Logs → Database
   - Verify UPDATE queries executed

2. **Check Vercel Logs** for webhook handler execution:
   - Vercel Dashboard → Deployments → {Deployment} → Functions
   - Search for webhook route logs

3. **Verify Idempotency**: Is `webhook_received_at` set?

   ```sql
   SELECT first_frame_webhook_received_at FROM video_clone_segments WHERE id = 'xxx';
   ```

4. **Test Locally** with ngrok:

   ```bash
   # Start ngrok
   ngrok http 3000

   # Set webhook URL in .env
   NEXT_PUBLIC_SITE_URL=https://abc123.ngrok.io

   # Test webhook
   curl -X POST https://abc123.ngrok.io/api/video-clone/webhooks/frame \
     -H "Content-Type: application/json" \
     -d '{"data": {"taskId": "xxx", "resultUrls": ["https://..."]}}'
   ```

### Testing Realtime Updates

1. **Open Browser Console** and watch for Realtime logs:

   ```javascript
   // Look for logs like:
   [Avatar Ads Realtime] Project updated: project-id
   [Avatar Ads Realtime] Subscription created for: project-id
   ```

2. **Create New Project** via UI

3. **Observe Real-time Status Changes** without page refresh:
   - Status: pending → generating_image → awaiting_review → generating_videos → completed

4. **Verify No Polling Requests** in Network tab:
   - Should see NO repeated /status API calls
   - Should see Supabase Realtime WebSocket connection

5. **Confirm Webhook Callbacks** trigger next steps immediately:
   - Image webhook → Status updates within 1 second
   - Video webhook → Merge triggered automatically

### Managing Dependencies

**Adding a New Package**:

```bash
# Add package
pnpm add @radix-ui/react-dialog

# Verify lock file updated
git diff pnpm-lock.yaml

# Should show new package entry
```

**Removing a Package**:

```bash
# Remove package
pnpm remove unused-package

# Verify lock file updated (package removed)
git diff pnpm-lock.yaml
```

**Upgrading a Package**:

```bash
# Update to latest version
pnpm add package-name@latest

# Or update to specific version
pnpm add package-name@2.0.0

# Verify lock file updated
git diff pnpm-lock.yaml
```

## Key Libraries

### UI

- TailwindCSS v4 - Utility-first CSS framework
- Radix UI (headless components) - Accessible component primitives
- Lucide React - Icon library
- Framer Motion - Animation library
- CVA (class-variance-authority) - Component variant system

### Data & Validation

- Supabase client (@supabase/supabase-js) - Database and storage
- Zod - Schema validation
- React hooks for API calls

### AI & Media

- @fal-ai/client - Video merge operations
- Custom fetch utilities with retry logic (`fetchWithRetry`, `httpRequest`)
- Browser Image Compression - Client-side image compression

### Analytics & Monitoring

- Vercel Analytics - Performance monitoring
- PostHog - Product analytics and error tracking

## Git & Release Hygiene

### Commit Convention

Follow Conventional Commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

**Examples**:

```bash
git commit -m "feat: add competitor ad analysis workflow"
git commit -m "fix: prevent duplicate webhook processing"
git commit -m "docs: update AGENTS.md with pnpm requirements"
```

### PR Guidelines

- Keep PRs focused (one feature/fix per PR)
- Run `pnpm lint && pnpm type-check && pnpm build` before pushing
- Document pricing changes in `lib/constants.ts` first
- Update corresponding UI components and documentation
- Include screenshots for UI changes

### Build Parity Checklist

- **Always run `pnpm install --frozen-lockfile` before CI-critical builds**
- **For type union changes**: Audit every setter/handler that consumes the type
- **Before pushing**: Run `pnpm lint && pnpm build` from clean state (delete `.next`)
- **If Vercel fails**: Capture exact stack trace and add regression tests

## Common Errors & Solutions

### Vercel Build Failure: Type Error

**Error**: `Type 'string' is not assignable to type 'VideoDuration'`

**Solution**:

1. Check if type union changed in `lib/constants.ts`
2. Find all components using the type
3. Update to match new union values

### Webhook Not Triggering

**Error**: Status stuck on `generating_image`

**Solution**:

1. Check KIE API task_id registered correctly
2. Verify webhook URL in KIE API payload
3. Test webhook endpoint with curl
4. Check Vercel logs for webhook execution

### Realtime Not Updating

**Error**: UI not updating after webhook completes

**Solution**:

1. Verify Supabase Realtime enabled for table:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE avatar_ads_projects;
   ```
2. Check browser console for Realtime subscription logs
3. Verify subscription filter matches project ID

### pnpm Lock File Conflict

**Error**: Merge conflict in `pnpm-lock.yaml`

**Solution**:

```bash
# Accept incoming changes
git checkout --theirs pnpm-lock.yaml

# Regenerate lock file
pnpm install

# Verify integrity
pnpm install --frozen-lockfile
```

## Performance Optimization

### Database Queries

- Use `.select()` to specify columns instead of fetching all
- Use `.limit()` for pagination
- Create indexes on frequently queried columns

### Image Optimization

- Use Next.js Image component for automatic optimization
- Configure domains in `next.config.js`
- Compress images client-side before upload

### Video Processing

- Generate segments in parallel (not sequential)
- Use webhooks instead of polling (reduces server load)
- Cache merged videos in Supabase Storage

## Security Best Practices

### API Route Protection

- Use Clerk middleware for `/dashboard` routes
- Validate user ownership before operations
- Never expose API keys in client code

### Input Validation

- Use Zod schemas for request validation
- Sanitize user inputs before AI prompts
- Validate file types and sizes on upload

### Webhook Security

- Verify webhook signatures (if available)
- Use idempotency checks to prevent duplicates
- Return 200 status even on errors (prevents retries)

## Resources

### Documentation

- `design_guide.md` - UI design specification
- `docs/` - Official API documentation
  - `docs/kie/` - KIE API documentation (veo3.1.md, nano_banana_pro.md, callback.md)
  - `docs/fal/` - fal.ai video merge documentation
  - `docs/creem/` - Creem payment integration documentation
  - `docs/tiktok/` - TikTok API integration documentation
- `scripts/` - Test scripts and utility tools
- `.env.example` - Environment variable template

### External Docs

- Next.js 16: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- TailwindCSS v4: https://tailwindcss.com/docs
- Clerk: https://clerk.com/docs
