import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Query thumbnail_history for the task status
    const { data: records, error } = await supabase
      .from('thumbnail_history')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching task status:', error);
      return NextResponse.json({ error: 'Failed to fetch task status' }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // For multiple records (when multiple images are generated),
    // return aggregated status and all results
    const allRecords = records;
    const completedCount = records.filter(r => r.status === 'completed').length;
    const failedCount = records.filter(r => r.status === 'failed').length;
    const processingCount = records.filter(r => r.status === 'processing').length;

    let overallStatus: string;
    if (failedCount > 0 && completedCount === 0) {
      overallStatus = 'failed';
    } else if (completedCount === records.length) {
      overallStatus = 'completed';
    } else if (processingCount > 0) {
      overallStatus = 'processing';
    } else {
      overallStatus = 'pending';
    }

    // Prepare results
    const results = records
      .filter(record => record.thumbnail_url)
      .map(record => ({
        id: record.id,
        thumbnailUrl: record.thumbnail_url,
        title: record.title,
        status: record.status,
        downloaded: record.downloaded,
        createdAt: record.created_at
      }));

    const response = {
      success: true,
      taskId,
      status: overallStatus,
      totalRecords: records.length,
      completedCount,
      failedCount,
      processingCount,
      results,
      records: allRecords,
      message: getStatusMessage(overallStatus, completedCount, records.length)
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Task status fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch task status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getStatusMessage(status: string, completedCount: number, totalCount: number): string {
  switch (status) {
    case 'completed':
      return totalCount === 1
        ? 'Thumbnail generated successfully!'
        : `All ${totalCount} thumbnails generated successfully!`;
    case 'processing':
      return completedCount > 0
        ? `${completedCount} of ${totalCount} thumbnails completed, others still processing...`
        : totalCount === 1
        ? 'Generating your thumbnail...'
        : `Generating ${totalCount} thumbnails...`;
    case 'failed':
      return 'Thumbnail generation failed';
    case 'pending':
    default:
      return 'Task is queued for processing';
  }
}