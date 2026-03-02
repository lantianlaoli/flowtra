import type { WorkspaceScene, WorkspaceShot } from '@/components/project-agent/CloneSceneWorkspaceStep';

type DraftVideoShotLike = {
  id?: number;
  time_range?: string;
  subject?: string;
  context_environment?: string;
  action?: string;
  style?: string;
  camera_motion_positioning?: string;
  composition?: string;
  ambiance_colour_lighting?: string;
  audio?: string;
  dialogue?: string;
  language?: string;
};

type DraftSceneLike = {
  sceneIndex: number;
  imagePrompt?: string;
  isContinuation?: boolean;
  sourceSummary?: string | null;
  videoPrompt?: string | { shots?: DraftVideoShotLike[] };
};

type SegmentPromptLike = {
  first_frame_description?: string;
  is_continuation_from_prev?: boolean;
  shots?: DraftVideoShotLike[];
};

type ExecutionSegmentLike = {
  segmentIndex: number;
  status: string;
  firstFrameUrl?: string | null;
  videoUrl?: string | null;
  errorMessage?: string | null;
  prompt?: SegmentPromptLike;
};

const DEFAULT_SHOT: WorkspaceShot = {
  id: 1,
  time_range: '00:00 - 00:08',
  subject: '',
  context_environment: '',
  action: '',
  style: '',
  camera_motion_positioning: '',
  composition: '',
  ambiance_colour_lighting: '',
  audio: '',
  dialogue: '',
  language: 'en'
};

const normalizeShot = (shot: DraftVideoShotLike, index: number, fallbackLanguage: string): WorkspaceShot => ({
  id: Number.isFinite(shot.id) && Number(shot.id) > 0 ? Number(shot.id) : index + 1,
  time_range: shot.time_range || '00:00 - 00:08',
  subject: shot.subject || '',
  context_environment: shot.context_environment || '',
  action: shot.action || '',
  style: shot.style || '',
  camera_motion_positioning: shot.camera_motion_positioning || '',
  composition: shot.composition || '',
  ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
  audio: shot.audio || '',
  dialogue: shot.dialogue || '',
  language: shot.language || fallbackLanguage
});

const segmentPromptToWorkspaceShots = (prompt: SegmentPromptLike | undefined, fallbackLanguage: string): WorkspaceShot[] => {
  if (!prompt?.shots?.length) {
    return [{ ...DEFAULT_SHOT, language: fallbackLanguage }];
  }
  return prompt.shots.map((shot, index) => normalizeShot(shot, index, fallbackLanguage));
};

const draftSceneToWorkspaceShots = (scene: DraftSceneLike | undefined, fallbackLanguage: string): WorkspaceShot[] => {
  if (!scene) return [{ ...DEFAULT_SHOT, language: fallbackLanguage }];
  if (typeof scene.videoPrompt === 'string') {
    return [{
      ...DEFAULT_SHOT,
      subject: scene.videoPrompt,
      language: fallbackLanguage
    }];
  }
  const shots = scene.videoPrompt?.shots || [];
  if (!shots.length) {
    return [{ ...DEFAULT_SHOT, language: fallbackLanguage }];
  }
  return shots.map((shot, index) => normalizeShot(shot, index, fallbackLanguage));
};

export const buildWorkspaceScenes = (input: {
  draftScenes: DraftSceneLike[];
  executionSegments: ExecutionSegmentLike[];
  fallbackLanguage: string;
}): WorkspaceScene[] => {
  const { draftScenes, executionSegments, fallbackLanguage } = input;
  const segmentBySceneIndex = new Map(executionSegments.map((segment) => [segment.segmentIndex + 1, segment]));
  const allSceneIndexes = new Set<number>();

  draftScenes.forEach((scene) => allSceneIndexes.add(scene.sceneIndex));
  executionSegments.forEach((segment) => allSceneIndexes.add(segment.segmentIndex + 1));

  return Array.from(allSceneIndexes)
    .sort((a, b) => a - b)
    .map((sceneIndex) => {
      const draftScene = draftScenes.find((scene) => scene.sceneIndex === sceneIndex);
      const segment = segmentBySceneIndex.get(sceneIndex);
      const promptFromSegment = segment?.prompt;

      const imagePrompt = (draftScene?.imagePrompt || '').trim()
        ? (draftScene?.imagePrompt || '')
        : (promptFromSegment?.first_frame_description || '');

      const shots = draftScene
        ? draftSceneToWorkspaceShots(draftScene, fallbackLanguage)
        : segmentPromptToWorkspaceShots(promptFromSegment, fallbackLanguage);

      return {
        sceneIndex,
        sourceSummary: draftScene?.sourceSummary ?? null,
        imagePrompt,
        shots,
        frameUrl: segment?.firstFrameUrl ?? null,
        videoUrl: segment?.videoUrl ?? null,
        frameError: (segment?.status === 'failed' && !segment?.videoUrl)
          ? (segment?.errorMessage ?? null)
          : null,
        videoError: (segment?.status === 'failed' && Boolean(segment?.firstFrameUrl))
          ? (segment?.errorMessage ?? null)
          : null,
        segmentStatus: segment?.status ?? null,
        isContinuation: sceneIndex === 1
          ? false
          : typeof draftScene?.isContinuation === 'boolean'
            ? draftScene.isContinuation
            : typeof promptFromSegment?.is_continuation_from_prev === 'boolean'
              ? promptFromSegment.is_continuation_from_prev
              : sceneIndex > 1
      };
    });
};
