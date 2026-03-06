import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import type { VideoModel } from '@/lib/constants';

interface CompetitorUgcReplicationItem {
  id: string;
  coverImageUrl?: string;
  videoUrl?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
  coverAspectRatio?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  imagePrompt?: string;
  videoModel: VideoModel;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'competitor-ugc-replication';
  videoAspectRatio?: string;
  // Segment information for cost calculation
  isSegmented?: boolean;
  segmentCount?: number;
  videoDuration?: string;
  language?: string;
  customScript?: string;
  useCustomScript?: boolean;
  videoPrompts?: any;
  errorMessage?: string;
}

interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
  coverAspectRatio?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: 'veo3' | 'veo3_fast' | 'sora2';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'character';
  videoDurationSeconds?: number;
  videoAspectRatio?: string;
  language?: string;
  customDialogue?: string;
  generatedPrompts?: any;
  errorMessage?: string;
}

interface MotionSwapItem {
  id: string;
  coverImageUrl?: string;
  videoUrl?: string;
  coverAspectRatio?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: VideoModel;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'motion-swap';
  videoAspectRatio?: string;
  videoDurationSeconds?: number;
  photoPrompt?: string;
  videoPrompt?: string;
  errorMessage?: string;
}

type HistoryItem = CompetitorUgcReplicationItem | CharacterAdsItem | MotionSwapItem;

type SupportedAspectRatio = '16:9' | '9:16' | '1:1';

const normalizeAspectRatio = (ratio?: string | null): SupportedAspectRatio | undefined => {
  if (!ratio) return undefined;
  const normalized = ratio.toString().toLowerCase().replace(/\s+/g, '');

  if (normalized.includes('16:9') || normalized.includes('16x9') || normalized.includes('landscape')) {
    return '16:9';
  }

  if (normalized.includes('9:16') || normalized.includes('9x16') || normalized.includes('portrait')) {
    return '9:16';
  }

  if (normalized.includes('1:1') || normalized.includes('1x1') || normalized.includes('square')) {
    return '1:1';
  }

  return undefined;
};

const resolveVideoAspectRatio = (videoRatio?: string | null, fallbackRatio?: string | null): SupportedAspectRatio => {
  return normalizeAspectRatio(videoRatio) ?? normalizeAspectRatio(fallbackRatio) ?? '9:16';
};

const resolveCoverAspectRatio = (ratio?: string | null): SupportedAspectRatio | undefined => {
  return normalizeAspectRatio(ratio);
};

const ALLOWED_COMPETITOR_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'seedance_1_5_pro', 'kling_3'];
const LEGACY_MODELS = ['sora2', 'sora2_pro', 'grok', 'kling_2_6'];

const normalizeCompetitorVideoModel = (model?: string | null): VideoModel => {
  if (model === 'seedance-1.5-pro' || model === 'bytedance/seedance-1.5-pro') {
    return 'seedance_1_5_pro';
  }
  if (ALLOWED_COMPETITOR_VIDEO_MODELS.includes(model as VideoModel)) {
    return model as VideoModel;
  }
  return 'veo3_fast'; // Default for invalid/null models
};

const isLegacyModel = (model?: string | null): boolean => {
  return LEGACY_MODELS.includes(model as string);
};

export async function GET() {
  try {
    const { userId } = await auth();
    
    console.log('Current user ID:', userId);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const supabase = getSupabase();
    
    // Map workflow status to frontend status
    const mapWorkflowStatus = (workflowStatus: string): 'processing' | 'completed' | 'failed' => {
      switch (workflowStatus) {
        case 'completed':
          return 'completed';
        case 'failed':
        case 'error':
        case 'internal_error':
        case 'failed_internal':
        case 'failed_validation':
        case 'failed_merge':
        case 'timeout':
        case 'cancelled':
          return 'failed';
        case 'started':
        case 'in_progress':
        case 'pending':
        case 'processing':
        case 'generating_preview':
        case 'generating_video':
        case 'generating_videos':
        default:
          return 'processing';
      }
    };

    // Fetch Competitor UGC Replication data
    const { data: competitorUgcReplicationItems, error: competitorUgcReplicationError } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (competitorUgcReplicationError) {
      console.error('Failed to fetch Competitor UGC Replication history:', competitorUgcReplicationError);
    }

    // Fetch Avatar Ads data
    const { data: characterAdsItems, error: characterAdsError } = await supabase
      .from('avatar_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (characterAdsError) {
      console.error('Failed to fetch Avatar Ads history:', characterAdsError);
    }

    // Fetch Motion Swap data
    // Schema verified via Supabase MCP (2026-01-23): motion_swap_projects columns include
    // id, user_id, status, preview_image_url, reference_cover_url, output_video_url,
    // credits_cost, generation_credits_used, downloaded, progress_percentage,
    // reference_duration_seconds, photo_prompt, video_prompt, error_message, created_at
    const { data: motionSwapItems, error: motionSwapError } = await supabase
      .from('motion_swap_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (motionSwapError) {
      console.error('Failed to fetch Motion Swap history:', motionSwapError);
    }

    // Transform Competitor UGC Replication data
    const transformedCompetitorUgcReplicationHistory: CompetitorUgcReplicationItem[] = (competitorUgcReplicationItems || []).map(item => {
      const videoModel = normalizeCompetitorVideoModel(item.video_model);
      const isLegacy = isLegacyModel(item.video_model);

      // Parse segment_status to extract cover image from segment[0]
      let parsedSegmentStatus: any = null;
      if (item.segment_status) {
        parsedSegmentStatus = typeof item.segment_status === 'string'
          ? JSON.parse(item.segment_status)
          : item.segment_status;
      }

      return {
        id: item.id,
        coverImageUrl: parsedSegmentStatus?.segments?.[0]?.firstFrameUrl || null,
        videoUrl: item.video_url,
        videoUrl1080p: item.merged_video_1080p_url || undefined,
        videoUrl4k: item.merged_video_4k_url || undefined,
        photoOnly: !!item.photo_only,
        downloaded: item.downloaded,
        downloadCreditsUsed: item.download_credits_used,
        generationCreditsUsed: item.generation_credits_used || 0,
        imagePrompt: item.image_prompt,
        coverAspectRatio: resolveCoverAspectRatio(item.cover_image_aspect_ratio),
        videoModel: isLegacy ? `${item.video_model} (Legacy)` as VideoModel : videoModel,
        creditsUsed: item.generation_credits_used || 0,
        status: mapWorkflowStatus(item.status),
        createdAt: item.created_at,
        progress: item.progress_percentage,
        currentStep: item.current_step,
        adType: 'competitor-ugc-replication',
        videoAspectRatio: resolveVideoAspectRatio(item.video_aspect_ratio, item.cover_image_aspect_ratio),
        // Segment information for accurate cost calculation
        isSegmented: item.is_segmented || false,
        segmentCount: item.segment_count || undefined,
        videoDuration: item.video_duration || undefined,
        language: item.language || undefined,
        customScript: item.custom_script || undefined,
        useCustomScript: item.use_custom_script || false,
        videoPrompts: item.video_prompts || undefined,
        errorMessage: item.error_message || undefined
      };
    });

    // Transform Avatar Ads data - show all items (processing, completed, and failed)
    const transformedCharacterAdsHistory: CharacterAdsItem[] = (characterAdsItems || [])
      .map(item => {
        let mappedStatus = mapWorkflowStatus(item.status);
        // If backend recorded an error message and not completed, treat as failed for immediate UI feedback
        if (item.error_message && mappedStatus !== 'completed') {
          mappedStatus = 'failed';
        }
        const storedVideoModel = item.video_model as 'veo3' | 'veo3_fast' | 'sora2';
        const resolvedVideoModel = item.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;

        // For completed items, ensure we have the correct video URL
        let videoUrl: string | undefined;
        if (mappedStatus === 'completed') {
          // Prefer single generated video when only one scene is expected (8s for VEO*, 10s for Sora2)
          const unitSeconds = resolvedVideoModel === 'sora2' ? 10 : 8;
          const totalScenes = (item.video_duration_seconds || 8) / unitSeconds;
          if (totalScenes === 1) {
            videoUrl = item.merged_video_url || (item.generated_video_urls?.[0]);
          } else {
            videoUrl = item.merged_video_url;
          }
        }

        return {
          id: item.id,
          originalImageUrl: item.person_image_urls?.[0], // Use first person image as thumbnail
          coverImageUrl: item.generated_image_url, // Map generated image to cover for preview
          coverAspectRatio: resolveCoverAspectRatio(item.cover_image_aspect_ratio),
          videoUrl, // Show video only for completed items
          videoUrl1080p: item.merged_video_1080p_url || undefined,
          videoUrl4k: item.merged_video_4k_url || undefined,
          downloaded: item.downloaded || false,
          downloadCreditsUsed: item.download_credits_used || 0,
          generationCreditsUsed: 0, // Generation is free, credits only used on download
          videoModel: resolvedVideoModel,
          creditsUsed: item.credits_cost || 0,
          status: mappedStatus,
          createdAt: item.created_at,
          progress: item.progress_percentage,
          currentStep: item.current_step,
          adType: 'character',
          videoDurationSeconds: item.video_duration_seconds,
          videoAspectRatio: resolveVideoAspectRatio(item.video_aspect_ratio, item.cover_image_aspect_ratio),
          language: item.language || undefined,
          customDialogue: item.custom_dialogue || undefined,
          generatedPrompts: item.generated_prompts || undefined,
          errorMessage: item.error_message || undefined
        };
      });

    const transformedMotionSwapHistory: MotionSwapItem[] = (motionSwapItems || []).map(item => {
      const mappedStatus = mapWorkflowStatus(item.status);
      const videoUrl = mappedStatus === 'completed' ? item.output_video_url : undefined;

      return {
        id: item.id,
        coverImageUrl: item.preview_image_url || item.reference_cover_url || undefined,
        coverAspectRatio: resolveCoverAspectRatio('9:16'),
        videoUrl,
        downloaded: item.downloaded || false,
        downloadCreditsUsed: 0,
        generationCreditsUsed: item.generation_credits_used || 0,
        videoModel: 'veo3_fast',
        creditsUsed: item.credits_cost || 0,
        status: mappedStatus,
        createdAt: item.created_at,
        progress: item.progress_percentage,
        currentStep: item.status,
        adType: 'motion-swap',
        videoAspectRatio: resolveVideoAspectRatio('9:16', '9:16'),
        videoDurationSeconds: item.reference_duration_seconds || undefined,
        photoPrompt: item.photo_prompt || undefined,
        videoPrompt: item.video_prompt || undefined,
        errorMessage: item.error_message || undefined
      };
    });

    // Combine and sort by creation date
    const combinedHistory: HistoryItem[] = [
      ...transformedCompetitorUgcReplicationHistory,
      ...transformedCharacterAdsHistory,
      ...transformedMotionSwapHistory
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      history: combinedHistory
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
