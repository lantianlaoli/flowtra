type MotionClonePromptOptions = {
  hasAvatar?: boolean;
  hasProduct?: boolean;
  avatarLabel?: string | null;
  productLabel?: string | null;
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
  const hasProduct = options?.hasProduct ?? true;
  const avatarLabel = getReplacementLabel(options?.avatarLabel, 'the replacement person');
  const productLabel = getReplacementLabel(options?.productLabel, 'the replacement product');

  const replacementLine = hasAvatar && hasProduct
    ? `Replace the on-screen person with ${avatarLabel} from image 2. Replace every visible product or bottle with ${productLabel} from image 3.`
    : hasAvatar
      ? `Replace only the on-screen person with ${avatarLabel} from image 2. Preserve the original product or bottle.`
      : `Replace only every visible product or bottle with ${productLabel} from image 2. Preserve the original person.`;

  return [
    'Motion Clone preview: use image 1 as the authoritative base frame.',
    replacementLine,
    'Image 1 must control the composition, pose, hand placement, occlusion, camera angle, framing, lighting, background, overlays, and color grading.',
    'Preserve all non-target props, tools, handheld objects, hand-object interactions, wardrobe details, and every untouched scene element exactly as they appear in image 1.',
    'Use image 2 and image 3 only as replacement identity references. Do not use them as the style, composition, pose, framing, or lighting baseline.',
    'Do not remove or redesign any non-target object. Do not restyle the frame. Change only the explicitly targeted person and/or product.'
  ].join(' ');
};

export const buildMotionCloneVideoPrompt = (options?: MotionClonePromptOptions) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const hasProduct = options?.hasProduct ?? true;
  const guidance = hasAvatar && hasProduct
    ? 'Use the swapped preview image as the appearance guide only for the targeted person and product.'
    : hasAvatar
      ? 'Use the swapped preview image as the appearance guide only for the targeted person.'
      : 'Use the swapped preview image as the appearance guide only for the targeted product.';
  return [
    'Motion Clone video:',
    guidance,
    'Preserve the original motion, background, lighting, framing, hand placement, props, tools, and all untouched scene elements from the reference video.',
    'Do not reinterpret the scene based on the replacement references. Change only the explicitly targeted person and/or product.'
  ].join(' ');
};
