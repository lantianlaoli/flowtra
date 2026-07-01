type MotionClonePromptOptions = {
  hasAvatar?: boolean;
  avatarLabel?: string | null;
};

const getReplacementLabel = (
  explicitLabel: string | null | undefined,
  fallback: string,
) => {
  const normalized = explicitLabel?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

export const buildMotionClonePreviewPrompt = (options?: MotionClonePromptOptions) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const avatarLabel = getReplacementLabel(options?.avatarLabel, 'the replacement person');
  const replacementLine = hasAvatar
    ? `Replace only the on-screen person with ${avatarLabel} from image 2. Preserve every product, prop, bottle, and non-character scene element.`
    : 'Preserve the original person, product, props, and scene elements.';

  return [
    'Motion Clone preview: use image 1 as the authoritative base frame.',
    replacementLine,
    'Image 1 must control the composition, pose, hand placement, occlusion, camera angle, framing, lighting, background, overlays, and color grading.',
    'Preserve all non-target props, tools, handheld objects, hand-object interactions, wardrobe details, and every untouched scene element exactly as they appear in image 1.',
    'Use image 2 only as the replacement identity reference. Do not use it as the style, composition, pose, framing, or lighting baseline.',
    'Do not remove or redesign any non-target object. Do not restyle the frame. Change only the explicitly targeted person.'
  ].join(' ');
};

export const buildMotionCloneVideoPrompt = (_options?: MotionClonePromptOptions) =>
  'No distortion, the character\'s movements are consistent with the video.';
