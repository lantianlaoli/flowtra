import { analyzeReferenceVideoWithLanguage } from '@/lib/video-clone-workflow';
import { normalizeAnalysisToV2 } from '@/lib/video-analysis-schema';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const DEFAULT_VIDEOS_BASE_URL =
  'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/videos';

const TIMESTAMP = '2024-01-01T00:00:00.000Z';

type DefaultVideoDef = {
  id: string;
  fileName: string;
  referenceName: string;
};

const DEFAULT_VIDEO_DEFS: DefaultVideoDef[] = [
  {
    id: 'system-default-cerave',
    fileName: 'cerave_hydrating_cleanser.mp4',
    referenceName: 'CeraVe Hydrating Cleanser',
  },
  {
    id: 'system-default-goli',
    fileName: 'goli_gummies_men_showcase.mp4',
    referenceName: 'Goli Gummies Men Showcase',
  },
  {
    id: 'system-default-lavalier',
    fileName: 'lavalier_mic_showcase.mp4',
    referenceName: 'Lavalier Mic Showcase',
  },
];

async function main() {
  const results: Array<{
    id: string;
    referenceName: string;
    fileName: string;
    analysisResult: Record<string, unknown>;
    language: string;
    durationSeconds: number;
  }> = [];

  for (const def of DEFAULT_VIDEO_DEFS) {
    const fileUrl = `${DEFAULT_VIDEOS_BASE_URL}/${def.fileName}`;
    console.log(`[backfill] Analyzing ${def.referenceName}...`);
    console.log(`[backfill] URL: ${fileUrl}`);

    try {
      const { analysis, language } = await analyzeReferenceVideoWithLanguage({
        file_url: fileUrl,
        reference_name: def.referenceName,
      });

      const normalized = normalizeAnalysisToV2(analysis);
      const durationSeconds = normalized?.video_duration_seconds || 0;

      results.push({
        id: def.id,
        referenceName: def.referenceName,
        fileName: def.fileName,
        analysisResult: analysis,
        language,
        durationSeconds,
      });

      console.log(`[backfill] ✅ ${def.referenceName} analyzed (${durationSeconds}s, ${language})`);
    } catch (error) {
      console.error(`[backfill] ❌ Failed to analyze ${def.referenceName}:`, error);
      process.exit(1);
    }
  }

  const tsContent = `import type { CanonicalAnalysisV2 } from '@/lib/video-analysis-schema';

export type SystemReferenceVideo = {
  id: string;
  reference_name: string;
  analysis_status: 'completed';
  analysis_result: CanonicalAnalysisV2;
  language: string;
  analyzed_at: string;
  video_duration_seconds: number;
  source_storage_bucket: string;
  source_storage_path: string;
  created_at: string;
  updated_at: string;
  isSystem: true;
};

const SYSTEM_REFERENCE_VIDEO_TIMESTAMP = '${TIMESTAMP}';
const SYSTEM_REFERENCE_VIDEO_BASE_URL =
  'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/videos';

const buildSystemReferenceVideoUrl = (fileName: string) =>
  \`\${SYSTEM_REFERENCE_VIDEO_BASE_URL}/\${encodeURIComponent(fileName)}\`;

const createSystemReferenceVideo = ({
  id,
  referenceName,
  fileName,
  analysisResult,
  language,
  durationSeconds,
}: {
  id: string;
  referenceName: string;
  fileName: string;
  analysisResult: CanonicalAnalysisV2;
  language: string;
  durationSeconds: number;
}): SystemReferenceVideo => ({
  id,
  reference_name: referenceName,
  analysis_status: 'completed',
  analysis_result: analysisResult,
  language,
  analyzed_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  video_duration_seconds: durationSeconds,
  source_storage_bucket: 'site-assets',
  source_storage_path: \`defaults/videos/\${fileName}\`,
  created_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  updated_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  isSystem: true,
});

export const SYSTEM_REFERENCE_VIDEOS: SystemReferenceVideo[] = [
${results
  .map(
    (r) => `  createSystemReferenceVideo({
    id: '${r.id}',
    referenceName: '${r.referenceName}',
    fileName: '${r.fileName}',
    analysisResult: ${JSON.stringify(r.analysisResult, null, 2).split('\n').map((line, i) => (i === 0 ? line : '    ' + line)).join('\n')},
    language: '${r.language}',
    durationSeconds: ${r.durationSeconds},
  }),`
  )
  .join('\n')}
];

export const isSystemReferenceVideoId = (
  videoId: string | null | undefined
): boolean => {
  if (!videoId) return false;
  return SYSTEM_REFERENCE_VIDEOS.some((video) => video.id === videoId);
};

export const getSystemReferenceVideoById = (
  videoId: string | null | undefined
): SystemReferenceVideo | null => {
  if (!videoId) return null;
  return SYSTEM_REFERENCE_VIDEOS.find((video) => video.id === videoId) || null;
};

export const toVideoAssetLike = (
  systemVideo: SystemReferenceVideo
): Record<string, unknown> => ({
  id: systemVideo.id,
  user_id: 'system',
  source_id: systemVideo.id,
  platform: 'tiktok',
  platform_video_id: systemVideo.id,
  video_url: '',
  video_cdn_url: buildSystemReferenceVideoUrl(
    systemVideo.source_storage_path.replace('defaults/videos/', '')
  ),
  cover_url: null,
  description: systemVideo.reference_name,
  stats: null,
  duration_seconds: systemVideo.video_duration_seconds,
  analysis_status: systemVideo.analysis_status,
  analysis_result: systemVideo.analysis_result,
  analysis_error: null,
  analysis_language: systemVideo.language,
  analyzed_at: systemVideo.analyzed_at,
  created_at: systemVideo.created_at,
  updated_at: systemVideo.updated_at,
  source_name: 'Default',
  source_type: 'reference_video',
  reference_video_id: systemVideo.id,
  isSystem: true,
});
`;

  const outputPath = resolve(process.cwd(), 'lib/default-reference-videos.ts');
  writeFileSync(outputPath, tsContent);
  console.log(`[backfill] ✅ Written ${outputPath}`);
}

main();
