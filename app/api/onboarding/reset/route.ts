import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Reset onboarding status
    const { error } = await supabase
      .from('user_onboarding_status')
      .upsert(
        {
          user_id: userId,
          completed: false,
          current_step: 0,
          completed_at: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (error) {
      throw error;
    }

    console.log('🔄 Onboarding reset for user:', userId);

    return NextResponse.json({
      success: true,
      message: 'Onboarding reset successfully',
    });

  } catch (error) {
    console.error('❌ Error resetting onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to reset onboarding' },
      { status: 500 }
    );
  }
}
