import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkCredits, deductCredits, recordCreditTransaction, refundCredits } from '@/lib/credits';
import { pollKie1080pVideo, requestKie1080pVideo, requestKie4kVideo } from '@/lib/kie-video-upgrades';
import { mergeVideosWithFal } from '@/lib/video-merge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Resolution = '1080p' | '4k';
type AdType = 'competitor-ugc-replication' | 'character';

const RESOLUTION_COSTS: Record<Resolution, number> = {
  '1080p': 5,
  '4k': 40
};

const SEGMENT_FIELDS = {
  '1080p': {
    taskId: 'video_1080p_task_id',
    url: 'video_1080p_url',
    webhook: 'video_1080p_webhook_received_at'
  },
  '4k': {
    taskId: 'video_4k_task_id',
    url: 'video_4k_url',
    webhook: 'video_4k_webhook_received_at'
  }
} as const;

const PROJECT_FIELDS = {
  '1080p': {
    mergedUrl: 'merged_video_1080p_url',
    mergeTaskId: 'fal_merge_1080p_task_id'
  },
  '4k': {
    mergedUrl: 'merged_video_4k_url',
    mergeTaskId: 'fal_merge_4k_task_id'
  }
} as const;

interface HighResRequestBody {
  historyId?: string;
  resolution?: Resolution;
  adType?: AdType;
}

const isResolution = (value?: string): value is Resolution => value === '1080p' || value === '4k';
const isAdType = (value?: string): value is AdType => value === 'competitor-ugc-replication' || value === 'character';

const buildCallbackUrl = (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is not configured');
  }
  return new URL(path, baseUrl).toString();
};

const triggerHighResWebhook = async (path: string, taskId: string, resultUrl: string) => {
  try {
    await fetch(buildCallbackUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          taskId,
          resultUrl
        }
      })
    });
  } catch (error) {
    console.error('[High Res Upgrade] Failed to trigger webhook:', error);
  }
};

const poll1080pAndNotify = async (taskId: string, callbackPath: string) => {
  const resultUrl = await pollKie1080pVideo(taskId);
  if (!resultUrl) return;
  await triggerHighResWebhook(callbackPath, taskId, resultUrl);
};

const resolutionLabel = (resolution: Resolution) => (resolution === '1080p' ? '1080p' : '4K');

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as HighResRequestBody;
    const historyId = body.historyId;
    const resolution = body.resolution;
    const adType = body.adType;

    if (!historyId || !isResolution(resolution) || !isAdType(adType)) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const segmentFields = SEGMENT_FIELDS[resolution];
    const projectFields = PROJECT_FIELDS[resolution];
    const perSegmentCost = RESOLUTION_COSTS[resolution];

    if (adType === 'competitor-ugc-replication') {
      // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_projects columns include
      // id, user_id, status, video_url, video_aspect_ratio, segment_count, is_segmented,
      // merged_video_1080p_url, merged_video_4k_url, fal_merge_1080p_task_id, fal_merge_4k_task_id.
      const { data: project, error: projectError } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id, user_id, status, video_url, video_aspect_ratio, segment_count, is_segmented, merged_video_1080p_url, merged_video_4k_url, fal_merge_1080p_task_id, fal_merge_4k_task_id')
        .eq('id', historyId)
        .eq('user_id', userId)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (project.status !== 'completed' || !project.video_url) {
        return NextResponse.json({ error: 'Video not ready for download' }, { status: 400 });
      }

      // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_segments columns include
      // id, project_id, segment_index, video_task_id, video_url, video_1080p_task_id, video_1080p_url,
      // video_1080p_webhook_received_at, video_4k_task_id, video_4k_url, video_4k_webhook_received_at.
      const { data: segments, error: segmentsError } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('id, segment_index, video_task_id, video_url, video_1080p_task_id, video_1080p_url, video_4k_task_id, video_4k_url')
        .eq('project_id', historyId)
        .order('segment_index', { ascending: true });

      if (segmentsError || !segments || segments.length === 0) {
        return NextResponse.json({ error: 'Segments not found' }, { status: 404 });
      }

      const mergedUrl = (project as Record<string, string | null>)[projectFields.mergedUrl] || null;
      const existingRequest = segments.some(segment => Boolean((segment as Record<string, string | null>)[segmentFields.taskId]) || Boolean((segment as Record<string, string | null>)[segmentFields.url]));

      if (mergedUrl) {
        return NextResponse.json({
          status: 'ready',
          downloadEndpoint: '/api/my-ads/high-res-download',
          message: `${resolutionLabel(resolution)} video is ready`
        });
      }

      let creditsCharged = 0;
      const totalSegments = segments.length;
      const totalCost = totalSegments * perSegmentCost;

      if (!existingRequest) {
        const creditsCheck = await checkCredits(userId, totalCost);
        if (!creditsCheck.success) {
          return NextResponse.json({ error: creditsCheck.error || 'Failed to check credits' }, { status: 500 });
        }
        if (!creditsCheck.hasEnoughCredits) {
          return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${creditsCheck.currentCredits}` }, { status: 402 });
        }

        const deduction = await deductCredits(userId, totalCost);
        if (!deduction.success) {
          return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
        }

        await recordCreditTransaction(
          userId,
          'usage',
          totalCost,
          `${resolutionLabel(resolution)} download upgrade`,
          historyId,
          true
        );
        creditsCharged = totalCost;
      }

      const callbackPath = resolution === '1080p'
        ? '/api/competitor-ugc-replication/webhooks/1080p'
        : '/api/competitor-ugc-replication/webhooks/4k';

      let startedTasks = 0;

      try {
        for (const segment of segments) {
          const segmentUrl = (segment as Record<string, string | null>)[segmentFields.url];

          if (segmentUrl) {
            continue;
          }

          if (!segment.video_task_id) {
            continue;
          }

          const { taskId, resultUrl } = resolution === '1080p'
            ? await requestKie1080pVideo(segment.video_task_id, buildCallbackUrl(callbackPath))
            : await requestKie4kVideo(segment.video_task_id, buildCallbackUrl(callbackPath));

          const updates: Record<string, string | null> = {
            [segmentFields.taskId]: taskId
          };

          if (resolution === '1080p' && !resultUrl) {
            const polledUrl = await pollKie1080pVideo(taskId, { attempts: 4, delayMs: 4000 });
            if (polledUrl) {
              updates[segmentFields.url] = polledUrl;
              updates[segmentFields.webhook] = new Date().toISOString();
            }
          } else if (resultUrl) {
            updates[segmentFields.url] = resultUrl;
            updates[segmentFields.webhook] = new Date().toISOString();
          }

          const { error: updateError } = await supabase
            .from('competitor_ugc_replication_segments')
            .update(updates)
            .eq('id', segment.id);

          if (updateError) {
            throw new Error('Failed to update segment');
          }

          if (resolution === '1080p' && !updates[segmentFields.url]) {
            void poll1080pAndNotify(taskId, callbackPath);
          }

          startedTasks += 1;
        }
      } catch (error) {
        if (!existingRequest && creditsCharged > 0 && startedTasks === 0) {
          await refundCredits(userId, creditsCharged, `${resolutionLabel(resolution)} download upgrade failed`, historyId);
        }
        throw error;
      }

      const { data: refreshedSegments } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('id, segment_index, video_1080p_url, video_4k_url')
        .eq('project_id', historyId)
        .order('segment_index', { ascending: true });

      const segmentsForMerge = refreshedSegments || segments;
      const allReady = segmentsForMerge.every(segment => Boolean((segment as Record<string, string | null>)[segmentFields.url]));

      if (allReady) {
        const segmentUrls = segmentsForMerge
          .map(segment => (segment as Record<string, string | null>)[segmentFields.url])
          .filter((url): url is string => Boolean(url));

        if (segmentUrls.length === 1) {
          const { error: updateProjectError } = await supabase
            .from('competitor_ugc_replication_projects')
            .update({
              [projectFields.mergedUrl]: segmentUrls[0]
            })
            .eq('id', historyId);

          if (!updateProjectError) {
            return NextResponse.json({
              status: 'ready',
              downloadEndpoint: '/api/my-ads/high-res-download',
              message: `${resolutionLabel(resolution)} video is ready`
            });
          }
        }

        const mergeTaskId = (project as Record<string, string | null>)[projectFields.mergeTaskId];
        if (!mergeTaskId && segmentUrls.length > 1) {
          const { taskId: falTaskId } = await mergeVideosWithFal(segmentUrls, project.video_aspect_ratio || '16:9', '/api/competitor-ugc-replication/webhooks/merge');
          await supabase
            .from('competitor_ugc_replication_projects')
            .update({
              [projectFields.mergeTaskId]: falTaskId
            })
            .eq('id', historyId);
        }
      }

      return NextResponse.json({
        status: 'processing',
        creditsCharged,
        message: `${resolutionLabel(resolution)} upgrade started. Check back soon.`
      });
    }

    // Avatar Ads
    // Schema verified via Supabase MCP (2026-01-25): avatar_ads_projects columns include
    // id, user_id, status, video_aspect_ratio, merged_video_url,
    // merged_video_1080p_url, merged_video_4k_url, fal_merge_1080p_task_id, fal_merge_4k_task_id.
    const { data: project, error: projectError } = await supabase
      .from('avatar_ads_projects')
      .select('id, user_id, status, video_aspect_ratio, merged_video_url, merged_video_1080p_url, merged_video_4k_url, fal_merge_1080p_task_id, fal_merge_4k_task_id')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'completed') {
      return NextResponse.json({ error: 'Video not ready for download' }, { status: 400 });
    }

    // Schema verified via Supabase MCP (2026-01-25): avatar_ads_scenes columns include
    // id, project_id, scene_number, kie_video_task_id, video_url, video_1080p_task_id, video_1080p_url,
    // video_1080p_webhook_received_at, video_4k_task_id, video_4k_url, video_4k_webhook_received_at.
    const { data: scenes, error: scenesError } = await supabase
      .from('avatar_ads_scenes')
      .select('id, scene_number, kie_video_task_id, video_url, video_1080p_task_id, video_1080p_url, video_4k_task_id, video_4k_url')
      .eq('project_id', historyId)
      .order('scene_number', { ascending: true });

    if (scenesError || !scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes not found' }, { status: 404 });
    }

    const mergedUrl = (project as Record<string, string | null>)[projectFields.mergedUrl] || null;
      const existingRequest = scenes.some(scene => Boolean((scene as Record<string, string | null>)[segmentFields.taskId]) || Boolean((scene as Record<string, string | null>)[segmentFields.url]));

    if (mergedUrl) {
      return NextResponse.json({
        status: 'ready',
        downloadEndpoint: '/api/my-ads/high-res-download',
        message: `${resolutionLabel(resolution)} video is ready`
      });
    }

    let creditsCharged = 0;
    const totalScenes = scenes.length;
    const totalCost = totalScenes * perSegmentCost;

    if (!existingRequest) {
      const creditsCheck = await checkCredits(userId, totalCost);
      if (!creditsCheck.success) {
        return NextResponse.json({ error: creditsCheck.error || 'Failed to check credits' }, { status: 500 });
      }
      if (!creditsCheck.hasEnoughCredits) {
        return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${creditsCheck.currentCredits}` }, { status: 402 });
      }

      const deduction = await deductCredits(userId, totalCost);
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
      }

      await recordCreditTransaction(
        userId,
        'usage',
        totalCost,
        `${resolutionLabel(resolution)} download upgrade`,
        historyId,
        true
      );
      creditsCharged = totalCost;
    }

    const callbackPath = resolution === '1080p'
      ? '/api/avatar-ads/webhooks/1080p'
      : '/api/avatar-ads/webhooks/4k';

    let startedTasks = 0;

    try {
      for (const scene of scenes) {
        const sceneUrl = (scene as Record<string, string | null>)[segmentFields.url];

        if (sceneUrl) {
          continue;
        }

        if (!scene.kie_video_task_id) {
          continue;
        }

        const { taskId, resultUrl } = resolution === '1080p'
          ? await requestKie1080pVideo(scene.kie_video_task_id, buildCallbackUrl(callbackPath))
          : await requestKie4kVideo(scene.kie_video_task_id, buildCallbackUrl(callbackPath));

        const updates: Record<string, string | null> = {
          [segmentFields.taskId]: taskId
        };

        if (resolution === '1080p' && !resultUrl) {
          const polledUrl = await pollKie1080pVideo(taskId, { attempts: 4, delayMs: 4000 });
          if (polledUrl) {
            updates[segmentFields.url] = polledUrl;
            updates[segmentFields.webhook] = new Date().toISOString();
          }
        } else if (resultUrl) {
          updates[segmentFields.url] = resultUrl;
          updates[segmentFields.webhook] = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('avatar_ads_scenes')
          .update(updates)
          .eq('id', scene.id);

        if (updateError) {
          throw new Error('Failed to update scene');
        }

        if (resolution === '1080p' && !updates[segmentFields.url]) {
          void poll1080pAndNotify(taskId, callbackPath);
        }

        startedTasks += 1;
      }
    } catch (error) {
      if (!existingRequest && creditsCharged > 0 && startedTasks === 0) {
        await refundCredits(userId, creditsCharged, `${resolutionLabel(resolution)} download upgrade failed`, historyId);
      }
      throw error;
    }

    const { data: refreshedScenes } = await supabase
      .from('avatar_ads_scenes')
      .select('id, scene_number, video_1080p_url, video_4k_url')
      .eq('project_id', historyId)
      .order('scene_number', { ascending: true });

    const scenesForMerge = refreshedScenes || scenes;
    const allReady = scenesForMerge.every(scene => Boolean((scene as Record<string, string | null>)[segmentFields.url]));

    if (allReady) {
      const sceneUrls = scenesForMerge
        .map(scene => (scene as Record<string, string | null>)[segmentFields.url])
        .filter((url): url is string => Boolean(url));

      if (sceneUrls.length === 1) {
        const { error: updateProjectError } = await supabase
          .from('avatar_ads_projects')
          .update({
            [projectFields.mergedUrl]: sceneUrls[0]
          })
          .eq('id', historyId);

        if (!updateProjectError) {
          return NextResponse.json({
            status: 'ready',
            downloadEndpoint: '/api/my-ads/high-res-download',
            message: `${resolutionLabel(resolution)} video is ready`
          });
        }
      }

      const mergeTaskId = (project as Record<string, string | null>)[projectFields.mergeTaskId];
      if (!mergeTaskId && sceneUrls.length > 1) {
        const { taskId: falTaskId } = await mergeVideosWithFal(sceneUrls, project.video_aspect_ratio || '16:9', '/api/avatar-ads/webhooks/merge');
        await supabase
          .from('avatar_ads_projects')
          .update({
            [projectFields.mergeTaskId]: falTaskId
          })
          .eq('id', historyId);
      }
    }

    return NextResponse.json({
      status: 'processing',
      creditsCharged,
      message: `${resolutionLabel(resolution)} upgrade started. Check back soon.`
    });
  } catch (error) {
    console.error('[High Res Upgrade] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
