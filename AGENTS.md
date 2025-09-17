- use pnpm as default package manager
- Communication is in Chinese, while coding and comments are in English.
- ## Notifications
When tasks complete, notify me using:
powershell.exe -c "[System.Media.SystemSounds]::Beep.Play()"

# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router (server/client components, layouts, middleware entry points).
- `components/` Reusable UI (PascalCase files), `contexts/`, `hooks/` (React hooks), `lib/` (service clients), `utils/` (pure helpers).
- `public/` static assets, `supabase/` configuration, root config: `next.config.ts`, `tsconfig.json`, `middleware.ts`.
- Environment: copy `.env.example` to `.env` before running locally.

## Build, Test, and Development Commands
- `pnpm dev` — Run the local dev server.
- `pnpm build` — Production build via Next.js.
- `pnpm start` — Start the built app.
- `pnpm lint` — ESLint checks (Next.js config).
- `pnpm type-check` — TypeScript type checking (no emit).
- Playwright (if tests present): `npx playwright test` or `npx playwright test path/to/spec.ts`.

## Coding Style & Naming Conventions
- TypeScript everywhere; follow existing 2‑space indentation and import style.
- Components: PascalCase (`components/MyCard.tsx`). Hooks: `useX` (`hooks/useCredits.ts`). Utils: camelCase. Types/Enums: PascalCase.
- App routes use folder/segment names matching URL needs (prefer kebab-case for segments).
- TailwindCSS v4: co-locate styles in components; use `clsx`/`tailwind-merge` for conditional classes.
- Run `pnpm lint --fix` before pushing.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`) for e2e. Place specs in `e2e/` or `tests/` as `*.spec.ts`/`*.test.ts`.
- Prefer stable selectors (`data-testid`) over text selectors.
- Run all: `npx playwright test`. Debug: `npx playwright test --ui`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:` with optional scopes (mirrors current history).
- PRs: clear description, linked issues, screenshots/GIFs for UI changes, and notes on env/config changes.
- Checks must pass: `pnpm lint` and `pnpm type-check`. Keep PRs focused and small.

## Security & Configuration
- Never commit secrets. Use `.env` (see `.env.example`). Required keys typically include Clerk and Supabase configuration (`NEXT_PUBLIC_*`, service keys).
- Access env via `process.env.*`; avoid logging secrets.
