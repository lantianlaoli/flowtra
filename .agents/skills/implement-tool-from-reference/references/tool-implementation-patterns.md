# Tool Implementation Patterns

## Source Inventory

- Search the reference project with `rg` before copying any code.
- Identify source page routes, API routes, helpers, provider integrations, tests, prompts, assets, environment variables, and dependencies.
- Preserve the intended user-visible behavior, output formats, prompt constraints, filenames, and retry/regenerate semantics.
- Replace source infrastructure with this repo's existing auth, billing, job store, webhook, upload, SEO, i18n, and UI patterns.
- Use existing dependencies and helpers first. Add packages only when there is no reasonable local equivalent.

## Target File Layout

- Use a stable lowercase hyphenated tool key and route segment.
- Put reusable domain logic in `lib/tools/<tool-key>.ts`.
- Put the user-facing tool page in `app/tools/<route>/page.tsx`.
- Put route metadata in `app/tools/<route>/layout.tsx`.
- Put server endpoints under `app/api/tools/<route>/`.
- Keep generated artifacts and provider state out of React state when they belong in Redis job metadata.

## UI Baseline

- Build the actual usable tool as the first screen, not a marketing page.
- Keep application UI copy English only. Native labels such as `中文` are allowed in language selectors.
- Follow the minimalist SaaS design: white/gray surfaces, restrained borders, compact controls, clear hierarchy, and no decorative clutter.
- Use the shared `/tools` layout for common width, hero, title, description, credit/status display, header, and footer.
- Keep feature-specific inputs/configuration above progress and results.
- Keep the primary generation action visible in the configuration surface, usually in a sticky bottom action bar.
- Put access, subscription, credit, and validation warnings on the generation button when generation is unavailable.
- Use lucide icons for section headers and commands; avoid decorative icons inside dense option lists unless they add clarity.
- Constrain scrollable option groups with fixed or flex heights so selections do not stretch the entire page.

## Generation APIs And Webhooks

- Image/video generation providers with callback support must use webhook completion. For KIE, use `/api/tools/webhooks/kie`.
- Do not implement repeated client polling for KIE task completion.
- Create the Redis job before starting provider tasks when webhook state depends on the job.
- Create `ToolGenerationTask` records with provider task IDs and compact reconciliation metadata such as slot ID, stage, language, aspect ratio, or segment index.
- Add new tools to `ToolKey`, latest-job lookup, and `lib/tools/kie-webhook-state.ts`.
- Webhook reconciliation must be idempotent: duplicate callbacks must not double-complete, double-charge, or corrupt metadata.
- Create APIs should return after job/task creation and let webhook updates drive realtime UI state.

## Redis Job State

- Store user-visible generation state through `lib/tools/job-store.ts`.
- Keep job metadata explicit: normalized inputs, selected options, output slots, progress counts, result URLs, and user-facing error messages.
- Use task metadata for webhook reconciliation instead of trusting client state.
- Update progress counts from task/slot state.
- Persist enough metadata for retry, regenerate, ZIP/export, and latest-job recovery flows.

## Billing

- Charge credits at generation start, before provider task creation.
- Charge by output count or model pricing using existing billing constants/helpers.
- Retry or regenerate actions that create new outputs should charge with the same pricing rule.
- Refund when startup fails after charging and before generation can proceed.
- Record billed credits on the job when supported by existing job-store fields.

## Supabase And Database Access

- Verify Supabase schema with MCP before writing SELECT, INSERT, UPDATE, or DELETE code.
- Document schema verification in code comments when adding database queries.
- Validate Clerk `userId` ownership server-side for user-owned rows and storage assets.
- Do not trust client-sent Supabase asset URLs when an asset ID can be resolved server-side.
- Reuse existing tables, buckets, and storage helpers before adding migrations.
- Do not add RLS policies for CRUD features unless explicitly requested; Clerk identity and server-side checks handle access in this repo.

## SEO And Navigation

- Every public tool route needs metadata in `layout.tsx`: title, description, canonical, OpenGraph, and Twitter.
- Use `DEFAULT_SOCIAL_IMAGE_URL` unless the tool has a better canonical social image.
- Add public tools to `/tools`, header/footer tool lists, i18n messages, and analytics mapping.
- Keep canonical paths under `/tools/<route>`.

## Tests And Validation

- Prefer focused unit tests over broad checks.
- Cover pure helpers such as option normalization, prompt constraints, filename/export mapping, billing calculations, title fallbacks, and slot generation.
- Cover webhook-state reconciliation for multi-task tools.
- Add focused API tests where practical for validation errors and metadata/task creation.
- Run targeted tests for changed logic and `git diff --check`.
- Do not run `pnpm build`, `pnpm type-check`, `pnpm lint`, or E2E unless explicitly requested or preparing CI/release work.
