import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Check if user has onboarding status record
    const { data, error } = await supabase
      .from('user_onboarding_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no record exists, user hasn't completed onboarding
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          completed: false,
          current_step: 0,
        });
      }
      throw error;
    }

    return NextResponse.json({
      completed: data?.completed || false,
      current_step: data?.current_step || 0,
    });

  } catch (error) {
    console.error('❌ Error fetching onboarding status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 }
    );
  }
}
