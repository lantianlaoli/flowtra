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

    // Upsert onboarding status (update if exists, insert if not)
    const { error } = await supabase
      .from('user_onboarding_status')
      .upsert(
        {
          user_id: userId,
          completed: true,
          current_step: 9, // Total steps (updated after removing credits)
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (error) {
      throw error;
    }

    console.log('✅ Onboarding completed for user:', userId);

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
    });

  } catch (error) {
    console.error('❌ Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
