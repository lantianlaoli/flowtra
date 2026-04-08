import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deductCredits, recordCreditTransaction } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * POST /api/video-clone/cleanup-timeout
 *
 * Detects and cleans up projects that have been stuck in processing state
 * due to function timeouts. Refunds credits and marks projects as failed.
 *
 * Can be called by:
 * - Frontend (when user sees stuck project)
 * - Cron job (periodic cleanup)
 * - Manual trigger (admin dashboard)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Optional: Check for auth header or API key for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow requests from authenticated users or cron jobs
    const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // Find stuck projects: processing for more than 3 minutes without video_prompts
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: stuckProjects, error: fetchError } = await supabase
      .from('video_clone_projects')
      .select('id, user_id, credits_cost, generation_credits_used, video_model, video_duration, created_at')
      .eq('status', 'processing')
      .is('video_prompts', null)
      .lt('created_at', threeMinutesAgo);

    if (fetchError) {
      console.error('[cleanup-timeout] Error fetching stuck projects:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch stuck projects', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!stuckProjects || stuckProjects.length === 0) {
      console.log('[cleanup-timeout] No stuck projects found');
      return NextResponse.json({
        success: true,
        message: 'No stuck projects found',
        cleaned: 0
      });
    }

    console.log(`[cleanup-timeout] Found ${stuckProjects.length} stuck projects`);

    const results = [];

    for (const project of stuckProjects) {
      try {
        console.log(`[cleanup-timeout] Processing project ${project.id}`);

        // Mark project as failed
        const { error: updateError } = await supabase
          .from('video_clone_projects')
          .update({
            status: 'failed',
            error_message: 'Workflow timeout: AI prompt generation exceeded function timeout limit (auto-cleanup). Please try again with a simpler reference video.',
            progress_percentage: 0,
            current_step: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id);

        if (updateError) {
          console.error(`[cleanup-timeout] Failed to update project ${project.id}:`, updateError);
          results.push({
            projectId: project.id,
            success: false,
            error: 'Failed to update project status'
          });
          continue;
        }

        // Refund credits if they were charged
        const chargedCredits = Number(project.generation_credits_used || 0);
        if (chargedCredits > 0) {
          try {
            await deductCredits(project.user_id, -chargedCredits); // Negative = refund
            await recordCreditTransaction(
              project.user_id,
              'refund',
              chargedCredits,
              `Video Clone - Auto-refund for timeout failure (${project.video_model?.toUpperCase()}, ${project.video_duration}s)`,
              project.id,
              true
            );

            console.log(`[cleanup-timeout] ✅ Refunded ${chargedCredits} credits to user ${project.user_id}`);

            await supabase
              .from('video_clone_projects')
              .update({
                generation_credits_used: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', project.id);

            results.push({
              projectId: project.id,
              success: true,
              refunded: chargedCredits
            });
          } catch (refundError) {
            console.error(`[cleanup-timeout] Failed to refund credits for project ${project.id}:`, refundError);
            results.push({
              projectId: project.id,
              success: false,
              error: 'Failed to refund credits'
            });
          }
        } else {
          results.push({
            projectId: project.id,
            success: true,
            refunded: 0
          });
        }
      } catch (projectError) {
        console.error(`[cleanup-timeout] Error processing project ${project.id}:`, projectError);
        results.push({
          projectId: project.id,
          success: false,
          error: projectError instanceof Error ? projectError.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalRefunded = results.reduce((sum, r) => sum + (r.refunded || 0), 0);

    console.log(`[cleanup-timeout] ✅ Cleaned up ${successCount}/${stuckProjects.length} projects, refunded ${totalRefunded} credits`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${successCount} stuck projects`,
      cleaned: successCount,
      totalRefunded,
      results
    });

  } catch (error) {
    console.error('[cleanup-timeout] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
