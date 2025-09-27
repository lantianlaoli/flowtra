import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const supabase = getSupabase();

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('character_ads_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error getting character ads count:', countError);
      return NextResponse.json({ error: 'Failed to get count' }, { status: 500 });
    }

    // Get paginated results
    const { data: projects, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed') // Only show completed projects for showcase
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching character ads history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Transform data to match ShowcaseSection expected format
    const transformedProjects = (projects || [])
      .filter(project => project.generated_image_url && project.person_image_urls?.[0]) // Only include projects with both images
      .map(project => ({
        id: project.id,
        original_image_url: project.person_image_urls[0], // Use first person image as original
        cover_image_url: project.generated_image_url, // Use generated image as cover
        product_image_urls: project.product_image_urls, // Include product images
        generated_video_urls: project.generated_video_urls, // Include video URLs
        merged_video_url: project.merged_video_url, // Include merged video URL
        user_id: project.user_id,
        status: project.status,
        created_at: project.created_at
      }));

    return NextResponse.json({
      success: true,
      data: transformedProjects,
      history: transformedProjects, // Also provide as 'history' for compatibility
      pagination: {
        total: totalCount || 0,
        page,
        limit,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Character ads history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}