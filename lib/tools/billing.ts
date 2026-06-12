import { checkCredits, deductCredits, recordCreditTransaction, refundCredits } from '@/lib/credits';
import { getUserSubscription } from '@/lib/subscription';
import { checkKieCredits } from '@/lib/kie-credits-check';
export {
  AD_SHORT_FILM_TOTAL_CREDIT_COST,
  IMAGE_GENERATION_CREDIT_COST,
  getImageGenerationCreditCost,
} from '@/lib/tools/billing-constants';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export type ToolBillingFailureCode =
  | 'SUBSCRIPTION_REQUIRED'
  | 'INSUFFICIENT_CREDITS'
  | 'KIE_CREDITS_UNAVAILABLE'
  | 'CREDITS_UNAVAILABLE'
  | 'CHARGE_FAILED';

export type ToolBillingFailure = {
  success: false;
  status: number;
  code: ToolBillingFailureCode;
  error: string;
  requiredCredits: number;
  currentCredits: number | null;
  subscriptionRequired: boolean;
};

export type ToolBillingSuccess = {
  success: true;
  chargedCredits: number;
  remainingCredits: number | null;
};

export type ToolBillingResult = ToolBillingSuccess | ToolBillingFailure;

export function toolBillingErrorPayload(result: ToolBillingFailure) {
  return {
    error: result.error,
    code: result.code,
    requiredCredits: result.requiredCredits,
    currentCredits: result.currentCredits,
    subscriptionRequired: result.subscriptionRequired,
  };
}

export async function chargeToolGenerationCredits(input: {
  userId: string;
  amount: number;
  description: string;
  historyId?: string;
}): Promise<ToolBillingResult> {
  const requiredCredits = Math.max(0, Math.floor(input.amount));

  // Schema verified via Supabase MCP (2026-05-13):
  // user_subscriptions has user_id/status; user_credits has user_id/credits_remaining;
  // credit_transactions has user_id/type/amount/description/history_id.
  const subscriptionResult = await getUserSubscription(input.userId);
  const subscription = subscriptionResult.subscription;
  const hasActiveSubscription =
    !!subscription?.status && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);

  if (!hasActiveSubscription) {
    return {
      success: false,
      status: 402,
      code: 'SUBSCRIPTION_REQUIRED',
      error: 'An active subscription is required to use this generation tool.',
      requiredCredits,
      currentCredits: null,
      subscriptionRequired: true,
    };
  }

  const creditCheck = await checkCredits(input.userId, requiredCredits);
  if (!creditCheck.success) {
    return {
      success: false,
      status: 500,
      code: 'CREDITS_UNAVAILABLE',
      error: creditCheck.error || 'Failed to check credits.',
      requiredCredits,
      currentCredits: creditCheck.currentCredits ?? null,
      subscriptionRequired: false,
    };
  }

  if (!creditCheck.hasEnoughCredits) {
    return {
      success: false,
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      error: `Insufficient credits: need ${requiredCredits}, have ${creditCheck.currentCredits || 0}.`,
      requiredCredits,
      currentCredits: creditCheck.currentCredits ?? 0,
      subscriptionRequired: false,
    };
  }

  const kieCreditCheck = await checkKieCredits();
  if (!kieCreditCheck.sufficient) {
    return {
      success: false,
      status: 503,
      code: 'KIE_CREDITS_UNAVAILABLE',
      error: kieCreditCheck.error || 'AI generation service credits are temporarily unavailable.',
      requiredCredits,
      currentCredits: creditCheck.currentCredits ?? null,
      subscriptionRequired: false,
    };
  }

  const deduction = await deductCredits(input.userId, requiredCredits);
  if (!deduction.success) {
    return {
      success: false,
      status: 500,
      code: 'CHARGE_FAILED',
      error: deduction.error || 'Failed to deduct credits.',
      requiredCredits,
      currentCredits: creditCheck.currentCredits ?? null,
      subscriptionRequired: false,
    };
  }

  const transaction = await recordCreditTransaction(
    input.userId,
    'usage',
    requiredCredits,
    input.description,
    input.historyId,
    true
  );

  if (!transaction.success) {
    await deductCredits(input.userId, -requiredCredits);
    return {
      success: false,
      status: 500,
      code: 'CHARGE_FAILED',
      error: transaction.error || 'Failed to record credit transaction.',
      requiredCredits,
      currentCredits: deduction.remainingCredits ?? null,
      subscriptionRequired: false,
    };
  }

  return {
    success: true,
    chargedCredits: requiredCredits,
    remainingCredits: deduction.remainingCredits ?? null,
  };
}

export async function requireActiveToolSubscription(userId: string): Promise<ToolBillingSuccess | ToolBillingFailure> {
  // Schema verified via Supabase MCP (2026-06-01):
  // user_subscriptions has user_id/status; active tool access accepts active/trialing only.
  const subscriptionResult = await getUserSubscription(userId);
  const subscription = subscriptionResult.subscription;
  const hasActiveSubscription =
    !!subscription?.status && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);

  if (!hasActiveSubscription) {
    return {
      success: false,
      status: 402,
      code: 'SUBSCRIPTION_REQUIRED',
      error: 'An active subscription is required to use this generation tool.',
      requiredCredits: 0,
      currentCredits: null,
      subscriptionRequired: true,
    };
  }

  return {
    success: true,
    chargedCredits: 0,
    remainingCredits: null,
  };
}

export async function refundToolGenerationCredits(input: {
  userId: string;
  amount: number;
  reason: string;
  historyId?: string;
}) {
  const amount = Math.max(0, Math.floor(input.amount));
  if (amount <= 0) return { success: true as const };

  return refundCredits(input.userId, amount, input.reason, input.historyId);
}
