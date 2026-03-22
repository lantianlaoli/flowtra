import type { ProjectAgentCanvasAssetRef } from '@/lib/project-agent/canvas-state';

export const toProjectAgentVideoAssets = (value: unknown): ProjectAgentCanvasAssetRef[] => {
  const videos = Array.isArray(value) ? value : [];

  return videos
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object') return false;
      if (item.source_type === 'competitor_ad') return true;

      // Motion Clone requires a creator video with a resolved cover image.
      return typeof item.cover_url === 'string' && item.cover_url.length > 0;
    })
    .map((item) => ({
      id: String(item.id),
      name: typeof item.source_name === 'string'
        ? item.source_name
        : typeof item.description === 'string'
          ? item.description
          : 'Video',
      imageUrl: typeof item.cover_url === 'string' ? item.cover_url : null,
      sourceType: item.source_type === 'competitor_ad' ? 'competitor_ad' : 'creator',
      videoUrl: typeof item.video_url === 'string' ? item.video_url : null,
      videoCdnUrl: typeof item.video_cdn_url === 'string' ? item.video_cdn_url : null,
      analysisLanguage: typeof item.analysis_language === 'string' ? item.analysis_language : null,
    }));
};
