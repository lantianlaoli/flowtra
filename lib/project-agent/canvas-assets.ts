import type { ProjectAgentCanvasAssetRef } from '@/lib/project-agent/canvas-state';

export const toProjectAgentVideoAssets = (value: unknown): ProjectAgentCanvasAssetRef[] => {
  const videos = Array.isArray(value) ? value : [];

  return videos
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => {
      const sourceType = item.source_type === 'competitor_ad' ? 'competitor_ad' : 'creator';
      if (sourceType === 'competitor_ad') return true;

      const coverUrl = typeof item.cover_url === 'string' ? item.cover_url.trim() : '';
      return coverUrl.length > 0;
    })
    .map((item) => ({
      id: String(item.id),
      name: typeof item.description === 'string' && item.description.trim().length > 0
        ? item.description.trim()
        : typeof item.source_name === 'string' && item.source_name.trim().length > 0
          ? item.source_name.trim()
          : 'Video',
      imageUrl: typeof item.cover_url === 'string' ? item.cover_url : null,
      durationSeconds: typeof item.duration_seconds === 'number' ? item.duration_seconds : null,
      sourceType: item.source_type === 'competitor_ad' ? 'competitor_ad' : 'creator',
      videoUrl: typeof item.video_url === 'string' ? item.video_url : null,
      videoCdnUrl: typeof item.video_cdn_url === 'string' ? item.video_cdn_url : null,
      analysisLanguage: typeof item.analysis_language === 'string' ? item.analysis_language : null,
    }));
};
