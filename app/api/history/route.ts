import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

interface V1HistoryItem {
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
  isV2?: false;
}

interface V2InstanceItem {
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
  isV2: true;
  elementsData?: Record<string, unknown>;
}

export async function GET() {
  try {
    const { userId } = await auth();
    
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
        default:
          return 'processing';
      }
    };

    // Fetch V1 data (user_history)
    const { data: v1History, error: v1Error } = await supabase
      .from('user_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (v1Error) {
      console.error('Failed to fetch V1 history:', v1Error);
    }

    // Fetch V2 data (independent instances stored in user_history_v2)
    const { data: v2Items, error: v2Error } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (v2Error) {
      console.error('Failed to fetch V2 history:', v2Error);
    }

    // Transform V1 data
    const transformedV1History: V1HistoryItem[] = (v1History || []).map(item => ({
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
      isV2: false
    }));

    // Transform V2 data - items are already independent
    interface V2Row {
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

    const transformedV2History: V2InstanceItem[] = (v2Items || []).map((instance: V2Row) => {
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
        isV2: true,
        elementsData: instance.elements_data || undefined
      };
    });

    // Combine and sort by creation date
    const combinedHistory = [...transformedV1History, ...transformedV2History]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
