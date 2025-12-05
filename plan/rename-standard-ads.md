# Competitor UGC Replication Rename Plan

1. **Inventory & Decisions**
   - Enumerate every "Standard Ads" reference across code, routing, marketing copy, and Supabase types/tables (including camelCase/PascalCase/slug variants).
   - Define the canonical replacements:
     - Display copy → `Competitor UGC Replication`.
     - URL slug → `competitor-ugc-replication`.
     - camelCase identifier → `competitorUgcReplication`.
     - snake_case/database identifier → `competitor_ugc_replication`.
   - Confirm there are no ancillary product names (e.g., "Standard" filters) left unnamed before editing.

2. **Application Renames**
   - Rename directories/files (`app/features/competitor-ugc-replication`, `app/(app-shell)/dashboard/competitor-ugc-replication`, `lib/competitor-ugc-replication-workflow.ts`, `hooks/useCompetitorUgcReplicationWorkflow.ts`, related components/hooks) to their Competitor UGC counterparts; update exports/imports accordingly.
   - Update React components, contexts, hooks, and constants to use the new naming plus UI copy everywhere (sidebar items, Hero cards, onboarding modals, session storage keys, analytics labels, etc.).
   - Adjust route handlers (`app/api/competitor-ugc-replication/*`) and client fetchers to live under the new slug; ensure any dynamic route params or fetch URLs align.

3. **Database & API Surface**
   - Create a Supabase migration that renames `standard_ads_projects` → `competitor_ugc_replication_projects` and `standard_ads_segments` → `competitor_ugc_replication_segments`, including foreign keys, indexes, and references.
   - Update `lib/supabase.ts` table definitions/types plus every `supabase.from('standard_ads_*')` query to target the renamed tables.
   - Ensure API payload discriminators (e.g., history filters, ad type enums) use the updated naming so downstream analytics/storage stay consistent.

4. **Docs, Utilities & Validation**
   - Refresh documentation (`AGENTS.md`, `GEMINI.md`, blog/marketing features, public SEO metadata) to mention Competitor UGC Replication instead of Standard Ads.
   - Update any scripts/tests referencing the legacy name.
   - Re-run targeted type checks or lint if practical to validate the rename touches (especially for file moves and type unions).
