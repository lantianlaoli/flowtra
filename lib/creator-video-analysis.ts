import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeCompetitorAdWithLanguage } from '@/lib/competitor-ugc-replication-workflow';

interface CreatorVideoAnalysisInput {
  supabase: SupabaseClient;
  videoId: string;
  videoUrl: string;
  sourceName: string;
  durationSeconds?: number | null;
}

export const analyzeCreatorVideoAndUpdate = async ({
  supabase,
  videoId,
  videoUrl,
  sourceName,
  durationSeconds
}: CreatorVideoAnalysisInput) => {
  // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_status, analysis_result, analysis_error, analysis_language, analyzed_at, duration_seconds
  await supabase
    .from('creator_source_videos')
    .update({
      analysis_status: 'analyzing',
      analysis_error: null
    })
    .eq('id', videoId);

  try {
    const { analysis, language } = await analyzeCompetitorAdWithLanguage(
      { file_url: videoUrl, competitor_name: sourceName }
    );

    const detectedDuration = typeof (analysis as Record<string, unknown>)?.video_duration_seconds === 'number'
      ? Number((analysis as Record<string, unknown>).video_duration_seconds)
      : null;

    await supabase
      .from('creator_source_videos')
      .update({
        analysis_status: 'completed',
        analysis_result: analysis,
        analysis_language: language,
        analysis_error: null,
        analyzed_at: new Date().toISOString(),
        duration_seconds: detectedDuration ?? durationSeconds ?? null
      })
      .eq('id', videoId);

    return { analysis, language };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    await supabase
      .from('creator_source_videos')
      .update({
        analysis_status: 'failed',
        analysis_error: message,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    return { error: message };
  }
};
