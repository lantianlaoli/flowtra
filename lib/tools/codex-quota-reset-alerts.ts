// Helpers for the Codex Quota Reset Alerts tool.
// - X Recent Search query construction against an OpenAI official/staff allowlist
// - Post normalization / dedupe
// - Email validation
// - Subscription status helpers
// - 7-credit notification billing that does not require an active subscription
//
// Schema verified via Supabase MCP (2026-07-02):
// codex_quota_reset_posts has tweet_id/category/excerpt/url/posted_at/detected_at.
// codex_quota_reset_subscriptions has user_id/email/status/last_notified_post_id/notifications_sent.
// codex_quota_reset_notifications has subscription_id/user_id/post_id/status/credits_charged/provider_id/error_message.
// user_credits has user_id/credits_remaining; credit_transactions has user_id/type/amount/description/history_id.

import { getSupabaseAdmin } from '@/lib/supabase'
import { recordCreditTransaction } from '@/lib/credits'

export const CODEX_QUOTA_RESET_ALERT_CREDIT_COST = 7

export const POST_WINDOW_DAYS = 30

export const POST_DISPLAY_LIMIT = 10

export type ResetPostCategory =
  | 'codex_reset'
  | 'general'

export type RawXAuthor = {
  id?: string | number
  username?: string
  name?: string
  verified?: boolean
}

export type RawXNoteTweet = {
  text?: string
  id?: string
}

export type RawXTweet = {
  id?: string | number
  text?: string
  created_at?: string
  author_id?: string | number
  // Recent Search may return author object inline (X API v2 with expansions=author_id)
  author?: RawXAuthor
  // Long-form tweet body (e.g. > 280 chars) - X nests this under tweet_fields=note_tweet.
  note_tweet?: RawXNoteTweet
}

export type XTweetsResponse = {
  data?: RawXTweet[]
  includes?: { users?: RawXAuthor[] }
  meta?: { result_count?: number }
}

export type NormalizedResetPost = {
  tweet_id: string
  author_id: string
  author_username: string
  author_display_name: string
  author_verified: boolean
  category: ResetPostCategory
  excerpt: string
  full_text: string
  url: string
  posted_at: string
}

export type StoredResetPost = {
  id: string
  tweet_id: string
  author_id: string
  author_username: string
  author_display_name: string | null
  author_verified: boolean
  category: ResetPostCategory
  excerpt: string
  full_text: string | null
  url: string
  posted_at: string
  detected_at: string
}

export type StoredSubscription = {
  id: string
  user_id: string
  email: string
  status: 'active' | 'paused'
  last_notified_post_id: string | null
  notifications_sent: number
  created_at: string
  updated_at: string
}

// Default allowlist. Can be overridden at runtime via CODEX_QUOTA_RESET_ALERT_USERNAMES
// (comma-separated usernames without @).
//
// Verified OpenAI official + dev/news/ChatGPT handles and core staff / execs.
const DEFAULT_ALLOWLIST: ReadonlyArray<string> = [
  // 官方账号
  'OpenAI',
  'OpenAIDevs',
  'OpenAINewsroom',
  'ChatGPTapp',
  // 核心成员 / 领导层
  'sama',
  'gdb',
  'ilyasut',
  'miramurati',
  'woj_zaremba',
  'johnschulman2',
  'bradlightcap',
  'fidjissimo',
  'kevinweil',
  'swyx',
  'jamesfzhang',
]

const RESET_KEYWORDS: ReadonlyArray<string> = [
  'rate limit',
  'rate-limit',
  'quota',
  'usage limit',
  'reset',
  'restored',
  'availability',
  'throttled',
  'throttling',
  'codex',
  'limited preview',
  'general availability',
]

export function getAllowlistedUsernames(): string[] {
  const override = process.env.CODEX_QUOTA_RESET_ALERT_USERNAMES
  if (override && override.trim().length > 0) {
    return override
      .split(',')
      .map((entry) => entry.trim().replace(/^@/, ''))
      .filter((entry) => entry.length > 0)
  }
  return [...DEFAULT_ALLOWLIST]
}

// Build a single OR-joined `from:` clause for X Recent Search. Keywords are
// appended as separate OR'd text fragments so a tweet only needs to match one.
export function buildXRecentSearchQuery(): string {
  const usernames = getAllowlistedUsernames()
  const fromClause = usernames.map((name) => `from:${name}`).join(' OR ')
  const keywordClause = RESET_KEYWORDS.map((kw) => `"${kw}"`).join(' OR ')
  return `(${fromClause}) (${keywordClause}) -is:retweet lang:en`
}

export function buildXRecentSearchParams(query: string, maxResults = 30) {
  return {
    query,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    'tweet.fields': 'created_at,author_id,text,note_tweet',
    expansions: 'author_id',
    'user.fields': 'username,name,verified',
  }
}

export async function fetchRecentCodexResetTweets(): Promise<{
  payload: XTweetsResponse | null
  status: number | null
  error?: string
}> {
  const bearer = process.env.X_BEARER_TOKEN
  if (!bearer) {
    return { payload: null, status: null, error: 'X_BEARER_TOKEN is not configured' }
  }

  const params = buildXRecentSearchParams(buildXRecentSearchQuery(), 30)
  const url = new URL('https://api.x.com/2/tweets/search/recent')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    return {
      payload: null,
      status: response.status,
      error: body || `X API responded with ${response.status}`,
    }
  }

  try {
    return {
      payload: (await response.json()) as XTweetsResponse,
      status: response.status,
    }
  } catch (error) {
    return {
      payload: null,
      status: response.status,
      error: error instanceof Error ? error.message : 'Failed to parse X API response',
    }
  }
}

export async function refreshCodexResetPosts(): Promise<{
  fetched: number
  inserted: number
  error?: string
}> {
  const tweetsPayload = await fetchRecentCodexResetTweets()
  if (tweetsPayload.error || !tweetsPayload.payload?.data) {
    return {
      fetched: 0,
      inserted: 0,
      error: tweetsPayload.error ?? 'No X posts returned',
    }
  }

  const cutoffIso = new Date(Date.now() - POST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const existingIds = await fetchTweetIdsSinceIso(cutoffIso)
  const normalized = normalizeAndDedupeTweets(
    tweetsPayload.payload.data,
    tweetsPayload.payload.includes?.users ?? []
  )
    .filter((post) => !existingIds.has(post.tweet_id))
    // Persist whatever X returns so the page can surface full Codex context;
    // page-side filtering (via fetchRecentPosts) chooses what to display, and
    // refresh reclassifies every row using the current signal.
    .map((post) => ({ ...post, category: classifyPost(post.full_text || post.excerpt) }))

  if (normalized.length === 0) {
    return { fetched: tweetsPayload.payload.data.length, inserted: 0 }
  }

  const persisted = await persistPosts(normalized)
  return {
    fetched: tweetsPayload.payload.data.length,
    inserted: persisted.inserted,
    error: persisted.error,
  }
}

export function normalizeAndDedupeTweets(
  tweets: RawXTweet[],
  users: RawXAuthor[] = []
): NormalizedResetPost[] {
  const userById = new Map<string, RawXAuthor>()
  for (const user of users) {
    if (!user || !user.id) continue
    userById.set(String(user.id), user)
  }

  const seen = new Set<string>()
  const out: NormalizedResetPost[] = []
  for (const tweet of tweets) {
    const tweetId = tweet.id ? String(tweet.id) : ''
    if (!tweetId || seen.has(tweetId)) continue
    const rawAuthorId = tweet.author_id ?? tweet.author?.id
    const authorId = rawAuthorId ? String(rawAuthorId) : ''
    const author = (tweet.author && (tweet.author.id || tweet.author.username
      ? tweet.author
      : userById.get(authorId))) || userById.get(authorId) || null
    const username = author?.username || ''
    if (!authorId || !username) continue

    const text = (tweet.note_tweet?.text || tweet.text || '').trim()
    if (!text) continue

    seen.add(tweetId)
    out.push({
      tweet_id: tweetId,
      author_id: authorId,
      author_username: username,
      author_display_name: author?.name || username,
      author_verified: !!author?.verified,
      category: classifyPost(text),
      excerpt: text,
      full_text: text,
      url: buildTweetUrl(username, tweetId),
      posted_at: tweet.created_at || new Date().toISOString(),
    })
  }
  return out
}

// Returns true when the text carries a Codex-reset signal. We require the
// post to mention Codex and contain a reset/quota/throttle/availability
// keyword (matching the stem, so "throttle", "throttled", "throttling" all
// qualify).
export function containsCodexResetSignal(text: string): boolean {
  const lower = (text || '').toLowerCase()
  if (!lower.includes('codex')) return false
  // Each keyword uses its own leading word boundary. The trailing `\w*`
  // matches stem suffixes (e.g. throttle / throttled / throttling).
  const keywordRegex =
    /\b(reset|restored|back online|limit lifted|limits lifted|quota|quotas|usage limit|usage limits|usage cap|throttle|throttled|throttling|now available|incident|outage|degraded|rolled back|back to normal)\w*/
  return keywordRegex.test(lower)
}

export function classifyPost(text: string): ResetPostCategory {
  return containsCodexResetSignal(text) ? 'codex_reset' : 'general'
}

export function buildTweetUrl(username: string, tweetId: string): string {
  return `https://x.com/${encodeURIComponent(username)}/status/${encodeURIComponent(tweetId)}`
}

export function isWithinDays(isoDate: string, days: number, now = Date.now()): boolean {
  const ts = Date.parse(isoDate)
  if (!Number.isFinite(ts)) return false
  const cutoff = now - days * 24 * 60 * 60 * 1000
  return ts >= cutoff && ts <= now + 24 * 60 * 60 * 1000
}

export function filterRecentPosts(
  posts: StoredResetPost[],
  days: number = POST_WINDOW_DAYS,
  now = Date.now()
): StoredResetPost[] {
  return posts.filter((post) => isWithinDays(post.posted_at, days, now))
}

export type EmailValidationResult =
  | { valid: true; email: string }
  | { valid: false; reason: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254

export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return ''
  return String(raw).trim().toLowerCase()
}

export function validateEmail(raw: string | null | undefined): EmailValidationResult {
  const email = normalizeEmail(raw)
  if (!email) return { valid: false, reason: 'Email is required' }
  if (email.length > EMAIL_MAX_LENGTH) return { valid: false, reason: 'Email is too long' }
  if (!EMAIL_REGEX.test(email)) return { valid: false, reason: 'Email format is invalid' }
  return { valid: true, email }
}

export function buildSubscriptionStatus(args: {
  creditsRemaining: number | null
  cost?: number
}): {
  state: 'active' | 'paused_no_credits' | 'paused_no_row'
  cost: number
} {
  const cost = args.cost ?? CODEX_QUOTA_RESET_ALERT_CREDIT_COST
  if (args.creditsRemaining === null || args.creditsRemaining === undefined) {
    return { state: 'paused_no_row', cost }
  }
  if (args.creditsRemaining < cost) {
    return { state: 'paused_no_credits', cost }
  }
  return { state: 'active', cost }
}

// Persist a subscription for the user. Will create with status='active' or
// 'paused_no_credits' based on balance. Idempotent per (user_id, email).
export async function upsertSubscription(args: {
  userId: string
  email: string
  status: 'active' | 'paused'
}): Promise<{ subscription: StoredSubscription | null; error?: string }> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('codex_quota_reset_subscriptions')
    .upsert(
      {
        user_id: args.userId,
        email: args.email,
        status: args.status,
        updated_at: now,
      },
      { onConflict: 'user_id,email' }
    )
    .select('*')
    .maybeSingle()

  if (error) {
    return { subscription: null, error: error.message }
  }
  return { subscription: (data as StoredSubscription) ?? null }
}

export async function fetchSubscriptionsByStatus(
  status: 'active' | 'paused' = 'active'
): Promise<StoredSubscription[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('codex_quota_reset_subscriptions')
    .select('*')
    .eq('status', status)
  if (error) {
    console.error('[codex-quota-reset-alerts] fetchSubscriptionsByStatus failed:', error)
    return []
  }
  return (data as StoredSubscription[]) ?? []
}

export async function fetchRecentPosts(
  days: number = POST_WINDOW_DAYS,
  limit: number = POST_DISPLAY_LIMIT
): Promise<StoredResetPost[]> {
  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('codex_quota_reset_posts')
    .select('*')
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[codex-quota-reset-alerts] fetchRecentPosts failed:', error)
    return []
  }
  const rows = (data as StoredResetPost[]) ?? []
  // Coalesce so the page always renders the longest available text (older rows
  // may be missing full_text). We return everything in the cache — the page
  // surfaces the corpus so users can see what's been collected. Refresh button
  // reclassifies each row in place; category = codex_reset means it carries the
  // reset signal, otherwise it's a Codex-context post that the user can still
  // see at a glance.
  return rows.map((row) => {
    const excerpt = (row.excerpt ?? '').trim()
    const full = (row.full_text ?? '').trim()
    const text = full.length >= excerpt.length ? full : excerpt
    return {
      ...row,
      full_text: full || row.full_text || null,
      excerpt: text || excerpt,
    }
  })
}

export async function persistPosts(
  posts: NormalizedResetPost[]
): Promise<{ inserted: number; error?: string }> {
  if (posts.length === 0) return { inserted: 0 }
  const supabase = getSupabaseAdmin()
  const rows = posts.map((post) => ({
    tweet_id: post.tweet_id,
    author_id: post.author_id,
    author_username: post.author_username,
    author_display_name: post.author_display_name,
    author_verified: post.author_verified,
    category: post.category,
    excerpt: post.excerpt,
    full_text: post.full_text,
    url: post.url,
    posted_at: post.posted_at,
  }))
  const { data, error } = await supabase
    .from('codex_quota_reset_posts')
    .upsert(rows, { onConflict: 'tweet_id', ignoreDuplicates: true })
    .select('id')
  if (error) {
    return { inserted: 0, error: error.message }
  }
  return { inserted: data?.length ?? 0 }
}

export async function fetchTweetIdsSinceIso(
  isoCutoff: string
): Promise<Set<string>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('codex_quota_reset_posts')
    .select('tweet_id')
    .gte('posted_at', isoCutoff)
  if (error) {
    console.error('[codex-quota-reset-alerts] fetchTweetIdsSinceIso failed:', error)
    return new Set()
  }
  return new Set(((data ?? []) as Array<{ tweet_id: string }>).map((row) => row.tweet_id))
}

export async function recordNotification(args: {
  subscriptionId: string
  userId: string
  postId: string
  status: 'sent' | 'skipped' | 'failed'
  creditsCharged: number
  providerId?: string | null
  errorMessage?: string | null
}): Promise<{ recorded: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('codex_quota_reset_notifications')
    .upsert(
      {
        subscription_id: args.subscriptionId,
        user_id: args.userId,
        post_id: args.postId,
        status: args.status,
        credits_charged: args.creditsCharged,
        provider_id: args.providerId ?? null,
        error_message: args.errorMessage ?? null,
        attempted_at: new Date().toISOString(),
      },
      { onConflict: 'subscription_id,post_id' }
    )
  if (error) {
    return { recorded: false, error: error.message }
  }
  return { recorded: true }
}

export async function hasNotificationRecord(args: {
  subscriptionId: string
  postId: string
}): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('codex_quota_reset_notifications')
    .select('id')
    .eq('subscription_id', args.subscriptionId)
    .eq('post_id', args.postId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('[codex-quota-reset-alerts] hasNotificationRecord failed:', error)
    return false
  }
  return !!data
}

// Charge the user for a successful alert send. Skips the active-subscription
// guard so this feature works without any paid Flowtra subscription.
export async function hasAlertCreditBalance(userId: string): Promise<{
  success: boolean
  hasEnoughCredits: boolean
  currentCredits: number | null
  error?: string
}> {
  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      success: false,
      hasEnoughCredits: false,
      currentCredits: null,
      error: error.message,
    }
  }

  const currentCredits = typeof row?.credits_remaining === 'number' ? row.credits_remaining : null
  return {
    success: true,
    hasEnoughCredits: (currentCredits ?? 0) >= CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
    currentCredits,
  }
}

export async function chargeAlertCredits(args: {
  userId: string
  postTweetId: string
}): Promise<{ success: boolean; remaining?: number; error?: string }> {
  const cost = CODEX_QUOTA_RESET_ALERT_CREDIT_COST

  const supabase = getSupabaseAdmin()
  const { data: row, error: fetchError } = await supabase
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', args.userId)
    .maybeSingle()
  if (fetchError) {
    return { success: false, error: fetchError.message }
  }
  if (!row) {
    return { success: false, error: 'No credits row for user' }
  }
  if (row.credits_remaining < cost) {
    return { success: false, error: 'Insufficient credits' }
  }

  const remainingCredits = row.credits_remaining - cost
  const { data: updated, error: updateError } = await supabase
    .from('user_credits')
    .update({ credits_remaining: remainingCredits })
    .eq('user_id', args.userId)
    .eq('credits_remaining', row.credits_remaining)
    .select('credits_remaining')
    .maybeSingle()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updated) {
    return { success: false, error: 'Credit balance changed; retry on next poll' }
  }

  await recordCreditTransaction(
    args.userId,
    'usage',
    cost,
    `Codex quota reset alert · tweet ${args.postTweetId}`,
    undefined,
    true
  )

  return { success: true, remaining: updated.credits_remaining }
}

// Pure helper for idempotency test coverage.
export function isAlreadyNotified(args: {
  notificationsSent: number
  lastNotifiedPostId: string | null
  postId: string
}): boolean {
  if (args.notificationsSent <= 0) return false
  return args.lastNotifiedPostId === args.postId
}

export function buildAlertEmail(args: {
  email: string
  post: StoredResetPost
  unsubscribeUrl?: string | null
}): { subject: string; html: string; text: string } {
  const siteBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://flowtra.ai').replace(/\/$/, '')
  const unsubscribeUrl = args.unsubscribeUrl || `${siteBase}/tools/codex-quota-reset-alerts`
  const subject = `Codex quota update: ${args.post.excerpt.slice(0, 80)}`
  const safeAuthor = `${args.post.author_display_name || args.post.author_username} (@${args.post.author_username})`
  const html = `<!DOCTYPE html>
  <html lang="en">
    <body style="margin:0;padding:0;background-color:#f9fafb;color:#111827;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;padding:32px 36px;text-align:left;">
              <tr>
                <td style="font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Codex Quota Reset Alert</td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:22px;line-height:1.3;font-weight:600;">${args.post.excerpt}</td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:14px;line-height:1.6;color:#4b5563;">From ${safeAuthor}</td>
              </tr>
              <tr>
                <td style="padding-top:20px;">
                  <a href="${args.post.url}" style="display:inline-block;background-color:#111827;color:#ffffff;padding:12px 24px;border-radius:9999px;font-size:14px;font-weight:600;text-decoration:none;">View on X</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:28px;font-size:12px;color:#9ca3af;">
                  You're receiving this because you signed up for Codex Quota Reset Alerts at Flowtra.<br />
                  <a href="${unsubscribeUrl}" style="color:#9ca3af;">Manage alerts</a>
                </td>
              </tr>
            </table>
            <p style="margin-top:16px;font-size:12px;color:#9ca3af;">Unofficial watcher — signals aggregated from public X posts.</p>
          </td>
        </tr>
      </table>
    </body>
  </html>`

  const text = `Codex Quota Reset Alert

${args.post.excerpt}

From ${safeAuthor}
${args.post.url}

Manage alerts: ${unsubscribeUrl}`

  return { subject, html, text }
}
