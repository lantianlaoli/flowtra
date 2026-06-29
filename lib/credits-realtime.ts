export const CREDIT_BALANCE_REALTIME_EVENTS = ['INSERT', 'UPDATE'] as const;

export function readCreditsRealtimeBalance(payloadNew: unknown) {
  if (!payloadNew || typeof payloadNew !== 'object') return undefined;
  const value = (payloadNew as { credits_remaining?: unknown }).credits_remaining;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
