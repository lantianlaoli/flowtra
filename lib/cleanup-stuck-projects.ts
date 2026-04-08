/**
 * Trigger cleanup for a stuck project
 *
 * Calls the cleanup-timeout API to detect and fix stuck projects.
 * This will:
 * - Mark project as failed
 * - Refund credits
 * - Update frontend state via Realtime
 */
export async function triggerProjectCleanup(): Promise<{ success: boolean; cleaned: number }> {
  try {
    const response = await fetch('/api/video-clone/cleanup-timeout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[triggerProjectCleanup] API returned error:', response.status);
      return { success: false, cleaned: 0 };
    }

    const data = await response.json();
    console.log('[triggerProjectCleanup] Cleanup result:', data);

    return {
      success: data.success || false,
      cleaned: data.cleaned || 0
    };
  } catch (error) {
    console.error('[triggerProjectCleanup] Network error:', error);
    return { success: false, cleaned: 0 };
  }
}
