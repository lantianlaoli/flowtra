/**
 * Rate Limiting Utilities
 *
 * Session storage-based rate limiting for showcase video analysis feature.
 * Limits users to 1 free analysis per browser session.
 */

const STORAGE_KEY = 'flowtra_free_analysis_used';

/**
 * Check if user has used their free analysis
 * @returns true if user has already used their free analysis
 */
export function hasUsedFreeAnalysis(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('[rate-limit] Failed to check storage:', error);
    return false;
  }
}

/**
 * Mark free analysis as used
 */
export function setFreeAnalysisUsed(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    console.log('[rate-limit] Free analysis marked as used');
  } catch (error) {
    console.error('[rate-limit] Failed to set storage:', error);
  }
}

/**
 * Reset free analysis limit (for testing or admin override)
 */
export function resetFreeAnalysisLimit(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('[rate-limit] Free analysis limit reset');
  } catch (error) {
    console.error('[rate-limit] Failed to reset storage:', error);
  }
}
