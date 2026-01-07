# Clone Video E2E Test Skill

Automated end-to-end test for the Competitor UGC Replication (clone) feature.

## Purpose

This skill simulates a complete user journey through the clone video workflow:
1. Login as test user
2. Select a ~16 second competitor video
3. Generate frames for all segments (wait for 35% progress)
4. Manually review and approve frames
5. Trigger video generation for each segment
6. Wait for all videos to complete (70-90% progress)
7. Merge all segments into final video
8. Verify 100% completion with valid video URL

## Requirements

- **MCP Servers**: Supabase MCP, Playwright MCP
- **Test User**: user_37ky51qtKUnhQtRTzDdJ5rPH9G8
- **Environment**: Local development server running at http://localhost:3000
- **Prerequisite**: At least one competitor video (~16s) uploaded to the database

## Usage

### In Claude Code CLI

```bash
/test-clone-video
```

### Via Skill Tool

```typescript
await skill('test-clone-video');
```

## Test Flow

### Phase 1: Browser Setup and Login
- Navigate to `/dashboard/competitor-ugc-replication`
- Authenticate as test user (automatic via Clerk)

### Phase 2: Select Competitor Video
- Query Supabase for random ~16s video
- Click video card in UI to select

### Phase 3: Configure Settings and Start Generation
- Set video model: veo3_fast (20 credits per 8s segment)
- Set duration: 16 seconds (2 segments)
- Set language: English
- Click "Generate Video" button
- Capture project ID from database

### Phase 4: Wait for Frame Generation (35% progress)
- Monitor database every 5 seconds
- Wait until `segment_frames_ready` status or all frames have URLs
- Timeout: 5 minutes
- Expected frames: 2 (for 16s video)

### Phase 5: Review Frames and Trigger Video Generation
- Click "Edit & Review Frames" button
- For each segment:
  - Select segment in list
  - Click "Generate Video" button
- Close editor

### Phase 6: Wait for Video Generation (70-90% progress)
- Monitor database every 10 seconds
- Wait until `awaiting_merge = true` and all segments have video URLs
- Timeout: 15 minutes
- Expected videos: 2

### Phase 7: Merge Videos
- Click "Finalize & Merge Video" button
- Trigger fal.ai merge operation

### Phase 8: Wait for Final Completion (100%)
- Monitor database every 5 seconds
- Wait until `status = 'completed'` and `progress_percentage = 100`
- Timeout: 2 minutes
- Verify final video URL exists

## Database Monitoring

The skill uses Supabase MCP to track:

- **Project Status**: `competitor_ugc_replication_projects`
  - `status`: pending → processing → segment_frames_ready → awaiting_merge → completed
  - `progress_percentage`: 0 → 35 → 70 → 100
  - `current_step`: Various step identifiers

- **Segment Status**: `competitor_ugc_replication_segments`
  - `first_frame_url`: Frame generation completion
  - `video_url`: Video generation completion
  - `status`: awaiting_prev_first_frame → generating_first_frame → first_frame_ready → generating_video → video_ready

## Browser Automation

The skill uses Playwright MCP for:

- **Navigation**: Load clone video page
- **Snapshots**: Capture page state for element detection
- **Clicks**: Select videos, buttons, segments
- **Waiting**: Smart waits between actions

## Expected Results

### Success Criteria
- ✅ All frames generated successfully (2 frames for 16s video)
- ✅ All videos generated successfully (2 videos)
- ✅ Final merge completed
- ✅ Project status = 'completed'
- ✅ Progress = 100%
- ✅ Valid merged video URL returned

### Typical Execution Time
- **Frame Generation**: 1-2 minutes (30-60s per frame)
- **Video Generation**: 3-6 minutes (60-180s per segment)
- **Merge**: 10-30 seconds
- **Total**: ~5-10 minutes for 16s video (2 segments)

### Credits Cost
- 16s video = 2 segments × 20 credits (veo3_fast) = **40 credits**

## Error Handling

The skill will fail and report errors if:

- ❌ No suitable competitor videos found (~16s)
- ❌ Project creation fails
- ❌ Frame generation timeout (>5 min)
- ❌ Video generation timeout (>15 min)
- ❌ Merge timeout (>2 min)
- ❌ Database status = 'failed'
- ❌ Final video URL not found

## Debugging

Check the console output for detailed phase-by-phase progress:

```
🚀 Starting Clone Video E2E Test...
📝 Test User: user_37ky51qtKUnhQtRTzDdJ5rPH9G8
🌐 Base URL: http://localhost:3000

📍 Phase 1: Browser Setup and Login
  → Opening browser...
  → Taking snapshot...
  ✓ Page loaded successfully

📍 Phase 2: Select Competitor Video
  → Querying competitor videos (~16s)...
  ✓ Found video: Example Video (16s)
  → Selecting video in UI...
  ✓ Video selected

[... continues through all phases ...]

✅ ========================================
✅ CLONE VIDEO TEST PASSED!
✅ ========================================
📹 Final Video URL: https://...
🆔 Project ID: xxx-xxx-xxx
```

## Known Limitations

1. **Test User**: Hardcoded to user_37ky51qtKUnhQtRTzDdJ5rPH9G8
2. **Video Duration**: Targets ~16s (2 segments) - adjust TARGET_DURATION constant for other durations
3. **Video Model**: Hardcoded to veo3_fast - modify config in startGeneration()
4. **No Cleanup**: Test projects remain in database - manually delete if needed
5. **Single Browser Tab**: Doesn't test concurrent operations

## Future Enhancements

- [ ] Parameterized test user ID
- [ ] Configurable video duration (8s, 16s, 32s, 64s)
- [ ] Test different video models (veo3 vs veo3_fast)
- [ ] Automatic cleanup after test completion
- [ ] Screenshot capture on failure
- [ ] Performance metrics tracking
- [ ] Parallel test execution
- [ ] Test with single-segment videos (8s, no merge)
- [ ] Test error handling scenarios (API failures, webhook issues)

## Related Files

- **Workflow**: `lib/competitor-ugc-replication-workflow.ts`
- **UI Components**: `components/pages/CompetitorUgcReplicationPage.tsx`
- **API Routes**: `app/api/competitor-ugc-replication/`
- **Webhooks**: `app/api/competitor-ugc-replication/webhooks/`
- **Database Schema**: Check CLAUDE.md for table structures
