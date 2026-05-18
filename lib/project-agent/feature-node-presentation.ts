import type { ProjectAgentFeatureNodeType } from '@/lib/project-agent/canvas-state';

export type ProjectAgentFeatureTitleIcon =
  | 'copy_plus'
  | 'sparkles'
  | 'wand_sparkles';

export const getFeatureNodePresentation = (
  type: ProjectAgentFeatureNodeType
) => {
  switch (type) {
    case 'video_clone':
      return { titleIcon: 'copy_plus' as const, modelBarTone: 'dark' as const, titleIconTone: 'inherit' as const };
    case 'avatar_ads':
      return { titleIcon: 'sparkles' as const, modelBarTone: 'dark' as const, titleIconTone: 'inherit' as const };
    case 'motion_clone':
      return { titleIcon: 'wand_sparkles' as const, modelBarTone: 'dark' as const, titleIconTone: 'inherit' as const };
    default:
      return { titleIcon: 'sparkles' as const, modelBarTone: 'dark' as const, titleIconTone: 'inherit' as const };
  }
};
