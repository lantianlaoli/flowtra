export const MERGE_CONFIRMATION_TOKEN = '确认合并';

export const isMergeIntentCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /\b(merge|stitch|finali[sz]e)\b[\s\w-]{0,24}\b(video|videos)\b/.test(normalized) ||
    /^(merge|stitch|combine|finali[sz]e)\s+(them|it|all|everything|clips|segments)\b/.test(normalized) ||
    /^(merge|stitch|combine)\s+now\b/.test(normalized) ||
    /合并.*视频|拼接.*视频|导出.*视频/.test(text)
  );
};

export const isMergeConfirmationCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    text.trim() === MERGE_CONFIRMATION_TOKEN ||
    /^(confirm merge|merge confirmed|yes merge)$/i.test(normalized)
  );
};

export const isRegenerateVideoCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /regenerate\s+(scene|shot|segment)\s*#?\s*\d+[\s\w-]{0,12}\bvideo\b/i.test(normalized) ||
    /regenerate\s*#?\s*\d+\s*(scene|shot|segment)[\s\w-]{0,12}\bvideo\b/i.test(normalized) ||
    /重生成.*第?\s*\d+\s*(个|场|段)?.*视频/.test(text)
  );
};

export const isStartVideoGenerationCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /^start\s+(video|videos?)\s+generation/.test(normalized) ||
    /^start\s+(generate|generating)\s+(video|videos?)/.test(normalized) ||
    /^generate\s+(video|videos?)/.test(normalized) ||
    /^start\s+video\b/.test(normalized) ||
    /^begin\s+(video|videos?)/.test(normalized) ||
    /\b(start|begin|run|generate|render)\b[\s\w-]{0,24}\b(video|videos)\b/.test(normalized) ||
    /开始.*视频|生成.*视频|开始视频生成/.test(text)
  );
};

type ClonePhase = 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';

export const mapClonePhaseFromStatusPayload = (payload: Record<string, unknown>): ClonePhase => {
  const data = (payload.data && typeof payload.data === 'object') ? payload.data as Record<string, unknown> : {};
  const step = typeof payload.current_step === 'string' ? payload.current_step : '';
  const status = typeof payload.status === 'string' ? payload.status : '';
  const mergeTaskId = typeof data.mergeTaskId === 'string' ? data.mergeTaskId : '';

  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (step === 'merging_segments' || Boolean(mergeTaskId)) return 'merging';
  if (step === 'awaiting_merge' || status === 'awaiting_merge') return 'awaiting_merge';

  const segmentStatus = (data.segmentStatus && typeof data.segmentStatus === 'object')
    ? data.segmentStatus as Record<string, unknown>
    : null;
  const total = Number(segmentStatus?.total ?? 0);
  const framesReady = Number(segmentStatus?.framesReady ?? 0);
  const videosReady = Number(segmentStatus?.videosReady ?? 0);
  const videoGenerationRequested = Boolean(data.videoGenerationRequested);

  if (
    step === 'generating_segment_videos' ||
    step === 'ready_for_video' ||
    step === 'generating_video' ||
    videosReady > 0 ||
    videoGenerationRequested
  ) {
    return 'generating_videos';
  }

  if (total > 0 && framesReady === total && videosReady < total) {
    return 'reviewing_frames';
  }

  return 'generating_frames';
};
