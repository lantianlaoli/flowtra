# Flowtra Developer Context (GEMINI.md)

This document provides the necessary context, conventions, and architectural overview for an AI agent to effectively work on the Flowtra codebase.

## 1. Project Overview

Flowtra is a modern **Next.js 15** application designed to help small businesses (Shopify, Etsy, etc.) generate UGC-style marketing videos and images using AI. It integrates deeply with generative AI models (KIE, OpenRouter) and uses a credit-based system for billing.

### Key Technologies
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4 (Dark Mode supported)
- **Database:** Supabase
- **Authentication:** Clerk
- **AI Integration:**
    - **KIE API:** Video/Image generation (Veo3, Sora2, Sora2 Pro).
    - **OpenRouter:** Prompt engineering and text generation.
- **Analytics:** PostHog, Vercel Analytics
- **Payments:** Creem (via custom integration)
- **Package Manager:** `pnpm` (Strict enforcement)

## 2. Architecture & Directory Structure

### Core Directories
- **`app/`**: Application routes (App Router).
    - `api/`: Backend logic (Route Handlers). This is where most server-side logic connects to `lib/`.
    - `dashboard/`: Authenticated user interface.
    - `(app-shell)/`: Layouts for the main application experience.
- **`components/`**: Reusable UI components (PascalCase).
- **`lib/`**: The "Brain" of the backend. Contains business logic, workflow orchestration, and API clients.
    - `*-workflow.ts`: Orchestrates complex AI generation tasks (Standard, Multi-variant, Character).
    - `kie-*.ts`: KIE API wrappers and credit checks.
    - `supabase.ts`: Database client initialization.
    - `constants.ts`: **CRITICAL**. Contains pricing models, credit costs, and configuration.
- **`hooks/`**: Custom React hooks (`useStandardAdsWorkflow`, etc.).
- **`contexts/`**: Global state (Credits, Toasts).

### Key Workflows (The "Product")
1.  **Standard Ads**: Single video generation from product images.
2.  **Multi-Variant Ads**: Multiple video variants from a single image.
3.  **Character Ads**: Character-driven advertisements.
4.  **Watermark Removal**: Specialized tool for cleaning video outputs.

## 3. Billing & Credit Model (Version 3.0)

**Crucial Concept:** The application uses a "Mixed Billing" model. You MUST understand this before modifying generation or download logic.

-   **Basic Models (e.g., Veo3 Fast, Sora2):**
    -   **Generation:** FREE (0 credits deducted).
    -   **Download:** PAID (credits deducted on first download).
-   **Premium Models (e.g., Veo3, Sora2 Pro):**
    -   **Generation:** PAID (credits deducted upfront).
    -   **Download:** FREE (no additional cost).

*Reference `lib/constants.ts` for exact costs and model classifications.*

## 4. Development Conventions

### General
-   **Package Manager:** ALWAYS use `pnpm`.
    -   `pnpm dev`: Start dev server.
    -   `pnpm build`: Production build.
    -   `pnpm lint`: Run ESLint.
-   **Language:** Write code in English. Comments in English.
-   **Formatting:** Prettier is likely used (inferred). Match existing style.

### Coding Style
-   **Imports:** Group imports logically (External -> Internal -> Styles).
-   **Components:** Use Functional Components with TypeScript interfaces for props.
-   **Server Actions/APIs:** Prefer Route Handlers in `app/api/` for complex logic over Server Actions if heavy processing/timeouts are a concern (due to Vercel limits on Server Actions in some contexts, though Next.js 15 supports them well; follow existing patterns).
-   **Error Handling:** Use `fetchWithRetry` for external APIs. Log errors to PostHog/Console but NEVER log secrets.

### AI Prompt Engineering
-   Prompts live in code (e.g., `lib/*-ads-workflow.ts`).
-   When modifying prompts, ensure you understand the JSON schema expected by the AI models.
-   **Dual-Mode:** "Standard Ads" supports both "Traditional" (pure generation) and "Competitor Reference" (cloning structure) modes.

## 5. Environment Variables
(See `.env.example` for the full list)
-   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
-   `SUPABASE_SECRET_KEY` (Server-side only)
-   `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
-   `KIE_API_KEY`
-   `OPENROUTER_API_KEY`

## 6. Important "Do Nots"
-   **DO NOT** commit `.env` files.
-   **DO NOT** change the billing logic in `lib/constants.ts` without explicit instruction.
-   **DO NOT** revert the "Mixed Billing" model to a purely upfront or purely download-based model.
-   **DO NOT** remove English UI copy.

## 7. Testing
-   **End-to-End:** Playwright is installed. Look for tests in `tests/` or similar (if they exist).
-   **Linting:** Run `pnpm lint` before declaring a task complete.
-   **Type Check:** Run `pnpm type-check` to ensure TypeScript safety.
