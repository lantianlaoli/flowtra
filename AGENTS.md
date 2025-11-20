# Flowtra Agent Handbook

## Quick Rules
- Use `pnpm` for every dependency, build, and tooling command.
- Application code, documentation, and inline comments must be written in English. (Conversations can happen in Chinese.)
- All UI copy (labels, placeholders, toasts, buttons, etc.) must remain in English to keep the product consistent.
- Never commit secrets. Copy `.env.example` to `.env` locally and keep credentials out of source control.

## Architecture Overview
Flowtra is a Next.js 15 application that delivers AI-generated marketing assets powered by KIE and Supabase. The system combines:
- **App Router** pages in `app/` with both server and client components.
- **Supabase** for persistence (user credits, assets, project state) accessed through `lib/supabase.ts`.
- **KIE platform integrations** in `lib/kie-*.ts` for Sora2 Pro generation and watermark removal.
- **OpenRouter** powered prompt orchestration inside the ads workflows in `lib/*-ads-workflow.ts`.
- **Clerk** authentication and credit tracking exposed to the client through React contexts.
- **PostHog** instrumentation via `providers/posthog.tsx`, `lib/posthog.ts`, and `lib/posthog-server.ts`.

## Directory Reference
- `app/`
  - `page.tsx`, `layout.tsx`: marketing landing experience.
  - `dashboard/`: authenticated generation dashboard and related UI routes.
  - `pricing/`, `blog/`, `privacy/`, `terms/`, `sora2-watermark-removal/`: marketing and legal pages.
  - `api/`: Next.js Route Handlers that back the product surface (credit checks, uploads, generation triggers, analytics, webhook ingestion).
- `components/`: Reusable UI components (Tailwind v4). Keep files in PascalCase.
- `contexts/`: Client-side React contexts (credits, toast notifications) that bridge server data to React components.
- `hooks/`: Custom hooks orchestrating ads workflows on the client (`useStandardAdsWorkflow`, `useMultiVariantAdsWorkflow`, `useVideoAudio`).
- `lib/`: Server utilities and integrations, including
  - `constants.ts`: Source of truth for pricing, credit costs, package info, and helper guards.
  - `credits.ts`: Supabase credit ledger helpers (initialize, deduct, refund).
  - `character-ads-workflow.ts`, `standard-ads-workflow.ts`, `multi-variant-ads-workflow.ts`: Prompt and job orchestration for each video product line.
  - `kie-credits-check.ts`, `kie-sora2-pro.ts`, `kie-watermark-removal.ts`: KIE-specific API clients and safeguards.
  - `watermark-removal-workflow.ts`: Sora2 watermark removal pipeline.
  - `error-tracking.ts`, `posthog*.ts`, `fetchWithRetry.ts`, `httpRequest.ts`: cross-cutting concerns.
  - `payment.ts`, `resend.ts`: Creem checkout helper + transactional email integration.
- `providers/`: Shared client providers (PostHog, etc.) loaded in root layouts.
- `public/`: Static assets.
- `scripts/`, `capture/`: Utility artifacts for operations and recording (kept outside runtime bundles).

## Backend Surface Map
`app/api/` hosts route handlers grouped by feature:
- **Generation**: `standard-ads`, `multi-variant-ads`, `character-ads`, `youtube-thumbnail`, `download-video`.
- **Assets & uploads**: `upload`, `upload-temp-images`, `user-photos`, `user-products`, `recent-videos`, `history`.
- **Billing & credits**: `credits`, `check-kie-credits`, `create-checkout`, `webhooks/creem`.
- **Discovery & lead capture**: `discover`, `lead`, `public/*`.
- **Watermark removal**: `watermark-removal`, `watermark-removal-demo`.
- **Diagnostics**: `debug/*`, `users`, `user-stats`.
Most routes call into `lib/` modules for Supabase access, KIE orchestration, or email/analytics side effects.

## Credit & Pricing Model
- Authoritative data lives in `lib/constants.ts` and `lib/kie-credits-check.ts`.
- `contexts/CreditsContext.tsx` exposes live balances to the UI with exponential backoff retries.
- Server APIs (`app/api/credits/*`) use `lib/credits.ts` to manage the `user_credits` Supabase table and record transactions.
- `lib/payment.ts` + `app/api/create-checkout` integrate with Creem for top-ups; `lib/kie-credits-check.ts` guards KIE calls against insufficient balance.

## KIE Integration Flow
1. Generation routes validate balance through `validateKieCredits()`.
2. Workflows (e.g. `lib/standard-ads-workflow.ts`) craft prompts, submit jobs via `lib/kie-sora2-pro.ts`, and poll task status.
3. Results are persisted to Supabase and surfaced back to the dashboard.
4. `lib/watermark-removal-workflow.ts` and `lib/kie-watermark-removal.ts` encapsulate the watermark removal API and expose `/api/watermark-removal` endpoints.

## Local Development
1. Install dependencies: `pnpm install`.
2. Copy environment template: `cp .env.example .env` and populate the following keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - `KIE_API_KEY`, optional `KIE_CREDIT_THRESHOLD`
   - `OPENROUTER_API_KEY`
   - `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFY_EMAIL_TO`
   - `NEXT_PUBLIC_POSTHOG_KEY`, optional `NEXT_PUBLIC_POSTHOG_HOST`
3. Run the dev server: `pnpm dev`.
4. Visit `http://localhost:3000` and sign in via Clerk to access the dashboard.

## Useful Commands
- `pnpm dev` – Start local development server.
- `pnpm build` – Production build.
- `pnpm start` – Serve the production build.
- `pnpm lint` – ESLint (run with `--fix` before committing).
- `pnpm type-check` – TypeScript project validation.
- `npx playwright test` – End-to-end tests (see `tests/` when present).

## Mandatory Verification Before Build/Deploy
- Always run `pnpm lint` and `pnpm type-check` (or equivalent) before running `pnpm build` or shipping changes. Builds alone are insufficient; ensure linting and type checks pass locally to mirror CI.

## Coding Standards
- TypeScript everywhere. Prefer server components and `use server` utilities for backend operations.
- Two-space indentation, retain existing import orderings.
- Components PascalCase, hooks `useX`, utility functions camelCase, types/enums PascalCase.
- Tailwind v4 classes colocated; merge conditional classes with `clsx` or `tailwind-merge`.
- Guard expensive API calls with `fetchWithRetry` and the retry policies already in place.

## Testing & Verification
- Prioritize Playwright specs for end-to-end validation. Place specs in `tests/` or `e2e/` using `*.spec.ts` / `*.test.ts` naming.
- Prefer `data-testid` attributes for selectors.
- For new workflows, add Supabase fixture data or use provided upload APIs to seed content.

## Observability & Error Handling
- Client analytics: initialize PostHog via `providers/posthog.tsx`.
- Server telemetry: use `captureServerException` from `lib/posthog-server.ts` for critical failures.
- Wrap external calls with `fetchWithRetry` or `httpRequest.ts` helpers and log meaningful context (never secrets).

## Git & Release Hygiene
- Follow Conventional Commits (e.g. `feat:`, `fix:`, `docs:`).
- Keep PRs focused; ensure `pnpm lint` and `pnpm type-check` pass before pushing.
- Document pricing changes in `lib/constants.ts` first, then refresh corresponding UI copy and this handbook.

### Build Parity Checklist
- **Always run `pnpm install --frozen-lockfile` before CI-critical builds** to ensure no stale dependencies slip through.
- **For any type union changes (e.g., `VideoDuration`) audit every setter/handler** that consumes the type; mismatched unions may compile locally but fail on Vercel.
- **Before pushing, run `pnpm lint && pnpm build`** from a clean state (e.g., delete `.next` or run in CI) to mirror Vercel’s environment.
- **If Vercel fails, capture the exact stack trace and add regression tests or type guards** so the same category of error cannot recur.
