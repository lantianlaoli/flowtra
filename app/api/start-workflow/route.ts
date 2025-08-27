import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/workflow';

export async function POST(request: NextRequest) {
  try {
    const requestData: StartWorkflowRequest = await request.json();
    
    if (!requestData.imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const result = await startWorkflowProcess(requestData);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Start workflow error:', error);
    return NextResponse.json({
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}