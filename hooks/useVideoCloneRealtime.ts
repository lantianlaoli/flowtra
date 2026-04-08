import { useEffect, useRef } from 'react';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Realtime Hook for Video Clone
 *
 * Subscribes to database changes on video_clone_projects and
 * video_clone_segments tables via Supabase Realtime.
 *
 * Replaces polling-based status updates with instant (<1s) event-driven updates.
 *
 * Usage:
 * ```tsx
 * useVideoCloneRealtime(
 *   projectId,
 *   (project) => updateProjectState(project),
 *   (segment) => updateSegmentState(segment)
 * );
 * ```
 */
export function useVideoCloneRealtime(
  projectId: string | undefined,
  onProjectUpdate: (project: Record<string, unknown>) => void,
  onSegmentUpdate: (segment: Record<string, unknown>) => void
) {
  const projectChannelRef = useRef<RealtimeChannel | null>(null);
  const segmentChannelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useSupabaseBrowserClient();

  useEffect(() => {
    if (!projectId) return;

    console.log(`[Video Clone Realtime] Subscribing to project ${projectId}`);

    // Subscribe to project-level updates
    projectChannelRef.current = supabase
      .channel(`video-clone-project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_clone_projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          console.log('[Video Clone Realtime] Project update:', payload.new);
          onProjectUpdate(payload.new as Record<string, unknown>);
        }
      )
      .subscribe((status) => {
        console.log(`[Video Clone Realtime] Project channel status: ${status}`);
      });

    // Subscribe to segment-level updates
    segmentChannelRef.current = supabase
      .channel(`video-clone-segments-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_clone_segments',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('[Video Clone Realtime] Segment update:', payload.new);
          onSegmentUpdate(payload.new as Record<string, unknown>);
        }
      )
      .subscribe((status) => {
        console.log(`[Video Clone Realtime] Segments channel status: ${status}`);
      });

    // Cleanup on unmount or projectId change
    return () => {
      console.log(`[Video Clone Realtime] Unsubscribing from project ${projectId}`);

      if (projectChannelRef.current) {
        supabase.removeChannel(projectChannelRef.current);
        projectChannelRef.current = null;
      }

      if (segmentChannelRef.current) {
        supabase.removeChannel(segmentChannelRef.current);
        segmentChannelRef.current = null;
      }
    };
  }, [onProjectUpdate, onSegmentUpdate, projectId, supabase]);
}

/**
 * Hook for multiple active projects
 *
 * Manages Realtime subscriptions for multiple projects at once.
 * Useful for history/dashboard pages with multiple active generations.
 *
 * Usage:
 * ```tsx
 * useMultipleProjectsRealtime(
 *   activeProjectIds,
 *   (projectId, project) => updateProject(projectId, project),
 *   (projectId, segment) => updateSegment(projectId, segment)
 * );
 * ```
 */
export function useMultipleProjectsRealtime(
  projectIds: string[],
  onProjectUpdate: (projectId: string, project: Record<string, unknown>) => void,
  onSegmentUpdate: (projectId: string, segment: Record<string, unknown>) => void
) {
  const channelsRef = useRef<Map<string, RealtimeChannel[]>>(new Map());
  const supabase = useSupabaseBrowserClient();

  useEffect(() => {
    if (!projectIds.length) return;

    const newChannels = new Map<string, RealtimeChannel[]>();

    console.log(`[Video Clone Realtime] Subscribing to ${projectIds.length} projects`);

    projectIds.forEach((projectId) => {
      const projectChannel = supabase
        .channel(`video-clone-project-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_clone_projects',
            filter: `id=eq.${projectId}`
          },
          (payload) => {
            console.log(`[Video Clone Realtime] Project ${projectId} update:`, payload.new);
            onProjectUpdate(projectId, payload.new as Record<string, unknown>);
          }
        )
        .subscribe();

      const segmentChannel = supabase
        .channel(`video-clone-segments-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_clone_segments',
            filter: `project_id=eq.${projectId}`
          },
          (payload) => {
            console.log(`[Video Clone Realtime] Segment for project ${projectId} update:`, payload.new);
            onSegmentUpdate(projectId, payload.new as Record<string, unknown>);
          }
        )
        .subscribe();

      newChannels.set(projectId, [projectChannel, segmentChannel]);
    });

    channelsRef.current = newChannels;

    // Cleanup on unmount or projectIds change
    return () => {
      console.log(`[Video Clone Realtime] Unsubscribing from ${channelsRef.current.size} projects`);

      channelsRef.current.forEach((channels) => {
        channels.forEach((channel) => {
          supabase.removeChannel(channel);
        });
      });

      channelsRef.current.clear();
    };
  }, [JSON.stringify(projectIds), onProjectUpdate, onSegmentUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
}
