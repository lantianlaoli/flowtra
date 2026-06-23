import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { createServerUserSupabaseClient } from '@/lib/supabase/server-user';
import type { VideoModel } from '@/lib/constants';

interface VideoCloneItem {
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
  adType: 'video-clone';
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
  videoModel: VideoModel;
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

interface MotionCloneItem {
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
  adType: 'motion-clone';
  videoAspectRatio?: string;
  videoDurationSeconds?: number;
  quality?: string;
  photoPrompt?: string;
  videoPrompt?: string;
  errorMessage?: string;
}

type HistoryItem = VideoCloneItem | CharacterAdsItem | MotionCloneItem;

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

const ALLOWED_VIDEO_CLONE_MODELS: VideoModel[] = ['seedance_2_fast', 'seedance_2', 'seedance_2_mini', 'kling_3'];

const normalizeVideoCloneModel = (model?: string | null): VideoModel => {
  if (ALLOWED_VIDEO_CLONE_MODELS.includes(model as VideoModel)) {
    return model as VideoModel;
  }
  return 'seedance_2_fast'; // Default for invalid/null models
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

    const supabase = await createServerUserSupabaseClient();
    
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

    // Fetch Video Clone data
    const { data: videoCloneItems, error: videoCloneError } = await supabase
      .from('video_clone_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (videoCloneError) {
      console.error('Failed to fetch Video Clone history:', videoCloneError);
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

    // Fetch Motion Clone data
    // Schema verified via Supabase MCP (2026-03-18): motion_clone_projects columns include
    // id, user_id, status, preview_image_url, output_video_url,
    // credits_cost, generation_credits_used, downloaded, progress_percentage, mode,
    // reference_duration_seconds, photo_prompt, video_prompt, error_message, created_at
    const { data: motionCloneItems, error: motionCloneError } = await supabase
      .from('motion_clone_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (motionCloneError) {
      console.error('Failed to fetch Motion Clone history:', motionCloneError);
    }

    // Transform Video Clone data
    const transformedVideoCloneHistory: VideoCloneItem[] = (videoCloneItems || []).map(item => {
      const videoModel = normalizeVideoCloneModel(item.video_model);

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
        videoModel,
        creditsUsed: item.generation_credits_used || 0,
        status: mapWorkflowStatus(item.status),
        createdAt: item.created_at,
        progress: item.progress_percentage,
        currentStep: item.current_step,
        adType: 'video-clone',
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
        const storedVideoModel = item.video_model as CharacterAdsItem['videoModel'];
        const resolvedVideoModel: VideoModel =
          storedVideoModel === 'seedance_2' || storedVideoModel === 'seedance_2_fast' || storedVideoModel === 'seedance_2_mini' || storedVideoModel === 'kling_3'
            ? storedVideoModel
            : 'seedance_2_fast';

        // For completed items, ensure we have the correct video URL
        let videoUrl: string | undefined;
        if (mappedStatus === 'completed') {
          // Prefer merged output, fallback to single-scene output.
          videoUrl = item.merged_video_url || (Array.isArray(item.generated_video_urls) ? item.generated_video_urls[0] : undefined);
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

    const transformedMotionCloneHistory: MotionCloneItem[] = (motionCloneItems || []).map(item => {
      const mappedStatus = mapWorkflowStatus(item.status);
      const videoUrl = mappedStatus === 'completed' ? item.output_video_url : undefined;

      return {
        id: item.id,
        coverImageUrl: item.preview_image_url || undefined,
        coverAspectRatio: resolveCoverAspectRatio('9:16'),
        videoUrl,
        downloaded: item.downloaded || false,
        downloadCreditsUsed: 0,
        generationCreditsUsed: item.generation_credits_used || 0,
        videoModel: 'kling_3',
        creditsUsed: item.credits_cost || 0,
        status: mappedStatus,
        createdAt: item.created_at,
        progress: item.progress_percentage,
        currentStep: item.status,
        adType: 'motion-clone',
        videoAspectRatio: resolveVideoAspectRatio('9:16', '9:16'),
        videoDurationSeconds: item.reference_duration_seconds || undefined,
        quality: item.mode || undefined,
        photoPrompt: item.photo_prompt || undefined,
        videoPrompt: item.video_prompt || undefined,
        errorMessage: item.error_message || undefined
      };
    });

    // Combine and sort by creation date
    const combinedHistory: HistoryItem[] = [
      ...transformedVideoCloneHistory,
      ...transformedCharacterAdsHistory,
      ...transformedMotionCloneHistory
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
