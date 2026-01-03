import { useEffect, useRef } from 'react';

/**
 * Hook to detect and cleanup stuck projects
 *
 * Monitors project creation time and triggers cleanup if:
 * - Project is in 'processing' status
 * - Created more than 3 minutes ago
 * - Still at 25% or below (no prompts generated)
 *
 * This prevents projects from being stuck indefinitely due to
 * function timeouts in production.
 */
export function useProjectTimeoutDetection(
  projectId: string | undefined,
  status: string | undefined,
  progressPercentage: number | undefined,
  createdAt: string | undefined,
  onTimeoutDetected: () => void
) {
  const hasTriggeredRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset if project changes
    hasTriggeredRef.current = false;

    if (!projectId || !status || !createdAt) {
      return;
    }

    // Only check if project is processing at low progress
    if (status !== 'processing' || (progressPercentage && progressPercentage > 30)) {
      return;
    }

    const checkTimeout = () => {
      if (hasTriggeredRef.current) return;

      const now = Date.now();
      const created = new Date(createdAt).getTime();
      const elapsedMinutes = (now - created) / (1000 * 60);

      // If project has been processing for more than 3 minutes at 25%, it's stuck
      if (elapsedMinutes > 3) {
        console.warn(`[Timeout Detection] Project ${projectId} stuck for ${elapsedMinutes.toFixed(1)} minutes`);
        hasTriggeredRef.current = true;
        onTimeoutDetected();
      }
    };

    // Check immediately
    checkTimeout();

    // Then check every 30 seconds
    timerRef.current = setInterval(checkTimeout, 30000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [projectId, status, progressPercentage, createdAt, onTimeoutDetected]);
}
