# Multi-Variant Ads Removal Inventory

## 1. Dashboard experience & workflow orchestration
- `app/(app-shell)/dashboard/multi-variant-ads/page.tsx` simply renders the multi-variant dashboard. Removing the page requires deleting the route entry and updating any router references or redirects pointing at `/dashboard/multi-variant-ads`.
- `components/pages/MultiVariantAdsPage.tsx` contains the entire builder UI: state for model/duration/quality, product + brand pickers, upload flow, CTA buttons, hooks into credits/toasts, and entry points to `useMultiVariantAdsWorkflow`. Eliminating this file ripples into shared components (video selectors, product manager, etc.) because those imports become unused.
- `hooks/useMultiVariantAdsWorkflow.ts` encapsulates every client-side mutation for this product (file upload to `/api/upload`, POSTing to `/api/multi-variant-ads/create`, polling `/api/multi-variant-ads/items-status`, download helpers, etc.). The hook has its own types and seeded UI state, so it can be completely deleted once no component uses it.
- `lib/multi-variant-ads-workflow.ts` drives the backend: Supabase insert/update logic, batching, calls into KIE (`generateMultiVariantCover`, `startOptimizedMultiVariantWorkflow`), status polling, and `getMultiVariantItemsStatus`. Removing the feature requires deleting this module and any imports (e.g., API routes, discover/showcase endpoints).
- `lib/supabase.ts` defines the `MultiVariantProject` interface plus adds `multi_variant_ads_projects` to the generated types map. Once no code references the table, delete this interface and the related `Database['public']['Tables']['multi_variant_ads_projects']` definitions.

## 2. Marketing pages, navigation, and CTA copy
- `app/features/multi-variant-ads/page.tsx` serves the public marketing page. It imports `components/pages/MultiVariantAdsShowcasePage.tsx`, which contains the hero, example galleries, and CTA buttons that link back to `/dashboard/multi-variant-ads`. Both the route and component need to go.
- `components/pages/landing/sections/FeaturesSection.tsx` advertises “Multi-Variant Ads”; remove the card entirely or replace it with another feature.
- `components/ui/ShowcaseSection.tsx` accepts `workflowType: 'standard-ads' | 'multi-variant-ads' | 'character-ads'` and hits `/api/multi-variant-ads/showcase` when that type is selected. Update the type unions, API selection logic, and UI copy so only the remaining workflows display.
- `components/layout/Header.tsx`, `Footer.tsx`, and `components/layout/Sidebar.tsx` all link to `/features/multi-variant-ads` and `/dashboard/multi-variant-ads`. Remove the menu entries, adjust onboarding IDs, and ensure spacing looks correct once an item disappears.
- `lib/onboarding-steps.ts` contains the `'multi-variant-ads'` guided tour entry tied to the sidebar ID `sidebar-multi-variant` and instructions that mention the “multi-variant” history view. Delete the step to keep the onboarding checklist in sync.
- `next.config.ts` currently redirects `/dashboard/generate-v2` to `/dashboard/multi-variant-generator`. Remove the redirect (and any other rewrites) that point at the deleted page.

## 3. Multi-variant specific API routes & background jobs
- `app/api/multi-variant-ads/create/route.ts` validates KIE credits and calls `startMultiVariantItems`. Remove the handler after killing the workflow.
- `app/api/multi-variant-ads/items-status/route.ts` proxies `getMultiVariantItemsStatus` for polling.
- `app/api/multi-variant-ads/[id]/download/route.ts` provides cover/video downloads (including `validateOnly` logic and free download credits). The history page and TikTok publishing rely on this endpoint.
- `app/api/multi-variant-ads/history/route.ts` returns the user’s multi-variant projects; it is wired into History page filters.
- `app/api/multi-variant-ads/showcase/route.ts` powers the landing page showcase cards (`ShowcaseSection`).
- `app/api/multi-variant-ads/monitor-tasks/route.ts` is a long-running cron endpoint that sweeps unfinished projects, updates Supabase rows, and retries failures. Delete it together with any scheduler configuration.
- `app/api/multi-variant-ads/ad-copy/route.ts` and `app/api/multi-variant-ads/watermark/route.ts` re-export the standard-ads handlers for parity; these can drop once no clients depend on them.

## 4. Shared data surfaces that mix multi-variant items with other features
- `app/api/history/route.ts` merges Standard, Multi-Variant, Character, and Watermark Removal projects and exposes `adType: 'multi-variant'`. Remove the multi-variant query block, type definitions, and union members.
- `components/pages/HistoryPage.tsx` mirrors that logic: `MultiVariantAdsItem` interface, `isMultiVariantAds` type guard, filter options, download buttons (calling `/api/multi-variant-ads/[id]/download`), and the CTA labels (“Multi variant”). All of that must be stripped or refactored to avoid runtime errors.
- `app/api/discover/route.ts` and `components/pages/HomePage.tsx` include the `'multi-variant'` filter state (UI buttons, type unions) and fetch `multi_variant_ads_projects` when a user browses discover content. Remove the branch, update type guards, and ensure the masonry grid still renders correctly for remaining item types.
- `components/pages/HomePage.tsx: DiscoverType`, the filter buttons (icon + label), and the logic that writes “Multi-Variant” must be updated to drop that option.
- `app/api/recent-videos/route.ts` compares the latest `standard_ads_projects` and `multi_variant_ads_projects` rows; remove the multi-variant fetch and simplify the response shape.
- `app/api/user-stats/route.ts` aggregates credit usage and download counts by iterating over `multi_variant_ads_projects`. Delete those queries/counters and adjust the return payload accordingly.
- `app/api/user-products/[id]/route.ts` counts references in `multi_variant_ads_projects` before deleting a product and logs the totals. Removing the feature means you should delete this count (and any log messaging that references it).
- `app/api/tiktok/publish/init/route.ts` attempts to find a video by ID inside `multi_variant_ads_projects` if it wasn’t found in standard ads. Update the fallback logic and associated user messaging.
- `app/api/discover/route.ts`, `components/ui/ShowcaseSection.tsx`, `components/pages/HomePage.tsx`, and `public/llms.txt` mention “multi-variant” in human-facing copy; scrub the text to avoid referencing a removed feature.

## 5. Multi-variant Supabase data + supporting files
- `app/api/multi-variant-ads/history/route.ts`, `monitor-tasks`, `showcase`, `items-status`, and the workflow all touch the `multi_variant_ads_projects` table. When removing the feature entirely, plan a Supabase migration to drop the table and any dependent foreign keys/indices once data retention policies allow it.
- `docs/tiktok/integration-progress.md`, `AGENTS.md`, `CLAUDE.md`, and `public/llms.txt` document the table and feature. Update or delete those references so internal docs stay accurate.

## 6. Follow-up + open questions
1. Removing the feature makes the `/dashboard/multi-variant-ads` route invalid. Decide whether we want to 301 any existing links to `/dashboard/standard-ads` or show an informative fallback before deleting the redirect.
2. Data migration: if historical multi-variant projects must stay accessible for compliance, consider exporting them before dropping the table or expose them in read-only mode elsewhere.
3. Scheduler clean-up: verify whether any external cron job (e.g., Vercel cron or Supabase edge function) currently invokes `app/api/multi-variant-ads/monitor-tasks`. Removing the endpoint requires touching the infra configuration.
4. After removing references, run `pnpm lint` and `pnpm type-check`; the unions (`DiscoverType`, `HistoryItem`, `ShowcaseSection workflowType`, etc.) will fail until they’re updated.
