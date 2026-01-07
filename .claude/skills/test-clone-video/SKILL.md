---
name: test-clone-video
description: Automated E2E test for the Competitor UGC Replication (clone) feature. Use when testing the clone video workflow, verifying the complete user journey from video selection through frame generation, video generation, and final merge. Triggers on "test clone video", "e2e test clone", or "test competitor ugc".
allowed-tools: mcp__supabase__execute_sql, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_wait_for, Bash
---

# Clone Video E2E Test

This Skill guides you through testing the complete Competitor UGC Replication (clone) workflow end-to-end.

## Test Configuration

**Test User**: `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
**Base URL**: `http://localhost:3000` (or `NEXT_PUBLIC_SITE_URL` if set)
**Target Duration**: 16 seconds (2 segments)
**Video Model**: `veo3_fast` (20 credits per 8s segment = 40 credits total)

## Test Flow Overview

1. Navigate to clone video page and authenticate
2. Select a ~16s competitor video from database
3. Configure settings and start generation
4. Wait for frame generation (35% progress)
5. Review frames and trigger video generation
6. Wait for video generation (70-90% progress)
7. Merge all segments
8. Verify 100% completion with valid video URL

## Step-by-Step Instructions

### Phase 1: Browser Setup and Login

Navigate to the clone video page:

```
Use mcp__playwright__browser_navigate to open:
http://localhost:3000/dashboard/competitor-ugc-replication
```

Take a snapshot to verify page loaded:

```
Use mcp__playwright__browser_snapshot
```

Clerk authentication should happen automatically for the test user.

### Phase 2: Select Competitor Video

Query Supabase for a suitable competitor video (~16s):

```sql
SELECT id, video_duration, title
FROM competitor_ads
WHERE video_duration BETWEEN 14 AND 18
  AND video_file_url IS NOT NULL
ORDER BY RANDOM()
LIMIT 1;
```

If no videos found, report error: "No suitable competitor videos found (~16s)"

Once you have a video ID, take a snapshot to see available video cards, then click the selected video card in the UI.

### Phase 3: Configure Settings and Start Generation

Configure the generation settings by:

1. Selecting video model: `veo3_fast`
2. Setting duration: `16` seconds
3. Setting language: English

Click the "Generate Video" button to start generation.

Wait 2 seconds for project creation, then query the latest project:

```sql
SELECT id
FROM competitor_ugc_replication_projects
WHERE user_id = 'user_37ky51qtKUnhQtRTzDdJ5rPH9G8'
ORDER BY created_at DESC
LIMIT 1;
```

Store the project ID for subsequent monitoring.

### Phase 4: Wait for Frame Generation (35% Progress)

Monitor the database every 5 seconds with this query:

```sql
SELECT
  status,
  progress_percentage,
  current_step,
  segment_count,
  (SELECT COUNT(*) FROM competitor_ugc_replication_segments
   WHERE project_id = '{projectId}' AND first_frame_url IS NOT NULL) as frames_ready
FROM competitor_ugc_replication_projects
WHERE id = '{projectId}';
```

**Success Criteria**:
- `status = 'segment_frames_ready'` OR
- `frames_ready = segment_count` (both frames generated)

**Failure Criteria**:
- `status = 'failed'` → Report error and exit
- Timeout after 5 minutes → Report "Frame generation timeout"

Log progress updates: "Progress: X% | Status: Y | Frames: N/M"

### Phase 5: Review Frames and Trigger Video Generation

Once frames are ready:

1. Take a snapshot to locate the "Edit & Review Frames" button
2. Click "Edit & Review Frames" to open the segment editor
3. Wait 2 seconds for the editor to open

Query segment count:

```sql
SELECT COUNT(*) as count
FROM competitor_ugc_replication_segments
WHERE project_id = '{projectId}';
```

For each segment (index 0 to count-1):
1. Click on the segment in the list (use `[data-segment-index="{i}"]`)
2. Click the "Generate Video" button for that segment
3. Wait 1 second before moving to next segment

Log: "Triggered video generation for X segments"

### Phase 6: Wait for Video Generation (70-90% Progress)

Monitor the database every 10 seconds:

```sql
SELECT
  status,
  progress_percentage,
  segment_count,
  (SELECT COUNT(*) FROM competitor_ugc_replication_segments
   WHERE project_id = '{projectId}' AND video_url IS NOT NULL) as videos_ready,
  awaiting_merge
FROM competitor_ugc_replication_projects
WHERE id = '{projectId}';
```

**Success Criteria**:
- `awaiting_merge = true` AND
- `videos_ready = segment_count`

**Failure Criteria**:
- `status = 'failed'` → Report error and exit
- Timeout after 15 minutes → Report "Video generation timeout"

Log progress: "Progress: X% | Videos: N/M | Awaiting Merge: true/false"

### Phase 7: Merge Videos

Once all videos are ready:

1. Take a snapshot to locate the "Finalize & Merge Video" button
2. Click "Finalize & Merge Video"
3. Log: "Merge triggered"

### Phase 8: Wait for Final Completion (100%)

Monitor the database every 5 seconds:

```sql
SELECT
  status,
  progress_percentage,
  video_url
FROM competitor_ugc_replication_projects
WHERE id = '{projectId}';
```

**Success Criteria**:
- `status = 'completed'` AND
- `progress_percentage = 100` AND
- `video_url` is not null

**Failure Criteria**:
- `status = 'failed'` → Report error and exit
- Timeout after 2 minutes → Report "Merge timeout"
- Completed but no video URL → Report "Project complete but no video URL found"

## Final Report

When test completes successfully, report:

```
✅ CLONE VIDEO TEST PASSED!
📹 Final Video URL: {video_url}
🆔 Project ID: {projectId}
⏱️ Total Time: {duration}
💰 Credits Used: 40 (2 segments × 20 credits)
```

When test fails, report:

```
❌ CLONE VIDEO TEST FAILED!
Phase: {phase_name}
Error: {error_message}
🆔 Project ID: {projectId} (if created)
```

## Expected Timings

- **Frame Generation**: 1-2 minutes (30-60s per frame)
- **Video Generation**: 3-6 minutes (60-180s per segment)
- **Merge**: 10-30 seconds
- **Total**: ~5-10 minutes for 16s video (2 segments)

## Database Status Reference

**Project Status Flow**:
- `pending` → Initial state
- `processing` → Generation in progress
- `segment_frames_ready` → All frames generated (35%)
- `awaiting_merge` → All videos generated (70-90%)
- `completed` → Final video ready (100%)
- `failed` → Error occurred

**Segment Status Flow**:
- `awaiting_prev_first_frame` → Waiting for continuation frame
- `generating_first_frame` → Frame generation in progress
- `first_frame_ready` → Frame complete
- `generating_video` → Video generation in progress
- `video_ready` → Video complete

## Error Scenarios

If you encounter these errors, report them clearly:

1. **No suitable videos**: No competitor videos found in 14-18s range
2. **Project creation failed**: No project found after clicking Generate
3. **Frame generation failed**: Status = failed or timeout > 5 min
4. **Video generation failed**: Status = failed or timeout > 15 min
5. **Merge failed**: Status = failed or timeout > 2 min
6. **Missing video URL**: Completed but no final video URL

## Additional Resources

For detailed background and architecture, see [test-plan.md](test-plan.md).

## Known Limitations

- Test user hardcoded to `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
- Target duration fixed at 16s (2 segments)
- Video model fixed to `veo3_fast`
- No automatic cleanup (test projects remain in database)
- Single browser tab only
