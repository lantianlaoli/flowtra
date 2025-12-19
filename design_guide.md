# Design Specification: Minimalist SaaS/Template Marketplace

## 1. Design Philosophy
*   **Minimalism:** High use of negative space (white space) to reduce cognitive load.
*   **High Contrast:** Strict black-on-white palette for maximum readability.
*   **Geometric Precision:** Clean lines, consistent border-radii, and grid-based alignment.
*   **Clarity:** Clear hierarchy using typography and subtle shadows rather than complex colors.

## 2. Color Palette
| Token | Hex/Value | Usage |
|:---|:---|:---|
| `color-bg-primary` | `#FFFFFF` | Main page background |
| `color-bg-secondary` | `#F7F7F7` | Card backgrounds, section alternates |
| `color-text-primary` | `#000000` | Headings, primary buttons, main text |
| `color-text-secondary` | `#666666` | Subheadings, body descriptions, footer links |
| `color-border` | `#E5E5E5` | Card borders, secondary button strokes |
| `color-accent` | `#000000` | Primary CTAs, active states |

## 3. Typography
*   **Font Family:** Geometric Sans-Serif (e.g., *Inter*, *Plus Jakarta Sans*, or *Satoshi*).
*   **Weights:** Regular (400), Medium (500), Semi-Bold (600), Bold (700).
*   **Hierarchy:**
    *   **H1 (Hero):** 48px - 64px, Bold, Letter-spacing: -0.02em.
    *   **H2 (Section):** 32px - 40px, Semi-Bold, Centered.
    *   **H3 (Card Title):** 20px - 24px, Semi-Bold.
    *   **Body:** 16px, Regular, Line-height: 1.6.
    *   **Small/Label:** 12px - 14px, Medium, All-caps or Title Case.

## 4. Components & UI Elements

### Navigation Bar
*   **Height:** 72px - 80px.
*   **Layout:** Logo (Left) | Links (Center) | Auth CTAs (Right).
*   **Links:** 14px, Medium, Gray text shifting to Black on hover.

### Buttons
*   **Primary Button:**
    *   Background: Black.
    *   Text: White, 14px/16px, Medium.
    *   Border-radius: 8px.
    *   Padding: 12px 24px.
*   **Secondary Button:**
    *   Background: White.
    *   Border: 1px solid `#E5E5E5`.
    *   Text: Black.
    *   Border-radius: 8px.
*   **Pill Tags:** Small badges (e.g., "$49", "Top Selling") with light gray borders and rounded-full corners.

### Cards (Template Card)
*   **Structure:**
    1.  Image Container: Background `#F1F1F1`, 12px border-radius, subtle inner shadow.
    2.  Product Image: Centered with a soft drop shadow (`0 20px 40px rgba(0,0,0,0.1)`).
    3.  Meta Info: Price and Tags in a row.
    4.  Title: H3 style.
    5.  Description: Secondary text, max 2-3 lines.
    6.  Action: Full-width secondary button "View Template".

### Layout Grid
*   **Max Width:** 1280px.
*   **Gutter:** 24px - 32px.
*   **Template Grid:** 3 columns on desktop, 1 column on mobile.
*   **Feature Grid:** 1 large card + 2 smaller cards (as seen in the "Everything You Need" section).

## 5. Visual Accents
*   **Shadows:** Use extremely soft, blurred shadows for depth. Avoid hard edges.
*   **Illustrations:** Minimalist, hand-drawn style line art or flat grayscale vectors.
*   **Icons:** Thin-stroke geometric line icons (e.g., Lucide React or Phosphor Icons).