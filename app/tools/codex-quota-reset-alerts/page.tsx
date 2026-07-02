"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  Newspaper,
  RefreshCw,
  Rocket,
  Sparkles,
  UserRound,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { useToolCreditBalance, getToolCreditBalanceHeroState } from "@/lib/tools/use-tool-credit-balance";

const CODEX_QUOTA_RESET_ALERT_CREDIT_COST = 7;

type StoredResetPost = {
  id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string | null;
  author_verified: boolean;
  category: 'codex_reset' | 'general';
  excerpt: string;
  full_text: string | null;
  url: string;
  posted_at: string;
  detected_at: string;
};

type FetchState = "idle" | "loading" | "ready" | "error";

type SubscribeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "done";
      state: "active" | "paused_no_credits" | "paused_no_row";
      creditsRemaining: number;
      email: string;
    }
  | { kind: "error"; message: string };

function formatPostDate(iso: string) {
  try {
    const date = new Date(iso);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatPostDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatPostTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function getAuthorInitial(post: StoredResetPost) {
  const source = post.author_display_name || post.author_username || "X";
  return source.trim().charAt(0).toUpperCase() || "X";
}

const HIGHLIGHT_TERMS = [
  "codex reset",
  "banked reset",
  "rate limit",
  "rate-limit",
  "usage limit",
  "usage cap",
  "limits lifted",
  "reset",
  "quota",
  "limits",
  "availability",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string) {
  const pattern = new RegExp(`(${HIGHLIGHT_TERMS.map(escapeRegExp).join("|")})`, "gi");
  return text.split(pattern).map((part, index) => {
    const isMatch = HIGHLIGHT_TERMS.some((term) => term.toLowerCase() === part.toLowerCase());
    if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>;

    return (
      <mark
        key={`${part}-${index}`}
        className="rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-950"
      >
        {part}
      </mark>
    );
  });
}

export default function CodexQuotaResetAlertsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();

  const creditBalance = useToolCreditBalance();
  const heroCreditState = getToolCreditBalanceHeroState(creditBalance);

  const [email, setEmail] = useState("");
  const [subscribeState, setSubscribeState] = useState<SubscribeState>({ kind: "idle" });
  const [postsState, setPostsState] = useState<FetchState>("idle");
  const [posts, setPosts] = useState<StoredResetPost[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashRefreshMessage(message: { kind: "success" | "error"; text: string }) {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    setRefreshMessage(message);
    const ttl = message.kind === "success" ? 2500 : 5000;
    refreshTimerRef.current = setTimeout(() => {
      setRefreshMessage(null);
      refreshTimerRef.current = null;
    }, ttl);
  }

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  async function loadPosts(): Promise<void> {
    try {
      const response = await fetch("/api/tools/codex-quota-reset-alerts/posts", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load posts");
      }
      setPosts(payload.posts ?? []);
      setPostsState("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load posts");
      setPostsState("error");
    }
  }

  useEffect(() => {
    let canceled = false;
    async function load() {
      setPostsState("loading");
      try {
        await loadPosts();
      } catch (err) {
        if (canceled) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to load posts");
        setPostsState("error");
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  async function handleRefresh() {
    if (refreshing) return;
    setErrorMessage(null);
    if (!isSignedIn) {
      openSignIn({ fallbackRedirectUrl: "/tools/codex-quota-reset-alerts" });
      return;
    }

    setRefreshing(true);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setRefreshMessage(null);
    try {
      const response = await fetch(
        "/api/tools/codex-quota-reset-alerts/refresh",
        { method: "POST", cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to refresh notices");
      }
      await loadPosts();
      flashRefreshMessage({
        kind: "success",
        text:
          payload?.summary?.inserted !== undefined
            ? `Cache cleared. ${payload.summary.inserted} new notice${
                payload.summary.inserted === 1 ? "" : "s"
              } fetched.`
            : "Cache cleared and latest notices fetched.",
      });
    } catch (err) {
      flashRefreshMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to refresh notices",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!isSignedIn) {
      openSignIn({ fallbackRedirectUrl: "/tools/codex-quota-reset-alerts" });
      return;
    }

    setSubscribeState({ kind: "loading" });
    try {
      const response = await fetch("/api/tools/codex-quota-reset-alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to subscribe");
      }
      setSubscribeState({
        kind: "done",
        state: payload.billing?.state ?? "paused_no_credits",
        creditsRemaining: payload.billing?.credits_remaining ?? 0,
        email,
      });
    } catch (err) {
      setSubscribeState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to subscribe",
      });
    }
  }

  return (
    <ToolPageShell
      toolSlug="codex-quota-reset-alerts"
      title="Codex Quota Reset Alerts"
      description="Unofficial email alerts for Codex quota, rate-limit, and reset notices curated from public OpenAI official and staff X posts."
      statusLabel={heroCreditState.label}
      statusTone={heroCreditState.tone}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-black" aria-hidden="true" />
              <h2 className="text-lg font-semibold tracking-tight text-black">Recent notices</h2>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh latest notices"
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 text-sm font-medium text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {refreshMessage ? (
            <p
              key={refreshMessage.text}
              role="status"
              aria-live="polite"
              className="codex-toast pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full border bg-white/95 px-4 py-2 text-sm font-medium shadow-[0_18px_44px_rgba(0,0,0,0.18)] backdrop-blur"
              style={{
                borderColor: refreshMessage.kind === "success" ? "#a7f3d0" : "#fecaca",
                color: refreshMessage.kind === "success" ? "#065f46" : "#b91c1c",
              }}
            >
              {refreshMessage.text}
            </p>
          ) : null}

          {postsState === "loading" ? (
            <div className="space-y-3">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-xl border border-[#E5E5E5] bg-[#F7F7F7]"
                />
              ))}
            </div>
          ) : postsState === "error" ? (
            <p className="text-sm text-red-600">{errorMessage ?? "Failed to load notices"}</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-[#666]">
              No notices to display yet. New entries appear automatically as Flowtra curates them.
            </p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="group overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-[0_18px_44px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D7D7D7] hover:shadow-[0_24px_56px_rgba(0,0,0,0.09)]"
                >
                  <div className="border-b border-[#EFEFEF] bg-[#FAFAFA] px-4 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-black text-base font-semibold text-white">
                        {getAuthorInitial(post)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-base font-semibold text-black">
                            {post.author_display_name || post.author_username}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#666666]">
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                            @{post.author_username}
                          </span>
                        </div>
                      </div>
                      <time
                        className="ml-auto shrink-0 self-center whitespace-nowrap text-right text-sm font-bold uppercase tracking-[0.08em] text-black sm:text-base"
                        dateTime={post.posted_at}
                      >
                        <span className="block text-[11px] font-medium normal-case tracking-[0.16em] text-[#666666]">
                          <Clock3 className="mr-1 inline-block h-3.5 w-3.5 align-middle" aria-hidden="true" />
                          {formatPostDay(post.posted_at)}
                        </span>
                        <span className="block text-base font-bold normal-case tracking-normal text-black sm:text-lg">
                          {formatPostTime(post.posted_at)}
                        </span>
                      </time>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="min-w-0 flex-1 whitespace-pre-line text-[15px] leading-7 text-black">
                      {renderHighlightedText(post.full_text ?? post.excerpt)}
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Link
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View original X post by ${post.author_username}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      >
                        View source
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
              <BellRing className="h-5 w-5 text-black" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-black">
                Want a heads-up the moment it happens?
              </h2>
              <p className="text-sm text-[#666666]">
                Drop your email and we'll ping you as soon as Codex resets its quota.
              </p>
            </div>
          </div>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
            <label className="block">
              <span className="sr-only">Notification email</span>
              <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 transition-colors focus-within:bg-white">
                <Mail className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm text-black placeholder:text-[#999] focus:outline-none focus:ring-0"
                />
              </div>
            </label>

            <button
              type="submit"
              className="landing-press-button landing-press-button--compact inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap text-sm font-medium sm:w-auto"
              disabled={subscribeState.kind === "loading"}
            >
              {subscribeState.kind === "loading" ? (
                "Submitting..."
              ) : isSignedIn ? (
                <>
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  Tell me when Codex resets
                </>
              ) : (
                "Sign in to subscribe"
              )}
            </button>
          </form>

          {subscribeState.kind === "done" ? (
            <div className="mt-4 space-y-2 rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] p-4 text-sm text-black">
              <p className="flex items-start gap-2 font-medium">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>
                  Each alert costs {CODEX_QUOTA_RESET_ALERT_CREDIT_COST} credits from your
                  Flowtra balance, charged only when a notice is sent.
                </span>
              </p>
              {subscribeState.state === "active" ? (
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>
                    Saved {subscribeState.email}. We'll email you when a relevant notice is detected.
                  </span>
                </p>
              ) : subscribeState.state === "paused_no_credits" ? (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
                  <span>
                    Saved {subscribeState.email}, but you only have{" "}
                    {subscribeState.creditsRemaining} credit
                    {subscribeState.creditsRemaining === 1 ? "" : "s"}. Top up to{" "}
                    {CODEX_QUOTA_RESET_ALERT_CREDIT_COST}+ credits to start receiving alerts.
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
                  <span>
                    Saved {subscribeState.email}, but alerts are paused because no credit balance
                    was found. Buy credits to activate notifications.
                  </span>
                </p>
              )}
            </div>
          ) : null}

          {subscribeState.kind === "error" ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-red-600">
              <XCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
              {subscribeState.message}
            </p>
          ) : null}

          {errorMessage && subscribeState.kind !== "error" ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </section>
      </div>
    </ToolPageShell>
  );
}
