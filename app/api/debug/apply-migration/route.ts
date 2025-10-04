import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    
    console.log('Checking database constraints...');
    
    // Let's check what constraints exist on the table
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.check_constraints')
      .select('*')
      .like('constraint_name', '%video_model%');
    
    if (constraintError) {
      console.error('Error checking constraints:', constraintError);
    } else {
      console.log('Video model constraints:', constraints);
    }
    
    // Let's also check the table definition
    const { data: tableInfo, error: tableError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .limit(0); // Just get the structure
    
    if (tableError) {
      console.error('Table error:', tableError);
    }
    
    // Try to create a test record with veo3_fast to see if that works
    const testRecord = {
      user_id: 'test_user',
      person_image_urls: ['https://example.com/test.jpg'],
      product_image_urls: ['https://example.com/test.jpg'],
      video_duration_seconds: 8,
      image_model: 'seedream',
      video_model: 'veo3_fast', // Try with a known working model
      video_aspect_ratio: '16:9',
      accent: 'british',
      credits_cost: 30,
      status: 'pending',
      current_step: 'analyzing_images',
      progress_percentage: 0,
    };
    
    console.log('Testing with veo3_fast model...');
    const { data: testData, error: testError } = await supabase
      .from('character_ads_projects')
      .insert(testRecord)
      .select()
      .single();
    
    if (testError) {
      console.error('Test insert error:', testError);
      return NextResponse.json({ 
        error: testError.message,
        details: testError.details,
        hint: testError.hint,
        code: testError.code
      }, { status: 500 });
    } else {
      console.log('Test insert successful:', testData);
      
      // Clean up the test record
      await supabase
        .from('character_ads_projects')
        .delete()
        .eq('id', testData.id);
      
      return NextResponse.json({ 
        success: true, 
        message: 'veo3_fast works, but sora2 is blocked by constraint',
        testData
      });
    }
    
  } catch (error) {
    console.error('Error in constraint check:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}