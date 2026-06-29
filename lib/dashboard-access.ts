const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function shouldCheckPlanForDashboardEntry(searchParams: {
  upload?: string | null;
}) {
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
