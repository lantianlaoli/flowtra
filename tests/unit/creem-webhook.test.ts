import test from 'node:test'
import assert from 'node:assert/strict'

import { clearTrialCreditsOnCancellation } from '../../lib/subscription'

type SupabaseTableMock = {
  select?: () => SupabaseTableMock
  update?: (values: Record<string, unknown>) => SupabaseTableMock
  eq?: (
    column: string,
    value: string
  ) => SupabaseTableMock | Promise<{ data?: any; error: any }>
  single?: () => Promise<{ data?: any; error: any }>
}

function createSupabaseMock({
  subscriptionStatus,
  creditsRemaining
}: {
  subscriptionStatus: string
  creditsRemaining: number
}) {
  return {
    from(table: string): SupabaseTableMock {
      if (table === 'user_subscriptions') {
        const chain: SupabaseTableMock = {
          select() {
            return chain
          },
          eq() {
            return chain
          },
          async single() {
            return {
              data: { id: 'sub-1', status: subscriptionStatus },
              error: null
            }
          }
        }
        return chain
      }

      if (table === 'user_credits') {
        const selectChain: SupabaseTableMock = {
          select() {
            return selectChain
          },
          eq() {
            return selectChain
          },
          async single() {
            return {
              data: { credits_remaining: creditsRemaining, subscription_credits: creditsRemaining },
              error: null
            }
          }
        }

        const updateChain: SupabaseTableMock = {
          update() {
            return updateChain
          },
          eq() {
            return Promise.resolve({
              data: { updated: true },
              error: null
            })
          }
        }

        return {
          select() {
            return selectChain
          },
          update() {
            return updateChain
          }
        }
      }

      return {}
    }
  }
}

test('clears credits and records transaction when trial is canceled', async () => {
  const calls: Array<{ amount: number; description: string }> = []
  const supabase = createSupabaseMock({ subscriptionStatus: 'trialing', creditsRemaining: 120 })

  const result = await clearTrialCreditsOnCancellation('user-1', 'sub-1', {
    supabase: supabase as any,
    recordTransaction: async (_userId, _type, amount, description) => {
      calls.push({ amount, description })
      return { success: true }
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.cleared, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].amount, -120)
  assert.match(calls[0].description, /Trial cancellation/)
})

test('does not clear credits when subscription is not trialing', async () => {
  const supabase = createSupabaseMock({ subscriptionStatus: 'active', creditsRemaining: 120 })

  const result = await clearTrialCreditsOnCancellation('user-1', 'sub-1', {
    supabase: supabase as any,
    recordTransaction: async () => ({ success: true })
  })

  assert.equal(result.success, true)
  assert.equal(result.cleared, false)
})

test('skips transaction when credits are already zero', async () => {
  const calls: Array<{ amount: number }> = []
  const supabase = createSupabaseMock({ subscriptionStatus: 'trialing', creditsRemaining: 0 })

  const result = await clearTrialCreditsOnCancellation('user-1', 'sub-1', {
    supabase: supabase as any,
    recordTransaction: async (_userId, _type, amount) => {
      calls.push({ amount })
      return { success: true }
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.cleared, true)
  assert.equal(calls.length, 0)
})
