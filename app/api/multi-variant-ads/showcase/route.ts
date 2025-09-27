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
      .from('multi_variant_ads_projects')
      .select('*')
      .eq('status', 'completed') // Only show completed projects
      .not('cover_image_url', 'is', null) // Must have cover image
      .not('original_image_url', 'is', null) // Must have original image
      .order('created_at', { ascending: false }) // Latest first
      .limit(limit);

    if (error) {
      console.error('Error fetching multi-variant ads showcase:', error);
      return NextResponse.json({ error: 'Failed to fetch showcase' }, { status: 500 });
    }

    // Transform data to match ShowcaseSection expected format
    const transformedProjects = (projects || [])
      .filter(project => 
        project.cover_image_url && 
        project.original_image_url // Ensure we have required images
      )
      .map(project => ({
        id: project.id,
        original_image_url: project.original_image_url,
        cover_image_url: project.cover_image_url,
        video_url: project.video_url,
        user_id: project.user_id,
        status: project.status,
        created_at: project.created_at,
        product_description: project.product_description,
        elements_data: project.elements_data
      }));

    return NextResponse.json({
      success: true,
      data: transformedProjects,
      total: transformedProjects.length
    });

  } catch (error) {
    console.error('Multi-variant ads showcase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}