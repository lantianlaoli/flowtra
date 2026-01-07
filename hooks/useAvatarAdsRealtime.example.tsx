/**
 * Example: How to replace polling with Supabase Realtime in AvatarAdsPage.tsx
 *
 * ❌ OLD WAY (Polling):
 * - useEffect with setInterval every 8 seconds
 * - Constantly hits API even when nothing changes
 * - Wastes server resources
 *
 * ✅ NEW WAY (Realtime):
 * - Subscribe to database changes
 * - Instant updates (< 1 second)
 * - Zero polling overhead
 */

import { useState } from 'react';
import Image from 'next/image';
import { useAvatarAdsRealtime, useAvatarAdsScenesRealtime } from '@/hooks/useAvatarAdsRealtime';

// ============================================
// Example 1: Single Project Monitoring
// ============================================

export function AvatarAdsProjectMonitor({ projectId }: { projectId: string }) {
  const { project, error } = useAvatarAdsRealtime(projectId, (updatedProject) => {
    console.log('Project updated in real-time!', updatedProject);

    // Show notification when status changes
    if (updatedProject.status === 'completed') {
      alert('✅ Your video is ready!');
    } else if (updatedProject.status === 'failed') {
      alert('❌ Generation failed');
    }
  });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!project) {
    return <div>Loading project...</div>;
  }

  return (
    <div>
      <h2>Project Status: {project.status}</h2>
      <div>Progress: {project.progress_percentage}%</div>
      {project.generated_image_url && (
        <Image
          src={project.generated_image_url}
          alt="Generated"
          width={800}
          height={600}
        />
      )}
      {project.merged_video_url && (
        <video src={project.merged_video_url} controls />
      )}
    </div>
  );
}

// ============================================
// Example 2: Multiple Projects (like AvatarAdsPage.tsx)
// ============================================

export function AvatarAdsMultiProjectMonitor() {
  const [projectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Map<string, any>>(new Map());

  // Create real-time subscriptions for each active project
  const subscriptions = projectIds.map((projectId: string) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAvatarAdsRealtime(projectId, (updatedProject: any) => {
      // Update local state when project changes
      setProjects((prev: Map<string, any>) => new Map(prev).set(projectId, updatedProject));
    });
  });

  return (
    <div>
      <h1>Active Projects ({projectIds.length})</h1>
      {Array.from(projects.values()).map((project: any) => (
        <div key={project.id}>
          <h3>{project.id}</h3>
          <p>Status: {project.status}</p>
          <p>Progress: {project.progress_percentage}%</p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Example 3: Scene-Level Monitoring
// ============================================

export function AvatarAdsScenesMonitor({ projectId }: { projectId: string }) {
  const { scenes, error } = useAvatarAdsScenesRealtime(projectId, (updatedScene) => {
    console.log(`Scene ${updatedScene.scene_number} updated:`, updatedScene.status);
  });

  if (error) return <div>Error loading scenes</div>;

  return (
    <div>
      <h2>Video Scenes</h2>
      {scenes.map((scene: any) => (
        <div key={scene.id}>
          <p>Scene {scene.scene_number}: {scene.status}</p>
          {scene.video_url && <video src={scene.video_url} controls />}
          {scene.error_message && <p style={{ color: 'red' }}>{scene.error_message}</p>}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Example 4: How to modify existing AvatarAdsPage.tsx
// ============================================

/**
 * STEP 1: Import the hook
 */
// import { useAvatarAdsRealtime } from '@/hooks/useAvatarAdsRealtime';

/**
 * STEP 2: Replace polling useEffect with Realtime hook
 */
/*
// ❌ OLD CODE (lines 729-739 in AvatarAdsPage.tsx):
useEffect(() => {
  if (!activeProjectIds.length) return;

  const poll = () => {
    activeProjectIds.forEach((id) => fetchStatusForProject(id));
  };

  poll();
  const interval = setInterval(poll, 8000); // Poll every 8 seconds
  return () => clearInterval(interval);
}, [activeProjectIds, fetchStatusForProject]);

// ✅ NEW CODE (replace with this):
// Subscribe to each active project with Realtime
activeProjectIds.forEach((projectId) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useAvatarAdsRealtime(projectId, (updatedProject) => {
    // Update the generation in local state
    setGenerations((prev) =>
      prev.map((gen) =>
        gen.projectId === projectId
          ? {
              ...gen,
              status: updatedProject.status,
              progress: updatedProject.progress_percentage,
              imageUrl: updatedProject.generated_image_url,
              videoUrl: updatedProject.merged_video_url,
              error: updatedProject.error_message,
            }
          : gen
      )
    );
  });
});
*/

/**
 * STEP 3: Remove fetchStatusForProject function (no longer needed)
 */
/*
// ❌ DELETE THIS (lines ~700-720):
const fetchStatusForProject = useCallback(async (projectId: string) => {
  try {
    const response = await fetch(`/api/avatar-ads/${projectId}/status`);
    // ... polling logic ...
  } catch (error) {
    console.error('Failed to fetch status:', error);
  }
}, [setGenerations]);
*/

/**
 * BENEFITS:
 *
 * 1. ⚡ Instant Updates: Changes appear in < 1 second (vs 8 second polling delay)
 * 2. 💰 Cost Savings: Zero API calls for status checks
 * 3. 🔋 Lower Server Load: No constant polling requests
 * 4. 🎯 Better UX: Users see progress in real-time
 * 5. 🧹 Cleaner Code: No polling intervals to manage
 */
