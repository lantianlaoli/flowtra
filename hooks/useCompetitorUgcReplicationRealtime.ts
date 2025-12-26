import { useEffect, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Realtime Hook for Competitor UGC Replication
 *
 * Subscribes to database changes on competitor_ugc_replication_projects and
 * competitor_ugc_replication_segments tables via Supabase Realtime.
 *
 * Replaces polling-based status updates with instant (<1s) event-driven updates.
 *
 * Usage:
 * ```tsx
 * useCompetitorUgcReplicationRealtime(
 *   projectId,
 *   (project) => updateProjectState(project),
 *   (segment) => updateSegmentState(segment)
 * );
 * ```
 */
export function useCompetitorUgcReplicationRealtime(
  projectId: string | undefined,
  onProjectUpdate: (project: Record<string, unknown>) => void,
  onSegmentUpdate: (segment: Record<string, unknown>) => void
) {
  const projectChannelRef = useRef<RealtimeChannel | null>(null);
  const segmentChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const supabase = getSupabase();

    console.log(`[UGC Realtime] Subscribing to project ${projectId}`);

    // Subscribe to project-level updates
    projectChannelRef.current = supabase
      .channel(`ugc-project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'competitor_ugc_replication_projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          console.log('[UGC Realtime] Project update:', payload.new);
          onProjectUpdate(payload.new as Record<string, unknown>);
        }
      )
      .subscribe((status) => {
        console.log(`[UGC Realtime] Project channel status: ${status}`);
      });

    // Subscribe to segment-level updates
    segmentChannelRef.current = supabase
      .channel(`ugc-segments-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'competitor_ugc_replication_segments',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('[UGC Realtime] Segment update:', payload.new);
          onSegmentUpdate(payload.new as Record<string, unknown>);
        }
      )
      .subscribe((status) => {
        console.log(`[UGC Realtime] Segments channel status: ${status}`);
      });

    // Cleanup on unmount or projectId change
    return () => {
      console.log(`[UGC Realtime] Unsubscribing from project ${projectId}`);

      if (projectChannelRef.current) {
        supabase.removeChannel(projectChannelRef.current);
        projectChannelRef.current = null;
      }

      if (segmentChannelRef.current) {
        supabase.removeChannel(segmentChannelRef.current);
        segmentChannelRef.current = null;
      }
    };
  }, [projectId, onProjectUpdate, onSegmentUpdate]);
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

  useEffect(() => {
    if (!projectIds.length) return;

    const supabase = getSupabase();
    const newChannels = new Map<string, RealtimeChannel[]>();

    console.log(`[UGC Realtime] Subscribing to ${projectIds.length} projects`);

    projectIds.forEach((projectId) => {
      const projectChannel = supabase
        .channel(`ugc-project-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'competitor_ugc_replication_projects',
            filter: `id=eq.${projectId}`
          },
          (payload) => {
            console.log(`[UGC Realtime] Project ${projectId} update:`, payload.new);
            onProjectUpdate(projectId, payload.new as Record<string, unknown>);
          }
        )
        .subscribe();

      const segmentChannel = supabase
        .channel(`ugc-segments-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'competitor_ugc_replication_segments',
            filter: `project_id=eq.${projectId}`
          },
          (payload) => {
            console.log(`[UGC Realtime] Segment for project ${projectId} update:`, payload.new);
            onSegmentUpdate(projectId, payload.new as Record<string, unknown>);
          }
        )
        .subscribe();

      newChannels.set(projectId, [projectChannel, segmentChannel]);
    });

    channelsRef.current = newChannels;

    // Cleanup on unmount or projectIds change
    return () => {
      console.log(`[UGC Realtime] Unsubscribing from ${channelsRef.current.size} projects`);

      channelsRef.current.forEach((channels) => {
        channels.forEach((channel) => {
          supabase.removeChannel(channel);
        });
      });

      channelsRef.current.clear();
    };
  }, [JSON.stringify(projectIds), onProjectUpdate, onSegmentUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
}
