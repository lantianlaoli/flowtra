import { getSupabaseAdmin } from '@/lib/supabase';

export interface CharacterAdsProjectEventRow {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  current_step: string | null;
  progress_percentage: number | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordCharacterAdsEventOptions {
  projectId: string;
  userId: string;
  status: string;
  currentStep?: string | null;
  progressPercentage?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  isSimulated?: boolean;
}

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

export async function recordCharacterAdsEvent(options: RecordCharacterAdsEventOptions): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('character_ads_project_events')
      .insert({
        project_id: options.projectId,
        user_id: options.userId,
        status: options.status,
        current_step: options.currentStep ?? null,
        progress_percentage: options.progressPercentage ?? null,
        message: options.message ?? null,
        metadata: options.metadata ?? null,
        is_simulated: options.isSimulated ?? false
      });

    if (error) {
      console.error('Failed to record character ads project event', error);
    }
  } catch (error) {
    console.error('Unexpected error while recording character ads project event', error);
  }
}

export function getNextSimulatedCharacterAdsEvent(currentStatus?: string | null) {
  const totalStates = CHARACTER_ADS_SIMULATION_SEQUENCE.length;

  if (!totalStates) {
    return null;
  }

  const currentIndex = currentStatus
    ? CHARACTER_ADS_SIMULATION_SEQUENCE.findIndex((entry) => entry.status === currentStatus)
    : -1;

  if (currentIndex >= totalStates - 1) {
    return null;
  }

  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  return CHARACTER_ADS_SIMULATION_SEQUENCE[nextIndex];
}

export async function createSimulatedCharacterAdsEvent(params: {
  projectId: string;
  userId: string;
  latestStatus?: string | null;
  additionalMetadata?: Record<string, unknown>;
}): Promise<CharacterAdsProjectEventRow | null> {
  const nextEvent = getNextSimulatedCharacterAdsEvent(params.latestStatus);

  if (!nextEvent) {
    return null;
  }

  const metadata = {
    source: 'simulation',
    previous_status: params.latestStatus ?? null,
    ...params.additionalMetadata,
  } as Record<string, unknown>;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('character_ads_project_events')
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      status: nextEvent.status,
      current_step: nextEvent.step,
      progress_percentage: nextEvent.progress,
      message: nextEvent.message,
      metadata,
      is_simulated: true
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create simulated character ads project event', error);
    return null;
  }

  return data as CharacterAdsProjectEventRow;
}
