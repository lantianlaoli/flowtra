import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Custom hook to subscribe to real-time updates for an avatar ads project
 *
 * This hook eliminates the need for polling by using Supabase Realtime subscriptions.
 * Any database updates to the project will be pushed to the frontend instantly.
 *
 * @param projectId - The ID of the project to subscribe to
 * @param onUpdate - Optional callback when project is updated
 * @returns The latest project data from real-time updates
 *
 * @example
 * ```tsx
 * const MyComponent = ({ projectId }) => {
 *   const project = useAvatarAdsRealtime(projectId, (updatedProject) => {
 *     console.log('Project updated:', updatedProject);
 *   });
 *
 *   return <div>Status: {project?.status}</div>;
 * };
 * ```
 */
export function useAvatarAdsRealtime<T = any>(
  projectId: string | null,
  onUpdate?: (project: T) => void
) {
  const [project, setProject] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        // Initial fetch
        const { data, error: fetchError } = await supabase
          .from('avatar_ads_projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (fetchError) {
          console.error('[Avatar Ads Realtime] Initial fetch error:', fetchError);
          setError(fetchError);
          return;
        }

        setProject(data as T);

        // Subscribe to real-time updates
        channel = supabase
          .channel(`avatar-ads-project:${projectId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'avatar_ads_projects',
              filter: `id=eq.${projectId}`,
            },
            (payload) => {
              console.log('[Avatar Ads Realtime] Project updated:', payload.new);
              const updatedProject = payload.new as T;
              setProject(updatedProject);

              if (onUpdate) {
                onUpdate(updatedProject);
              }
            }
          )
          .subscribe((status) => {
            console.log('[Avatar Ads Realtime] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              console.log(`✅ Subscribed to project ${projectId} updates`);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Realtime subscription error');
              setError(new Error('Failed to subscribe to real-time updates'));
            }
          });

      } catch (err) {
        console.error('[Avatar Ads Realtime] Setup error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        console.log('[Avatar Ads Realtime] Unsubscribing from project:', projectId);
        supabase.removeChannel(channel);
      }
    };
  }, [projectId, onUpdate]);

  return { project, error };
}

/**
 * Hook to subscribe to real-time updates for all avatar ads scenes of a project
 *
 * Useful for monitoring individual scene progress (e.g., video generation status)
 *
 * @param projectId - The ID of the project
 * @param onSceneUpdate - Optional callback when a scene is updated
 * @returns Array of scenes with real-time updates
 */
export function useAvatarAdsScenesRealtime<T = any>(
  projectId: string | null,
  onSceneUpdate?: (scene: T) => void
) {
  const [scenes, setScenes] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        // Initial fetch
        const { data, error: fetchError } = await supabase
          .from('avatar_ads_scenes')
          .select('*')
          .eq('project_id', projectId)
          .order('scene_number', { ascending: true });

        if (fetchError) {
          console.error('[Avatar Ads Scenes Realtime] Initial fetch error:', fetchError);
          setError(fetchError);
          return;
        }

        setScenes(data as T[]);

        // Subscribe to real-time updates for all scenes
        channel = supabase
          .channel(`avatar-ads-scenes:${projectId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'avatar_ads_scenes',
              filter: `project_id=eq.${projectId}`,
            },
            (payload) => {
              console.log('[Avatar Ads Scenes Realtime] Scene changed:', payload);

              if (payload.eventType === 'INSERT') {
                setScenes((prev) => [...prev, payload.new as T]);
              } else if (payload.eventType === 'UPDATE') {
                setScenes((prev) =>
                  prev.map((scene: any) =>
                    scene.id === payload.new.id ? (payload.new as T) : scene
                  )
                );

                if (onSceneUpdate) {
                  onSceneUpdate(payload.new as T);
                }
              } else if (payload.eventType === 'DELETE') {
                setScenes((prev) => prev.filter((scene: any) => scene.id !== payload.old.id));
              }
            }
          )
          .subscribe((status) => {
            console.log('[Avatar Ads Scenes Realtime] Subscription status:', status);
          });

      } catch (err) {
        console.error('[Avatar Ads Scenes Realtime] Setup error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };

    setupSubscription();

    // Cleanup
    return () => {
      if (channel) {
        console.log('[Avatar Ads Scenes Realtime] Unsubscribing from scenes:', projectId);
        supabase.removeChannel(channel);
      }
    };
  }, [projectId, onSceneUpdate]);

  return { scenes, error };
}
