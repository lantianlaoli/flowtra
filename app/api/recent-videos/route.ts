import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's latest completed video from database
    const supabase = getSupabase();
    const { data: history, error } = await supabase
      .from('user_history')
      .select('*')
      .eq('user_id', userId)
      .eq('workflow_status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to fetch recent videos:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch recent videos' 
      }, { status: 500 });
    }

    // Transform database data to match frontend interface
    const transformedVideos = (history || []).map(item => {
      // Parse creative prompts if stored as JSON
      let creativePrompt = null;
      if (item.creative_prompts) {
        try {
          const parsed = typeof item.creative_prompts === 'string' 
            ? JSON.parse(item.creative_prompts) 
            : item.creative_prompts;
          
          creativePrompt = {
            music: parsed.music || null,
            action: parsed.action || null,
            ending: parsed.ending || null,
            setting: parsed.setting || null
          };
        } catch (e) {
          console.error('Failed to parse creative prompts:', e);
        }
      }

      return {
        id: item.id,
        thumbnail: item.cover_image_url || undefined,
        videoUrl: item.video_url || undefined,
        createdAt: item.created_at,
        status: 'completed' as const,
        generationTime: item.generation_time_minutes || undefined, // Only show if exists in database
        modelUsed: item.video_model === 'veo3' ? 'VEO3 High Quality' : 'VEO3 Fast',
        creditsConsumed: item.generation_credits_used || item.credits_used || undefined, // Only show if exists
        creativePrompt
      };
    });

    return NextResponse.json({ 
      success: true, 
      videos: transformedVideos // Only return the latest video for "Latest Masterpiece"
    });
    
  } catch (error) {
    console.error('Error fetching recent videos:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch recent videos' 
    }, { status: 500 });
  }
}