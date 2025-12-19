@design_guide.md 根据这个设计规范，对页面dashboard/support重新进行设计，确保符合这个规范

I have completed the redesign of the `dashboard/support` page and the `FounderCard` component to strictly align with the Minimalist SaaS Design Guide.

### Changes Implemented

1.  **`components/ui/FounderCard.tsx`**:
    *   **Refactored "Featured" Variant:** Removed all glassmorphism, gradients, blurs, and glow effects.
    *   **New Style:** Implemented a clean, high-contrast card with `#F7F7F7` background and `#E5E5E5` border.
    *   **Typography & Layout:** Aligned with the geometric sans-serif style and centered layout.
    *   **Action Button:** Updated to a strict Black primary button styling.

2.  **`app/(app-shell)/dashboard/support/page.tsx`**:
    *   **Layout:** Switched to a responsive grid layout (1 column on mobile, 3 columns on desktop).
    *   **Typography:** Updated headers to match strict size specifications:
        *   **H1:** `text-5xl md:text-6xl` (48px+)
        *   **H2:** `text-3xl md:text-4xl` (36px+)
        *   **H3:** `text-xl` (20px)
        *   **Body:** `text-base` (16px)
    *   **Contact Cards:** Redesigned as "Template Cards" with consistent Icon, Title, Description, and Secondary Button structure.
    *   **Minimalism:** Increased negative space (`p-12`, `gap-8`) and removed unnecessary decorative icons.

### Verification
*   **Type Check:** Passed (`pnpm type-check`).
*   **Linting:** Checked (`pnpm lint`). No new errors introduced (existing errors in unrelated files noted).

The page now reflects the "Minimalist SaaS" aesthetic with a strict black-on-white palette and geometric precision.