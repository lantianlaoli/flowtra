export type MyAdsStatus = 'completed' | 'processing' | 'failed';

export function shouldShowMyAdsTypeFilters(embedded: boolean) {
  return !embedded;
}

export function getMyAdsStatusPresentation(status: MyAdsStatus) {
  if (status === 'completed') return { icon: 'completed' as const, label: 'Completed' };
  if (status === 'processing') return { icon: 'processing' as const, label: 'Processing' };
  return { icon: 'failed' as const, label: 'Failed' };
}
