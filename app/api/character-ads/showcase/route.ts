import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '2'); // Default to 2 latest examples

    const supabase = getSupabase();

    // Get the latest completed projects from all users (global showcase)
    const { data: projects, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('status', 'completed') // Only show completed projects
      .not('generated_image_url', 'is', null) // Must have generated image
      .not('person_image_urls', 'is', null) // Must have person images
      .order('created_at', { ascending: false }) // Latest first
      .limit(limit);

    if (error) {
      console.error('Error fetching character ads showcase:', error);
      return NextResponse.json({ error: 'Failed to fetch showcase' }, { status: 500 });
    }

    // Transform data to match ShowcaseSection expected format
    const transformedProjects = (projects || [])
      .filter(project => 
        project.generated_image_url && 
        project.person_image_urls?.[0]
      )
      .map(project => ({
        id: project.id,
        original_image_url: project.person_image_urls[0], // Use first person image as original
        cover_image_url: project.generated_image_url, // Use generated image as cover
        person_image_urls: project.person_image_urls, // Include person images
        product_image_urls: project.product_image_urls, // Include product images (may be empty for talking head)
        generated_video_urls: project.generated_video_urls, // Include video URLs
        merged_video_url: project.merged_video_url, // Include merged video URL
        user_id: project.user_id,
        status: project.status,
        created_at: project.created_at,
        talking_head_mode: !project.product_image_urls || project.product_image_urls.length === 0
      }));

    return NextResponse.json({
      success: true,
      data: transformedProjects,
      total: transformedProjects.length
    });

  } catch (error) {
    console.error('Character ads showcase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
