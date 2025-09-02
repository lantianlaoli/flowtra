import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Replace with actual database queries
    // This is sample data to demonstrate the UI
    const stats = {
      totalVideos: 24,
      thisMonth: 8,
      creditsUsed: 320,
      successRate: 98
    };

    return NextResponse.json({ 
      success: true, 
      stats 
    });
    
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch user stats' 
    }, { status: 500 });
  }
}