import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    
    console.log('Attempting to fix sora2 constraint...');
    
    // First, let's try to create a test record with sora2 to see the exact constraint name
    const testRecord = {
      user_id: 'test_sora2_constraint',
      person_image_urls: ['https://example.com/test.jpg'],
      product_image_urls: ['https://example.com/test.jpg'],
      video_duration_seconds: 8,
      image_model: 'seedream',
      video_model: 'sora2', // This should trigger the constraint error
      video_aspect_ratio: '16:9',
      accent: 'british',
      credits_cost: 200,
      status: 'pending',
      current_step: 'analyzing_images',
      progress_percentage: 0,
    };
    
    console.log('Testing sora2 constraint with test record...');
    const { data: testData, error: testError } = await supabase
      .from('character_ads_projects')
      .insert(testRecord)
      .select()
      .single();
    
    if (testError) {
      console.error('Constraint error details:', testError);
      
      // If it's the expected constraint error, we know what to fix
      if (testError.code === '23514' && testError.message.includes('video_model_check')) {
        return NextResponse.json({ 
          success: false,
          error: 'sora2 is blocked by database constraint',
          constraintError: testError,
          message: 'Need to update database constraint to allow sora2 model',
          suggestedFix: 'ALTER TABLE character_ads_projects DROP CONSTRAINT IF EXISTS long_video_projects_video_model_check; ALTER TABLE character_ads_projects ADD CONSTRAINT long_video_projects_video_model_check CHECK (video_model IN (\'veo3\', \'veo3_fast\', \'sora2\'));'
        });
      }
      
      return NextResponse.json({ 
        error: testError.message,
        details: testError.details,
        hint: testError.hint,
        code: testError.code
      }, { status: 500 });
    } else {
      console.log('sora2 test successful:', testData);
      
      // Clean up the test record
      await supabase
        .from('character_ads_projects')
        .delete()
        .eq('id', testData.id);
      
      return NextResponse.json({ 
        success: true, 
        message: 'sora2 model is already allowed',
        testData
      });
    }
    
  } catch (error) {
    console.error('Error in sora2 constraint check:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}