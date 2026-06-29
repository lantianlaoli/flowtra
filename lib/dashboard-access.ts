const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function shouldCheckPlanForDashboardEntry(searchParams: {
  upload?: string | null;
  preview?: string | null;
}) {
  // preview=1 means the user came from the Explore card on /select-plan — let
  // them see the dashboard UI without an active plan. Actual generation is
  // still gated by /api/credits/check at action time.
  if (searchParams.preview === '1' || searchParams.preview === 'true') {
    return false;
  }
  return searchParams.upload === 'true';
}

export function shouldRedirectDashboardEntryToSelectPlan(input: {
  isLandingUploadEntry: boolean;
  subscriptionStatus?: string | null;
  creditsRemaining?: number | null;
}) {
  if (!input.isLandingUploadEntry) return false;
  return !input.subscriptionStatus || !ACTIVE_SUBSCRIPTION_STATUSES.has(input.subscriptionStatus);
}
