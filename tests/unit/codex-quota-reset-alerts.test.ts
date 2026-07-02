import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
  POST_DISPLAY_LIMIT,
  POST_WINDOW_DAYS,
  buildSubscriptionStatus,
  buildTweetUrl,
  buildXRecentSearchParams,
  buildXRecentSearchQuery,
  classifyPost,
  containsCodexResetSignal,
  filterRecentPosts,
  isWithinDays,
  normalizeAndDedupeTweets,
  normalizeEmail,
  validateEmail,
  type StoredResetPost,
} from '@/lib/tools/codex-quota-reset-alerts'

test('CODEX_QUOTA_RESET_ALERT_CREDIT_COST is 7', () => {
  assert.equal(CODEX_QUOTA_RESET_ALERT_CREDIT_COST, 7)
})

test('POST_WINDOW_DAYS is 30', () => {
  assert.equal(POST_WINDOW_DAYS, 30)
})

test('POST_DISPLAY_LIMIT is 10', () => {
  assert.equal(POST_DISPLAY_LIMIT, 10)
})

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Foo@Example.COM '), 'foo@example.com')
  assert.equal(normalizeEmail(null), '')
  assert.equal(normalizeEmail(undefined), '')
})

test('validateEmail rejects empty, malformed, and oversized emails', () => {
  assert.equal(validateEmail('').valid, false)
  assert.equal(validateEmail(null).valid, false)
  assert.equal(validateEmail('not-an-email').valid, false)
  const oversized = 'a'.repeat(260) + '@x.io'
  assert.equal(validateEmail(oversized).valid, false)
})

test('validateEmail accepts well-formed addresses and normalizes them', () => {
  const result = validateEmail('  Mixed@CASE.io ')
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal(result.email, 'mixed@case.io')
  }
})

test('buildXRecentSearchQuery joins from-clauses and keyword phrases', () => {
  const query = buildXRecentSearchQuery()
  assert.match(query, /\(from:OpenAI OR from:OpenAIDevs OR from:OpenAINewsroom OR from:ChatGPTapp/)
  assert.match(query, /from:sama OR from:gdb OR from:ilyasut/)
  assert.match(query, /\(.*"reset".*\)/)
  assert.match(query, /-is:retweet lang:en/)
})

test('buildXRecentSearchParams clamps max_results between 10 and 100', () => {
  const low = buildXRecentSearchParams('q', 1)
  assert.equal(low.max_results, '10')
  const high = buildXRecentSearchParams('q', 999)
  assert.equal(high.max_results, '100')
  const mid = buildXRecentSearchParams('q', 30)
  assert.equal(mid.max_results, '30')
  assert.equal(mid.query, 'q')
  assert.match(mid.expansions, /author_id/)
})

test('classifyPost buckets posts into the right category', () => {
  assert.equal(classifyPost('Codex usage limits are reset'), 'codex_reset')
  assert.equal(classifyPost('Codex rate limits restored'), 'codex_reset')
  assert.equal(classifyPost('Codex for making a personalized daily digest'), 'general')
  assert.equal(classifyPost('Major incident reported'), 'general')
  assert.equal(classifyPost('Hello world'), 'general')
})

test('containsCodexResetSignal matches codex + reset/quota/throttled keywords', () => {
  assert.equal(true, containsCodexResetSignal('Codex limits lifted'))
  assert.equal(true, containsCodexResetSignal('codex throttle coming'))
  assert.equal(false, containsCodexResetSignal('Codex has gotten very good'))
  assert.equal(false, containsCodexResetSignal('OpenAI rate limit reset'))
})

test('buildTweetUrl escapes special characters in username and id', () => {
  assert.equal(
    buildTweetUrl('openai', '123'),
    'https://x.com/openai/status/123'
  )
})

test('normalizeAndDedupeTweets drops invalid and duplicate tweets', () => {
  const result = normalizeAndDedupeTweets(
    [
      { id: '1', text: 'Codex rate limits restored', created_at: '2026-07-01T00:00:00Z', author_id: '99', author: { id: '99', username: 'openai', name: 'OpenAI', verified: true } },
      { id: '1', text: 'duplicate', created_at: '2026-07-01T00:00:00Z', author_id: '99', author: { id: '99', username: 'openai', name: 'OpenAI', verified: true } },
      { id: '2', text: '', created_at: '2026-07-01T00:00:00Z', author_id: '99', author: { id: '99', username: 'openai', name: 'OpenAI', verified: true } },
      { id: '3', text: 'Codex throttle coming soon', created_at: '2026-07-01T00:00:00Z', author: { username: 'sama', id: 'sama-id', name: 'Sam', verified: false } },
    ],
    []
  )
  assert.equal(result.length, 2)
  assert.equal(result[0].tweet_id, '1')
  assert.equal(result[0].category, 'codex_reset')
  assert.equal(result[1].author_username, 'sama')
  assert.equal(result[1].category, 'codex_reset')
})

test('normalizeAndDedupeTweets falls back to includes.users when author is missing', () => {
  const result = normalizeAndDedupeTweets(
    [
      { id: '10', text: 'Outage detected', created_at: '2026-07-01T00:00:00Z', author_id: 'abc' },
    ],
    [{ id: 'abc', username: 'openai', name: 'OpenAI', verified: true }]
  )
  assert.equal(result.length, 1)
  assert.equal(result[0].author_username, 'openai')
  assert.equal(result[0].author_verified, true)
})

test('isWithinDays rejects invalid dates and out-of-window dates', () => {
  const now = Date.parse('2026-07-02T12:00:00Z')
  assert.equal(isWithinDays('not-a-date', 30, now), false)
  assert.equal(isWithinDays('2025-01-01T00:00:00Z', 30, now), false)
  assert.equal(isWithinDays('2026-07-02T00:00:00Z', 30, now), true)
})

function makePost(overrides: Partial<StoredResetPost>): StoredResetPost {
  return {
    id: overrides.id ?? 'pid',
    tweet_id: overrides.tweet_id ?? 'tweet-1',
    author_id: overrides.author_id ?? 'aid',
    author_username: overrides.author_username ?? 'openai',
    author_display_name: overrides.author_display_name ?? 'OpenAI',
    author_verified: overrides.author_verified ?? true,
    category: overrides.category ?? 'general',
    excerpt: overrides.excerpt ?? 'excerpt',
    full_text: overrides.full_text ?? 'full',
    url: overrides.url ?? 'https://x.com/openai/status/tweet-1',
    posted_at: overrides.posted_at ?? '2026-07-01T00:00:00Z',
    detected_at: overrides.detected_at ?? '2026-07-01T00:00:00Z',
  }
}

test('filterRecentPosts keeps posts inside the 30-day window', () => {
  const now = Date.parse('2026-07-02T00:00:00Z')
  const posts = [
    makePost({ id: '1', tweet_id: 'a', posted_at: '2026-07-01T00:00:00Z' }),
    makePost({ id: '2', tweet_id: 'b', posted_at: '2026-06-05T00:00:00Z' }),
    makePost({ id: '3', tweet_id: 'c', posted_at: '2025-01-01T00:00:00Z' }),
  ]
  const recent = filterRecentPosts(posts, 30, now)
  assert.equal(recent.length, 2)
  assert.deepEqual(
    recent.map((p) => p.tweet_id),
    ['a', 'b']
  )
})

test('buildSubscriptionStatus reports paused_no_row when no credits are returned', () => {
  const status = buildSubscriptionStatus({ creditsRemaining: null })
  assert.equal(status.state, 'paused_no_row')
  assert.equal(status.cost, 7)
})

test('buildSubscriptionStatus reports paused_no_credits when balance is below cost', () => {
  const status = buildSubscriptionStatus({ creditsRemaining: 3 })
  assert.equal(status.state, 'paused_no_credits')
  assert.equal(status.cost, 7)
})

test('buildSubscriptionStatus reports active when balance covers cost', () => {
  const status = buildSubscriptionStatus({ creditsRemaining: 7 })
  assert.equal(status.state, 'active')
  assert.equal(status.cost, 7)
})