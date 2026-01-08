---
name: test-clone-video
description: Automated E2E test for the Competitor UGC Replication (clone) feature. Use when testing the clone video workflow, verifying the complete user journey from video selection through frame generation, video generation, and final merge. Triggers on "test clone video", "e2e test clone", or "test competitor ugc".
allowed-tools: mcp__supabase__execute_sql, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_wait_for, Bash(sleep:*)
---

# Clone Video E2E Test

This Skill automates end-to-end testing of the Competitor UGC Replication (clone) feature. It supports two scenarios:

1. **Normal Testing**: Standard post-upgrade testing with 16s videos (2 segments)
2. **User Issue Reproduction**: Reproduce specific user bugs with custom parameters

## Test Configuration

**Default Settings**:
- Test User: `user_37ky51qtKUnhQtRTzDdJ5rPH9G8`
- Base URL: `http://localhost:3000`
- Default Duration: 16 seconds (2 segments)
- Video Model: `veo3_fast` (20 credits per 8s segment = 40 credits)

## Scenario 1: Normal Testing (Default)

Use this for standard feature validation after upgrades or changes.

### Quick Start

When the user says "test clone video" without specific parameters:

1. Navigate to `http://localhost:3000/dashboard/competitor-ugc-replication`
2. Query for a ~16s competitor video:
   ```sql
   SELECT id, video_duration_seconds, competitor_name
   FROM competitor_ads
   WHERE user_id = 'user_37ky51qtKUnhQtRTzDdJ5rPH9G8'
     AND video_duration_seconds BETWEEN 14 AND 18
     AND analysis_status = 'completed'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. If no video found, report: "No suitable test videos found. Please upload a 14-18s competitor video first."
4. Select video in UI, configure settings (veo3_fast, 16s, English)
5. Click "Generate Video"
6. Monitor frame generation (35% progress)
7. Review frames and trigger video generation (70-90% progress)
8. Merge videos and verify completion (100%)

### Expected Timings
- Frame generation: 1-2 minutes total
- Video generation: 3-6 minutes total
- Merge: 10-30 seconds
- **Total: ~5-10 minutes**

## Scenario 2: User Issue Reproduction

Use this when a specific user encounters errors. The user will provide:
- User ID
- Project ID or competitor ad ID
- Specific parameters (duration, video model, etc.)

### When to Use

Triggers when the user provides specific context:
- "Test with user X's settings"
- "Reproduce the bug for project Y"
- "Test with the problematic video from user Z"

### Custom Testing Steps

1. **Gather Context**: User provides:
   - User ID (e.g., `user_37t3Ly2J8jWWNUWS1RaTBvGtSaD`)
   - Competitor ad ID or project ID
   - Specific settings (duration, model, language)

2. **Clone Competitor Ad** (if needed):
   ```sql
   -- Copy competitor ad to test account
   INSERT INTO competitor_ads (
     user_id,
     competitor_name,
     analysis_result,
     analysis_status,
     language,
     video_duration_seconds,
     created_at
   )
   SELECT
     'user_37ky51qtKUnhQtRTzDdJ5rPH9G8', -- Test user
     competitor_name || ' (test copy)',
     analysis_result,
     analysis_status,
     language,
     video_duration_seconds,
     NOW()
   FROM competitor_ads
   WHERE id = '[ORIGINAL_COMPETITOR_AD_ID]'
   RETURNING id;
   ```

3. **Configure Test**: Use exact parameters from user's scenario
   - Video model: User's choice (veo3/veo3_fast)
   - Duration: User's chosen duration
   - Language: User's language
   - Brand: Create test brand if needed

4. **Run Test**: Follow same monitoring flow as normal testing

5. **Compare Results**: Check if bug reproduces with test account

## Test Flow (Both Scenarios)

### Phase 1: Setup and Navigation

Navigate to clone video page:
```
Use mcp__playwright__browser_navigate to:
http://localhost:3000/dashboard/competitor-ugc-replication
```

Take snapshot to verify page loaded:
```
Use mcp__playwright__browser_snapshot
```

### Phase 2: Select Video and Configure

1. Click selected video card in UI
2. Configure settings:
   - Video model: `veo3_fast` (or user-specified)
   - Duration: `16` (or user-specified)
   - Language: English (or user-specified)
3. Click "Generate Video"

Wait 2 seconds, then get project ID:
```sql
SELECT id, status, segment_count, video_duration
FROM competitor_ugc_replication_projects
WHERE user_id = 'user_37ky51qtKUnhQtRTzDdJ5rPH9G8'
ORDER BY created_at DESC
LIMIT 1;
```

### Phase 3: Monitor Frame Generation (35%)

Poll every 5 seconds:
```sql
SELECT
  status,
  progress_percentage,
  current_step,
  segment_count,
  (SELECT COUNT(*) FROM competitor_ugc_replication_segments
   WHERE project_id = '[PROJECT_ID]' AND first_frame_url IS NOT NULL) as frames_ready
FROM competitor_ugc_replication_projects
WHERE id = '[PROJECT_ID]';
```

**Success**: `status = 'segment_frames_ready'` OR `frames_ready = segment_count`
**Failure**: `status = 'failed'` OR timeout > 5 minutes

Log: "Progress: X% | Status: Y | Frames: N/M"

### Phase 4: Review Frames and Trigger Videos

1. Take snapshot to locate "Edit & Review Frames" button
2. Click button to open segment editor
3. For each segment (0 to count-1):
   - Click segment `[data-segment-index="{i}"]`
   - Click "Generate Video" button
   - Wait 1 second

Log: "Triggered video generation for X segments"

### Phase 5: Monitor Video Generation (70-90%)

Poll every 10 seconds:
```sql
SELECT
  status,
  progress_percentage,
  segment_count,
  (SELECT COUNT(*) FROM competitor_ugc_replication_segments
   WHERE project_id = '[PROJECT_ID]' AND video_url IS NOT NULL) as videos_ready,
  awaiting_merge
FROM competitor_ugc_replication_projects
WHERE id = '[PROJECT_ID]';
```

**Success**: `awaiting_merge = true` AND `videos_ready = segment_count`
**Failure**: `status = 'failed'` OR timeout > 15 minutes

Log: "Progress: X% | Videos: N/M | Awaiting Merge: {bool}"

### Phase 6: Merge Videos

1. Take snapshot to locate "Finalize & Merge Video" button
2. Click button
3. Log: "Merge triggered"

### Phase 7: Verify Completion (100%)

Poll every 5 seconds:
```sql
SELECT
  status,
  progress_percentage,
  video_url
FROM competitor_ugc_replication_projects
WHERE id = '[PROJECT_ID]';
```

**Success**: `status = 'completed'` AND `progress_percentage = 100` AND `video_url IS NOT NULL`
**Failure**: `status = 'failed'` OR timeout > 2 minutes

## Success Report

When test passes:
```
✅ CLONE VIDEO TEST PASSED!
📹 Final Video URL: {video_url}
🆔 Project ID: {projectId}
⏱️ Total Time: {duration}
💰 Credits Used: {credits}
```

## Failure Report

When test fails:
```
❌ CLONE VIDEO TEST FAILED!
Phase: {phase_name}
Error: {error_message}
🆔 Project ID: {projectId} (if created)
```

Check segment-level errors:
```sql
SELECT segment_index, status, error_message, retry_count
FROM competitor_ugc_replication_segments
WHERE project_id = '[PROJECT_ID]'
  AND status = 'failed'
ORDER BY segment_index;
```

## Common Error Scenarios

1. **No suitable videos**: No competitor videos found in target duration range
2. **Project creation failed**: No project found after clicking Generate
3. **Frame generation failed**: Status = failed or timeout
4. **Video generation failed**: Status = failed or timeout
5. **Merge failed**: Status = failed or timeout
6. **Missing video URL**: Completed but no final video URL

## Database Status Reference

**Project Status Flow**:
- `pending` → `processing` → `segment_frames_ready` (35%) → `awaiting_merge` (70-90%) → `completed` (100%)

**Segment Status Flow**:
- `awaiting_prev_first_frame` → `generating_first_frame` → `first_frame_ready` → `generating_video` → `video_ready`

## Notes

- Test user credentials are pre-configured (Clerk auto-login)
- Target duration is configurable (default: 16s)
- Video model is configurable (default: veo3_fast)
- No automatic cleanup - test projects remain in database
- Single browser tab only
- Always use exponential backoff for polling (not fixed intervals)
