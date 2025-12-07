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
}

interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
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
}

interface WatermarkRemovalItem {
  id: string;
  originalVideoUrl: string;
  videoUrl?: string;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  adType: 'watermark-removal';
  errorMessage?: string;
}

type HistoryItem = CompetitorUgcReplicationItem | CharacterAdsItem | WatermarkRemovalItem;

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

const ALLOWED_COMPETITOR_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'sora2', 'sora2_pro', 'grok', 'kling_2_6'];

const normalizeCompetitorVideoModel = (model?: string | null): VideoModel => {
  return ALLOWED_COMPETITOR_VIDEO_MODELS.includes(model as VideoModel)
    ? (model as VideoModel)
    : 'veo3_fast';
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

    // Fetch Character Ads data
    const { data: characterAdsItems, error: characterAdsError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (characterAdsError) {
      console.error('Failed to fetch Character Ads history:', characterAdsError);
    }

    // Fetch Watermark Removal data
    const { data: watermarkRemovalItems, error: watermarkRemovalError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (watermarkRemovalError) {
      console.error('Failed to fetch Watermark Removal history:', watermarkRemovalError);
    }

    // Transform Competitor UGC Replication data
    const transformedCompetitorUgcReplicationHistory: CompetitorUgcReplicationItem[] = (competitorUgcReplicationItems || []).map(item => {
      const videoModel = normalizeCompetitorVideoModel(item.video_model);

      return {
        id: item.id,
        coverImageUrl: item.cover_image_url,
        videoUrl: item.video_url,
        photoOnly: !!item.photo_only,
        downloaded: item.downloaded,
        downloadCreditsUsed: item.download_credits_used,
        generationCreditsUsed: 0,
        imagePrompt: item.image_prompt,
        coverAspectRatio: resolveCoverAspectRatio(item.cover_image_aspect_ratio),
        videoModel,
        creditsUsed: item.credits_cost || 0,
        status: mapWorkflowStatus(item.status),
        createdAt: item.created_at,
        progress: item.progress_percentage,
        currentStep: item.current_step,
        adType: 'competitor-ugc-replication',
        videoAspectRatio: resolveVideoAspectRatio(item.video_aspect_ratio, item.cover_image_aspect_ratio),
        // Segment information for accurate cost calculation
        isSegmented: item.is_segmented || false,
        segmentCount: item.segment_count || undefined,
        videoDuration: item.video_duration || undefined
      };
    });

    // Transform Character Ads data - show all items (processing, completed, and failed)
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
          videoAspectRatio: resolveVideoAspectRatio(item.video_aspect_ratio, item.cover_image_aspect_ratio)
        };
      });

    // Transform Watermark Removal data
    const transformedWatermarkRemovalHistory: WatermarkRemovalItem[] = (watermarkRemovalItems || []).map(item => ({
      id: item.id,
      originalVideoUrl: item.input_video_url,
      videoUrl: item.output_video_url || undefined,
      creditsUsed: item.credits_used || 3,
      status: mapWorkflowStatus(item.status),
      createdAt: item.created_at,
      adType: 'watermark-removal',
      errorMessage: item.error_message || undefined
    }));

    // Combine and sort by creation date
    const combinedHistory: HistoryItem[] = [
      ...transformedCompetitorUgcReplicationHistory,
      ...transformedCharacterAdsHistory,
      ...transformedWatermarkRemovalHistory
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
