import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

interface StandardAdsItem {
  id: string;
  originalImageUrl: string;
  coverImageUrl?: string;
  videoUrl?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  productDescription?: string;
  imagePrompt?: string;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'standard';
}

interface MultiVariantAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  productDescription?: string;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'multi-variant';
  elementsData?: Record<string, unknown>;
}

interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'character';
  videoDurationSeconds?: number;
}

type HistoryItem = StandardAdsItem | MultiVariantAdsItem | CharacterAdsItem;

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

    // Fetch Standard Ads data
    const { data: standardAdsItems, error: standardAdsError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (standardAdsError) {
      console.error('Failed to fetch Standard Ads history:', standardAdsError);
    }

    // Fetch Multi-Variant Ads data
    const { data: multiVariantAdsItems, error: multiVariantAdsError } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (multiVariantAdsError) {
      console.error('Failed to fetch Multi-Variant Ads history:', multiVariantAdsError);
    }

    // Fetch Character Ads data
    console.log('Querying character_ads_projects for user:', userId);
    
    // Check Supabase auth status
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log('Supabase auth status:', { 
      user: authData?.user?.id, 
      error: authError,
      isAuthenticated: !!authData?.user 
    });
    
    const { data: characterAdsItems, error: characterAdsError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    console.log('Character Ads query result:', { 
      data: characterAdsItems, 
      error: characterAdsError,
      dataLength: characterAdsItems?.length 
    });

    if (characterAdsError) {
      console.error('Failed to fetch Character Ads history:', characterAdsError);
    } else {
      console.log('Character Ads query successful for user:', userId);
    }

    console.log('Character Ads raw data:', characterAdsItems?.length || 0, 'items');
    if (characterAdsItems && characterAdsItems.length > 0) {
      console.log('First Character Ads item:', JSON.stringify(characterAdsItems[0], null, 2));
    }

    // Transform Standard Ads data
    const transformedStandardAdsHistory: StandardAdsItem[] = (standardAdsItems || []).map(item => ({
      id: item.id,
      originalImageUrl: item.original_image_url,
      coverImageUrl: item.cover_image_url,
      videoUrl: item.video_url,
      photoOnly: !!item.photo_only,
      downloaded: item.downloaded,
      downloadCreditsUsed: item.download_credits_used,
      generationCreditsUsed: 0,
      productDescription: item.product_description,
      imagePrompt: item.image_prompt,
      videoModel: item.video_model,
      creditsUsed: item.credits_cost || 0,
      status: mapWorkflowStatus(item.status),
      createdAt: item.created_at,
      progress: item.progress_percentage,
      currentStep: item.current_step,
      adType: 'standard'
    }));

    // Transform Multi-Variant Ads data
    interface MultiVariantRow {
      id: string;
      user_id: string;
      elements_data?: Record<string, unknown> | null;
      photo_only?: boolean | null;
      cover_task_id?: string | null;
      video_task_id?: string | null;
      cover_image_url?: string | null;
      video_url?: string | null;
      error_message?: string | null;
      status: string;
      current_step: string;
      credits_cost: number;
      downloaded: boolean;
      created_at: string;
      updated_at: string;
      last_processed_at?: string | null;
      progress_percentage?: number | null;
      original_image_url?: string | null;
      product_description?: string | null;
      video_model?: 'veo3' | 'veo3_fast' | string | null;
    }

    const transformedMultiVariantAdsHistory: MultiVariantAdsItem[] = (multiVariantAdsItems || []).map((instance: MultiVariantRow) => {
      const elements = (instance.elements_data ?? {}) as Record<string, unknown>;
      const originalImageFromElements = (elements.original_image_url as string | undefined) || (elements.originalImageUrl as string | undefined);
      return {
        id: instance.id,
        originalImageUrl: instance.original_image_url || originalImageFromElements,
        coverImageUrl: instance.cover_image_url || undefined,
        videoUrl: instance.video_url || undefined,
        photoOnly: instance.photo_only === true,
        downloaded: instance.downloaded,
        downloadCreditsUsed: 0,
        generationCreditsUsed: 0,
        productDescription: instance.product_description || (elements.product_description as string | undefined) || (elements.product as string | undefined),
        videoModel: (instance.video_model === 'veo3' || instance.video_model === 'veo3_fast') ? instance.video_model : 'veo3_fast',
        creditsUsed: instance.credits_cost,
        status: mapWorkflowStatus(instance.status),
        createdAt: instance.created_at,
        progress: (instance.progress_percentage as number | null) ?? 0,
        currentStep: instance.current_step,
        adType: 'multi-variant',
        elementsData: instance.elements_data || undefined
      };
    });

    // Transform Character Ads data - show processing and completed items
    const transformedCharacterAdsHistory: CharacterAdsItem[] = (characterAdsItems || [])
      .filter(item => {
        // Show processing items (including generating_videos status)
        const mappedStatus = mapWorkflowStatus(item.status);
        if (mappedStatus === 'processing') return true;

        // For completed items, check video availability
        if (mappedStatus === 'completed') {
          // For 8-second videos, check if we have either merged_video_url or a single generated video
          if (item.video_duration_seconds === 8) {
            return item.merged_video_url || (item.generated_video_urls && item.generated_video_urls.length === 1);
          }

          // For longer videos, require merged_video_url
          return item.merged_video_url;
        }

        // Don't show failed items
        return false;
      })
      .map(item => {
        return {
          id: item.id,
          originalImageUrl: item.person_image_urls?.[0], // Use first person image as thumbnail
          coverImageUrl: item.generated_image_url, // Map generated image to cover for preview
          videoUrl: item.merged_video_url || (item.video_duration_seconds === 8 && item.generated_video_urls?.[0]) || undefined, // Show merged video or single 8s video
          downloaded: item.downloaded || false,
          downloadCreditsUsed: item.download_credits_used || 0,
          generationCreditsUsed: 0, // Generation is free, credits only used on download
          videoModel: item.video_model,
          creditsUsed: item.credits_cost || 0,
          status: mapWorkflowStatus(item.status),
          createdAt: item.created_at,
          progress: item.progress_percentage,
          currentStep: item.current_step,
          adType: 'character',
          videoDurationSeconds: item.video_duration_seconds
        };
      });

    console.log('Character Ads transformed data:', transformedCharacterAdsHistory.length, 'items');

    // Combine and sort by creation date
    const combinedHistory: HistoryItem[] = [
      ...transformedStandardAdsHistory, 
      ...transformedMultiVariantAdsHistory, 
      ...transformedCharacterAdsHistory
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('Combined history:', combinedHistory.length, 'items');
    console.log('Character Ads in combined:', combinedHistory.filter(item => item.adType === 'character').length, 'items');

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
