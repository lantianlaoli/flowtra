export const CHARACTER_ADS_SIMULATION_SEQUENCE = [
  {
    status: 'pending',
    step: 'analyzing_images',
    progress: 0,
    message: 'Initializing character spokesperson workflow...'
  },
  {
    status: 'analyzing_images',
    step: 'analyzing_images',
    progress: 15,
    message: 'Analyzing uploaded character and product photos...'
  },
  {
    status: 'generating_prompts',
    step: 'generating_prompts',
    progress: 35,
    message: 'Drafting spokesperson talking points and scene prompts...'
  },
  {
    status: 'generating_image',
    step: 'generating_image',
    progress: 55,
    message: 'Rendering hero image for the spokesperson advertisement...'
  },
  {
    status: 'generating_videos',
    step: 'generating_videos',
    progress: 75,
    message: 'Producing spokesperson video scenes with dialogue...'
  },
  {
    status: 'merging_videos',
    step: 'merging_videos',
    progress: 90,
    message: 'Merging video scenes and finalizing the spokesperson ad...'
  },
  {
    status: 'completed',
    step: 'completed',
    progress: 100,
    message: 'Character spokesperson advertisement is ready to download.'
  }
] as const;
// The events table has been removed. This module now only provides
// the in-memory sequence used for UI stage mapping.
