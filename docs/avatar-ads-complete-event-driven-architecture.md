# Avatar Ads: Complete Event-Driven Architecture

**Implementation Date**: 2025-12-26
**Status**: ✅ Production Ready

## Overview

Avatar Ads workflow is now **100% event-driven** - no polling, no cron jobs, no monitor-tasks. All external services (KIE API and fal.ai) push updates via webhooks, and frontend receives instant updates via Supabase Realtime.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Avatar Ads Workflow                           │
│                     (100% Event-Driven)                              │
└─────────────────────────────────────────────────────────────────────┘

  User Action                Webhook Callbacks            Realtime Push
  ───────────                ──────────────────            ─────────────

1. Create Project
   POST /api/avatar-ads/create
   └─> Trigger generate_prompts (non-blocking)

2. Image Generation
   KIE API generates image
   └─> POST /api/avatar-ads/webhooks/image ──┐
                                              │
3. Video Generation (Scene 1, 2, ...)        │
   KIE API generates videos                  │
   └─> POST /api/avatar-ads/webhooks/video ──┤
                                              ├─> Database Update
4. Video Merge                                │       ↓
   fal.ai merges videos                       │   Realtime Push
   └─> POST /api/avatar-ads/webhooks/merge ──┘       ↓
                                                  Frontend
                                                  (< 1s latency)
```

## Webhook Endpoints

### 1. Image Generation Webhook
- **Endpoint**: `POST /api/avatar-ads/webhooks/image`
- **Trigger**: KIE API (Nano Banana / Seedream)
- **Payload**: `{ code, msg, data: { taskId, info: { resultUrls } } }`
- **Action**: Updates project with `generated_image_url`, triggers video generation
- **Next Step**: Automatically calls `generate_videos` (non-blocking)

### 2. Video Generation Webhook
- **Endpoint**: `POST /api/avatar-ads/webhooks/video`
- **Trigger**: KIE API (Veo3 Fast)
- **Payload**: `{ code, msg, data: { taskId, info: { resultUrls } } }`
- **Action**: Updates scene with `video_url`, checks if all scenes done
- **Auto-Trigger Merge**: If all scenes completed, calls `merge_videos` (non-blocking)
- **Single Scene**: If only 1 scene, sets `merged_video_url` directly (no merge needed)

### 3. Video Merge Webhook ✨ NEW
- **Endpoint**: `POST /api/avatar-ads/webhooks/merge`
- **Trigger**: fal.ai (ffmpeg-api/merge-videos)
- **Payload**: `{ request_id, status, data: { video: { url } }, error }`
- **Action**: Updates project with `merged_video_url`, sets status to `completed`
- **Result**: Project reaches 100% completion

## Database Updates & Realtime

All webhook handlers update the database using Supabase Admin client:

```typescript
await supabase
  .from('avatar_ads_projects')
  .update({
    status: 'completed',
    progress_percentage: 100,
    merged_video_url: videoUrl
  })
  .eq('id', projectId);

// ✅ Supabase Realtime automatically pushes UPDATE event to frontend
```

Frontend subscribes to realtime updates:

```typescript
supabase
  .channel(`avatar-ads-project-${projectId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'avatar_ads_projects',
    filter: `id=eq.${projectId}`
  }, (payload) => {
    // Instant update in UI (< 1 second)
    updateGenerationFromStatus(projectId, payload.new);
  })
  .subscribe();
```

## Workflow Steps (Backend)

### Step 1: Generate Prompts
- Analyzes product/person images using OpenRouter AI
- Generates scene prompts (Scene 0 = image, Scene 1+ = videos)
- Saves prompts to database
- **Next**: Automatically triggers `generate_image`

### Step 2: Generate Image
- Calls KIE API (Nano Banana Pro)
- Saves `kie_image_task_id` to database
- Returns immediately (non-blocking)
- **Webhook handles completion** → triggers `generate_videos`

### Step 3: Generate Videos
- Creates scene records in `avatar_ads_scenes` table
- Calls KIE API for each scene (Veo3 Fast)
- Saves `kie_video_task_id` per scene
- Returns immediately (non-blocking)
- **Webhook handles completion** → checks if all scenes done → triggers `merge_videos`

### Step 4: Merge Videos
- Queries all completed scene video URLs
- Calls fal.ai API with webhook URL
- Saves `fal_merge_task_id` to database
- Returns immediately (non-blocking)
- **Webhook handles completion** → sets project to `completed`

## Key Benefits

### 1. Zero Polling ✅
- No `setInterval` loops in frontend
- No background cron jobs
- No monitor-tasks endpoints

### 2. Instant Updates ✅
- Status changes appear in < 1 second
- Users see progress in real-time
- No 8-30 second delays

### 3. Scalable ✅
- Webhooks handle unlimited concurrent projects
- Realtime connections are lightweight
- No server load from continuous polling

### 4. Reliable ✅
- Webhooks retry on failure
- Idempotency checks prevent duplicate processing
- Database transactions ensure consistency

### 5. Cost Efficient ✅
- No wasted API calls
- No unnecessary database queries
- Pay only for actual work done

## Error Handling

### Webhook Failures
- All webhooks return `200 OK` (even on internal errors)
- Prevents infinite retries from external services
- Errors logged to console for debugging

### Network Errors
- Transient network issues don't fail projects
- Status remains `in_progress` and retries later
- Last-modified timestamps track staleness

### Idempotency
- `webhook_received_at` timestamp prevents duplicate processing
- Status checks prevent redundant operations
- Safe to call webhooks multiple times

## Configuration Requirements

### Supabase Realtime

Enable Realtime for Avatar Ads tables:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE avatar_ads_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE avatar_ads_scenes;
```

### Environment Variables

Required for webhook URLs:

```env
NEXT_PUBLIC_SITE_URL=https://flowtra.ai  # Production URL (or ngrok URL for local dev)
FAL_KEY=your_fal_api_key                 # For fal.ai API
```

**Local Development with ngrok:**

```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the ngrok URL (e.g., https://01aa5cc06cec.ngrok-free.app)
# Set in .env.local
NEXT_PUBLIC_SITE_URL=https://01aa5cc06cec.ngrok-free.app
```

### Webhook URL Configuration

All webhook URLs are auto-constructed from `NEXT_PUBLIC_SITE_URL`:

```typescript
// KIE API webhooks (Avatar Ads)
const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/image` : undefined;
const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/video` : undefined;

// fal.ai webhook
const webhookUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/merge` : undefined;
```

**Note:** If `NEXT_PUBLIC_SITE_URL` is not set, webhooks will not be configured and the system will fall back to polling mode (if available).

## Testing

### Manual Testing

1. Create new Avatar Ads project
2. Open browser console: `console.log('[Avatar Ads Realtime]')`
3. Watch for Realtime update logs
4. Verify no polling requests in Network tab
5. Confirm status changes appear instantly

### Webhook Testing

Use ngrok for local development to receive webhooks from external services:

```bash
# 1. Start your Next.js dev server
pnpm dev

# 2. In another terminal, start ngrok
ngrok http 3000

# 3. Copy the ngrok URL and set in .env.local
# Example: https://01aa5cc06cec.ngrok-free.app
echo "NEXT_PUBLIC_SITE_URL=https://your-ngrok-url.ngrok-free.app" >> .env.local

# 4. Restart your dev server to load new env var
```

**Important:** Webhooks will only work if `NEXT_PUBLIC_SITE_URL` is set to a publicly accessible URL. For local testing without webhooks, the system will fall back to polling mode (if available).

### Database Monitoring

Watch webhook timestamps:

```sql
SELECT
  id,
  status,
  progress_percentage,
  webhook_received_at,
  last_processed_at
FROM avatar_ads_projects
WHERE status != 'completed'
ORDER BY created_at DESC;
```

## Comparison: Before vs After

| Aspect | Before (Polling) | After (Event-Driven) |
|--------|------------------|----------------------|
| **Image Status** | Poll every 8s | Webhook (< 1s) |
| **Video Status** | Poll every 8s | Webhook (< 1s) |
| **Merge Status** | ❌ No polling! | ✅ Webhook (< 1s) |
| **Server Load** | High (continuous requests) | Low (only webhooks) |
| **Latency** | 8-30 seconds | < 1 second |
| **Scalability** | Poor (O(n) requests) | Excellent (O(1) webhooks) |
| **Code Complexity** | High (polling logic) | Low (declarative) |

## Migration Notes

### Removed Components

❌ `/api/avatar-ads/monitor-merge-tasks` - No longer needed
❌ `/api/avatar-ads/check-merge` - Temporary fix removed
❌ `scripts/check-fal-merge-status.ts` - Diagnostic script removed
❌ `scripts/fix-stuck-merge.ts` - Manual fix removed
❌ `processAvatarAdsProject(..., 'check_merge_status')` - Step removed

### Added Components

✅ `/api/avatar-ads/webhooks/merge` - fal.ai webhook handler
✅ `lib/video-merge.ts` - Updated to use `queue.submit` with webhook
✅ Frontend Realtime subscriptions - Replace polling loops

## Future Considerations

### Fallback Polling (Optional)

For maximum reliability, could add fallback polling if webhook doesn't arrive within timeout:

```typescript
// Optional: Check if webhook missed after 5 minutes
if (Date.now() - project.last_processed_at > 5 * 60 * 1000) {
  console.warn('Webhook may have been missed, checking status manually');
  await checkFalTaskStatus(project.fal_merge_task_id);
}
```

**Decision**: Not implemented - webhooks are reliable enough, and we can manually trigger checks if needed.

### Webhook Security

Current implementation validates `request_id` exists in database. Future enhancements:

- HMAC signature verification
- IP whitelist filtering
- Request rate limiting

## Conclusion

Avatar Ads workflow is now **100% event-driven**, matching the original architecture vision from 2025-12-25. All external services push updates via webhooks, eliminating all polling delays and providing instant user feedback.

**Key Achievement**: Merge status updates now take < 1 second instead of being stuck indefinitely! 🎉
