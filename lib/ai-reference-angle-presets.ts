import type { AiReferenceAngleAssetType } from './ai-reference-angle-jobs';

export type SourceAspect = 'portrait' | 'square' | 'landscape';

export type AnglePreset = {
  key: string;
  label: string;
  prompt: string;
};

const STYLE_LOCK_SUFFIX = [
  'Maintain exact stylistic consistency with the reference image.',
  'Preserve the original visual medium, rendering approach, and image character.',
  'If the reference image is an illustration, animation frame, painting, sketch, 3D render, product render, or casual mobile photo, retain that format rather than converting it into a different visual style.',
  'Preserve the original color palette, lighting quality, tonal balance, contrast, saturation, texture treatment, and background atmosphere.',
  'Do not restyle, embellish, beautify, or reinterpret the reference.'
].join(' ');

function withStyleLock(prompt: string) {
  return `${prompt} ${STYLE_LOCK_SUFFIX}`;
}

const CAMERA_LEFT_DEFINITION =
  'Stand at the left-front side of the subject, facing diagonally toward the front-right corner. The image must show the front face plus the left side plane of the subject, with the left side plane clearly visible. Do not return a rear view, back view, centered side view, near-frontal view, or mirrored right-side view.';

const CAMERA_RIGHT_DEFINITION =
  'Stand at the right-front side of the subject, facing diagonally toward the front-left corner. The image must show the front face plus the right side plane of the subject, with the right side plane clearly visible. Do not return a rear view, back view, centered side view, near-frontal view, or mirrored left-side view.';

export const ANGLE_PRESETS: Record<AiReferenceAngleAssetType, AnglePreset[]> = {
  product: [
    {
      key: 'front_left_45',
      label: '45° Front Left',
      prompt: withStyleLock(
        `Generate the same product from a 45-degree front-left perspective. ${CAMERA_LEFT_DEFINITION} The front label, front face, or front-facing design must remain visible while the left-side depth is visible. The rear panel must not be visible or dominant. Preserve the exact product identity, materials, labels, colors, proportions, and compositional structure. Maintain a clean background and high visual fidelity.`
      )
    },
    {
      key: 'front_right_45',
      label: '45° Front Right',
      prompt: withStyleLock(
        `Generate the same product from a 45-degree front-right perspective. ${CAMERA_RIGHT_DEFINITION} Show the right-front plane and right-side depth more prominently than the left side. Preserve the exact product identity, materials, labels, colors, proportions, and compositional structure. Maintain a clean background and high visual fidelity.`
      )
    },
    {
      key: 'back_view',
      label: 'Back View',
      prompt: withStyleLock(
        'Generate the same product from a centered rear view. The camera is directly behind the product, perpendicular to the back panel. The back face, rear label, rear packaging details, or rear instructions must be dominant. Do not generate a 45-degree front-left, 45-degree front-right, side profile, or any view where the front face is visible. Preserve the exact product identity, shape language, materials, labels, and design details. Maintain a clean background and high visual fidelity.'
      )
    }
  ],
  avatar: [
    {
      key: 'left_45_portrait',
      label: '45° Left Portrait',
      prompt: withStyleLock(
        `Generate the same person from a 45-degree left portrait angle. ${CAMERA_LEFT_DEFINITION} The viewer should see more of the left cheek, left jawline, and left ear than the right side of the face. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.`
      )
    },
    {
      key: 'right_45_portrait',
      label: '45° Right Portrait',
      prompt: withStyleLock(
        `Generate the same person from a 45-degree right portrait angle. ${CAMERA_RIGHT_DEFINITION} The viewer should see more of the right cheek, right jawline, and right ear than the left side of the face. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.`
      )
    },
    {
      key: 'side_profile',
      label: 'Side Profile',
      prompt: withStyleLock(
        'Generate a side-profile portrait of the same person. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.'
      )
    }
  ],
  universal: [
    {
      key: 'front_left_45',
      label: '45° Front Left',
      prompt: withStyleLock(
        `Generate the same subject, object, or entity from a 45-degree front-left perspective. ${CAMERA_LEFT_DEFINITION} Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.`
      )
    },
    {
      key: 'front_right_45',
      label: '45° Front Right',
      prompt: withStyleLock(
        `Generate the same subject, object, or entity from a 45-degree front-right perspective. ${CAMERA_RIGHT_DEFINITION} Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.`
      )
    },
    {
      key: 'back_view',
      label: 'Back View',
      prompt: withStyleLock(
        'Generate a centered rear-view image of the same subject, object, or entity. Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.'
      )
    }
  ]
};

export function selectAnglePresets(
  assetType: AiReferenceAngleAssetType,
  existingReferenceCount: number,
  count: number
) {
  return ANGLE_PRESETS[assetType].slice(existingReferenceCount, existingReferenceCount + count);
}

export function getUniversalImageSize(sourceAspect?: SourceAspect): '9:16' | '1:1' {
  return sourceAspect === 'portrait' ? '9:16' : '1:1';
}

export function getReferenceAngleAspectRatio(
  assetType: AiReferenceAngleAssetType,
  sourceAspect?: SourceAspect
): '9:16' | '1:1' {
  if (assetType === 'avatar') return '9:16';
  if (assetType === 'product') return '1:1';
  return getUniversalImageSize(sourceAspect);
}
