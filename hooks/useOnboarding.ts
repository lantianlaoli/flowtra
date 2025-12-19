import { useState, useEffect, useCallback } from 'react';

// Force show onboarding for all users when set to 'true' (useful for testing/demo)
const FORCE_SHOW_ONBOARDING =
  process.env.NEXT_PUBLIC_FORCE_SHOW_ONBOARDING === 'true';

export interface OnboardingStatus {
  completed: boolean;
  current_step: number;
  loading: boolean;
  error: string | null;
}

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus>({
    completed: false,
    current_step: 0,
    loading: true,
    error: null,
  });

  // Fetch onboarding status
  const fetchStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      const response = await fetch('/api/onboarding/status');

      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status');
      }

      const data = await response.json();
      setStatus({
        completed: FORCE_SHOW_ONBOARDING ? false : (data.completed || false),
        current_step: FORCE_SHOW_ONBOARDING ? 0 : (data.current_step || 0),
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      setStatus(prev => ({ ...prev, completed: true }));
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return false;
    }
  }, []);

  // Reset onboarding (for manual re-trigger)
  const resetOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset onboarding');
      }

      setStatus({
        completed: false,
        current_step: 0,
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      return false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    fetchStatus,
    completeOnboarding,
    resetOnboarding,
  };
}
