---
name: implement-tool-from-reference
description: Implement, port, sync, or refactor a tool feature from another project or existing reference into this repo's /tools area. Use when adapting a page, API route, workflow, prompt helper, Redis job, KIE image/video task, Supabase-backed asset flow, SEO metadata, navigation entry, or tests from a source implementation into the target tool system.
---

# Implement Tool From Reference

## Workflow

1. Inventory the reference implementation:
   - Inspect source pages, API routes, domain helpers, provider calls, tests, and assets.
   - Identify user-visible behavior to preserve and source infrastructure to replace.
   - Prefer local repo truth over assumptions.
2. Map behavior into the target tool structure:
   - Shared logic: `lib/tools/<tool-key>.ts`.
   - UI page: `app/tools/<route>/page.tsx`.
   - SEO metadata: `app/tools/<route>/layout.tsx`.
   - APIs: `app/api/tools/<route>/`.
3. Adapt infrastructure instead of copying blindly:
   - Require Clerk auth for generation and user-owned asset access.
   - Store generation state in Redis with `ToolGenerationJob` and `ToolGenerationTask`.
   - Use KIE webhook completion through `/api/tools/webhooks/kie` whenever image/video providers support callbacks.
   - Charge credits at generation start and refund startup failures after charge.
   - Verify Supabase schema before database queries and validate Clerk ownership server-side.
4. Make the tool fit the product:
   - Keep UI copy English only; native language names are allowed in selectors.
   - Use the shared `/tools` page layout, minimalist SaaS styling, sticky generation actions, and progress/results below inputs.
   - Add route metadata, canonical URL, OpenGraph/Twitter cards, `/tools` visibility, header/footer links, i18n, and analytics entries when public.
5. Validate narrowly:
   - Port or add focused tests for normalization, prompts, filenames, billing math, API validation, and webhook reconciliation.
   - Run targeted tests and `git diff --check`.
   - Skip build, type-check, lint, and E2E unless explicitly requested.

## Required Reference

Read `references/tool-implementation-patterns.md` before implementing any referenced tool feature with generation APIs, Redis jobs, webhooks, billing, Supabase access, SEO, navigation, or substantial UI changes.
