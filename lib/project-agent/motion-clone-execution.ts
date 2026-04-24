import { analysisToLegacyFlatShots } from '@/lib/video-analysis-schema';
import { buildTypedMentionToken } from '@/lib/prompt-mention-tokens';
import {
  buildMotionClonePreviewPrompt,
  buildMotionCloneVideoPrompt,
} from '@/lib/motion-clone-workflow';

export type ProjectAgentMotionCloneSelection = {
  id: string;
  name: string;
  photoUrl?: string | null;
  isSystem?: boolean;
};

export type ProjectAgentMotionCloneReferenceVideo = {
  id: string;
  description?: string | null;
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  analysisLanguage?: string | null;
  analysisResult?: Record<string, unknown> | null;
  analysisSummary?: string | null;
  keyShots?: string[] | null;
  detectedCharacter?: string | null;
  detectedProduct?: string | null;
  isSystem?: boolean;
};

export type ProjectAgentMotionClonePhase =
  | 'idle'
  | 'generating_preview'
  | 'preview_ready'
  | 'generating_video'
  | 'completed'
  | 'failed';

export type ProjectAgentMotionCloneStage =
  | 'reference_selection'
  | 'replacement_selection'
  | 'workspace';

export type ProjectAgentMotionCloneExecution = {
  projectId?: string | null;
  stage?: ProjectAgentMotionCloneStage;
  phase: ProjectAgentMotionClonePhase;
  status?: string | null;
  referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
  selectedAvatar?: ProjectAgentMotionCloneSelection | null;
  selectedProduct?: ProjectAgentMotionCloneSelection | null;
  photoPrompt?: string | null;
  videoPrompt?: string | null;
  previewImageUrl?: string | null;
  outputVideoUrl?: string | null;
  videoQuality?: '720p' | '1080p' | null;
  durationSeconds?: number | null;
  creditsCost?: number | null;
  error?: string | null;
  promptsInitialized?: boolean;
};

type MotionCloneProjectRow = {
  id?: string | null;
  status?: string | null;
  creator_source_video_id?: string | null;
  reference_video_url?: string | null;
  reference_video_cdn_url?: string | null;
  reference_cover_url?: string | null;
  reference_duration_seconds?: number | null;
  photo_prompt?: string | null;
  video_prompt?: string | null;
  preview_image_url?: string | null;
  output_video_url?: string | null;
  mode?: string | null;
  credits_cost?: number | null;
  error_message?: string | null;
};

export const mapMotionClonePhaseFromStatus = (
  status: unknown
): ProjectAgentMotionClonePhase => {
  switch (status) {
    case 'generating_preview':
      return 'generating_preview';
    case 'preview_ready':
      return 'preview_ready';
    case 'generating_video':
      return 'generating_video';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

export const inferMotionCloneStage = (options?: {
  referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
  selectedAvatar?: ProjectAgentMotionCloneSelection | null;
  explicitStage?: ProjectAgentMotionCloneStage | null;
  phase?: ProjectAgentMotionClonePhase | null;
  previewImageUrl?: string | null;
  outputVideoUrl?: string | null;
}): ProjectAgentMotionCloneStage => {
  const hasWorkspaceArtifacts = (
    options?.explicitStage === 'workspace' ||
    (options?.phase != null && options.phase !== 'idle') ||
    Boolean(options?.previewImageUrl) ||
    Boolean(options?.outputVideoUrl)
  );

  if (hasWorkspaceArtifacts && options?.selectedAvatar?.id) {
    return 'workspace';
  }
  if (options?.referenceVideo?.id) {
    return 'replacement_selection';
  }
  return 'reference_selection';
};

export const inferMotionCloneReferenceContext = (
  analysis: Record<string, unknown> | null | undefined
) => {
  const compact = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const sanitize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const pickFirst = (source: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const candidate = compact(source[key]);
      if (candidate) return candidate;
    }
    return '';
  };

  if (!analysis || typeof analysis !== 'object') {
    return {
      summary: 'Reference video selected, but detailed structure analysis is unavailable.',
      keyShots: [] as string[],
      detectedCharacter: 'no clear character detected',
      detectedProduct: 'no clear product detected'
    };
  }

  const normalizedShots = analysisToLegacyFlatShots(analysis).map((shot, index) => {
    const shotRecord = shot as unknown as Record<string, unknown>;
    const subject = pickFirst(shotRecord, ['subject', 'main_subject', 'character', 'person', 'actor']);
    const action = pickFirst(shotRecord, ['action', 'movement', 'shot_action']);
    const context = pickFirst(shotRecord, ['context_environment', 'environment', 'background', 'setting']);
    const description = pickFirst(shotRecord, ['shot_description', 'description', 'summary', 'first_frame_description']);
    const start = pickFirst(shotRecord, ['start_time', 'start', 'time_start']);
    const end = pickFirst(shotRecord, ['end_time', 'end', 'time_end']);

    const core = sanitize(description || [subject, action, context].filter(Boolean).join(', '));
    const timeRange = (start || end) ? `${start || '??'}-${end || '??'}` : '';

    return {
      shotIndex: index + 1,
      core,
      timeRange
    };
  });

  const keyShots = normalizedShots
    .filter((shot) => Boolean(shot.core))
    .slice(0, 4)
    .map((shot) => {
      const timeSuffix = shot.timeRange ? ` (${shot.timeRange})` : '';
      return `Shot ${shot.shotIndex}${timeSuffix}: ${shot.core}`;
    });

  const allText = JSON.stringify(analysis).toLowerCase().replace(/\s+/g, ' ');
  const findByKeywords = (keywords: string[]) => keywords.find((keyword) => allText.includes(keyword)) || null;
  const detectedCharacter =
    findByKeywords(['baby']) ||
    findByKeywords(['mother']) ||
    findByKeywords(['woman']) ||
    findByKeywords(['female']) ||
    findByKeywords(['man']) ||
    findByKeywords(['male']) ||
    findByKeywords(['person']) ||
    findByKeywords(['child']) ||
    'no clear character detected';

  const detectedProduct =
    findByKeywords(['phone stand']) ||
    findByKeywords(['tripod']) ||
    findByKeywords(['stroller']) ||
    findByKeywords(['toy']) ||
    findByKeywords(['bottle']) ||
    findByKeywords(['device']) ||
    findByKeywords(['book']) ||
    (allText.includes('product') ? 'product (unspecified)' : null) ||
    'no clear product detected';

  const parsedDuration = (analysis as { video_duration_seconds?: unknown }).video_duration_seconds;
  const durationLabel = typeof parsedDuration === 'number' && Number.isFinite(parsedDuration)
    ? `${parsedDuration}s`
    : 'unknown duration';

  const summary =
    keyShots.length > 0
      ? `Parsed ${normalizedShots.length || keyShots.length} shots (${durationLabel}). Main on-screen subject appears to be ${detectedCharacter}; product/object signal: ${detectedProduct}.`
      : `Reference selected (${durationLabel}), but shot-level details are limited. Detected subject: ${detectedCharacter}; product/object signal: ${detectedProduct}.`;

  return { summary, keyShots, detectedCharacter, detectedProduct };
};

export const buildMotionClonePromptDrafts = (options?: {
  avatarName?: string | null;
  productName?: string | null;
  referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
}) => {
  const avatarName = options?.avatarName?.trim() || '';
  const productName = options?.productName?.trim() || '';
  const avatarToken = avatarName ? buildTypedMentionToken({ type: 'character', label: avatarName }) : '';
  const productToken = productName ? buildTypedMentionToken({ type: 'product', label: productName }) : '';
  const imagePrompt = buildMotionClonePreviewPrompt({
    hasAvatar: Boolean(avatarToken),
    hasProduct: Boolean(productToken),
    avatarLabel: avatarToken || null,
    productLabel: productToken || null,
  });
  const videoPrompt = [
    buildMotionCloneVideoPrompt({
      hasAvatar: Boolean(avatarToken),
      hasProduct: Boolean(productToken),
    }),
    avatarToken ? `The on-screen person should be ${avatarToken}.` : '',
    productToken ? `Every visible product or bottle should be ${productToken}.` : '',
  ].filter(Boolean).join(' ');

  return {
    photoPrompt: imagePrompt,
    videoPrompt,
  };
};

export const toMotionCloneExecutionFromProject = (
  project: MotionCloneProjectRow,
  options?: {
    referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
    selectedAvatar?: ProjectAgentMotionCloneSelection | null;
    selectedProduct?: ProjectAgentMotionCloneSelection | null;
  }
): ProjectAgentMotionCloneExecution => ({
  projectId: project.id || null,
  stage: inferMotionCloneStage({
    referenceVideo: options?.referenceVideo || null,
    selectedAvatar: options?.selectedAvatar || null,
  }),
  phase: mapMotionClonePhaseFromStatus(project.status),
  status: project.status || null,
  referenceVideo: options?.referenceVideo || null,
  selectedAvatar: options?.selectedAvatar || null,
  selectedProduct: options?.selectedProduct || null,
  photoPrompt: project.photo_prompt || null,
  videoPrompt: project.video_prompt || null,
  previewImageUrl: project.preview_image_url || null,
  outputVideoUrl: project.output_video_url || null,
  videoQuality: project.mode === '1080p' ? '1080p' : '720p',
  durationSeconds: typeof project.reference_duration_seconds === 'number'
    ? project.reference_duration_seconds
    : null,
  creditsCost: typeof project.credits_cost === 'number' ? project.credits_cost : null,
  error: project.error_message || null,
  promptsInitialized: Boolean(project.photo_prompt || project.video_prompt),
});
