import type { ProjectAgentCanvasAssetRef } from '@/lib/project-agent/canvas-state';

export const toProjectAgentVideoAssets = (value: unknown): ProjectAgentCanvasAssetRef[] => {
  const videos = Array.isArray(value) ? value : [];

  return videos
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => {
      const sourceType = item.source_type === 'reference_video' ? 'reference_video' : 'creator';
      if (sourceType === 'reference_video') return true;

      const videoUrl = typeof item.video_url === 'string' ? item.video_url.trim() : '';
      const videoCdnUrl = typeof item.video_cdn_url === 'string' ? item.video_cdn_url.trim() : '';
      return videoUrl.length > 0 || videoCdnUrl.length > 0;
    })
    .map((item) => ({
      id: String(item.id),
      name: typeof item.description === 'string' && item.description.trim().length > 0
        ? item.description.trim()
        : typeof item.source_name === 'string' && item.source_name.trim().length > 0
          ? item.source_name.trim()
          : 'Video',
      imageUrl: null,
      durationSeconds: typeof item.duration_seconds === 'number' ? item.duration_seconds : null,
      sourceType: item.source_type === 'reference_video' ? 'reference_video' : 'creator',
      videoUrl: typeof item.video_url === 'string' ? item.video_url : null,
      videoCdnUrl: typeof item.video_cdn_url === 'string' ? item.video_cdn_url : null,
      analysisLanguage: typeof item.analysis_language === 'string' ? item.analysis_language : null,
      isSystem: item.isSystem === true,
    }));
};
