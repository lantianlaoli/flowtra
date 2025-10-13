# Pricing and Billing Rules

## Overview

Flowtra operates on a **credit-based system** with **one-time purchases** (no subscriptions). Credits are charged **at generation time** when creating videos, while downloads are **completely FREE**. Images remain free to generate and download.

---

## Credit System Architecture

### Core Principles (Generation-Time Billing Model)

1. **Generation costs credits** - Credits are charged upfront when video generation starts
2. **Downloads are FREE** - All video downloads are completely free (unlimited)
3. **Images are FREE** - Image generation and downloads remain free forever
4. **Automatic refunds** - If generation fails, credits are automatically refunded
5. **Unified billing** - All video models (Sora2, Veo3, Veo3 Fast, Sora2 Pro) charge upfront

### Initial Free Credits

- **New User Bonus**: 100 credits
- **Purpose**: Allow users to test the platform (≈5 video generations with Veo3 Fast)
- **Auto-granted**: Automatically initialized upon first login
- **Transaction Type**: Recorded as "purchase" type in `credit_transactions` table

---

## AI Model Pricing

### Video Models (Credit Cost Per Generation - Upfront Billing)

| Model | Credits/Generation | Processing Time | Quality | Aspect Ratios | Duration |
|-------|-------------------|-----------------|---------|---------------|----------|
| **Veo3 Fast** | 20 credits | 2-3 min | Standard Quality | 16:9, 9:16 | 8s |
| **Veo3** | 150 credits | 5-8 min | High Quality | 16:9, 9:16 | 8s |
| **Sora2** | 6 credits | 8-12 min | Premium Quality | 16:9, 9:16 | 10s |
| **Sora2 Pro (10s Standard)** | 36 credits | 10-15 min | Professional | 16:9, 9:16 | 10s |
| **Sora2 Pro (10s High)** | 54 credits | 15-20 min | Professional+ | 16:9, 9:16 | 10s |
| **Sora2 Pro (15s Standard)** | 80 credits | 15-20 min | Professional | 16:9, 9:16 | 15s |
| **Sora2 Pro (15s High)** | 160 credits | 20-30 min | Professional+ | 16:9, 9:16 | 15s |

**Implementation Notes:**
- Credits are charged **upfront when generation starts** (not at download)
- **Downloads are completely FREE** (unlimited)
- Automatic refund if generation fails
- Veo3 Fast is the default recommended model (best cost/time ratio)
- Sora2 Pro has dynamic pricing based on duration (10s/15s) and quality (standard/high)
- Auto mode intelligently selects fastest affordable model (prioritizes Veo3 Fast)

### Image Models (Free Forever)

| Model | Credits/Generation | Processing Time | Aspect Ratio Support |
|-------|-------------------|-----------------|---------------------|
| **Nano Banana** | 0 credits (FREE) | 1-2 min | 9 options (auto, square, portrait_*, landscape_*) |
| **Seedream 4.0** | 0 credits (FREE) | 2-4 min | 10 options (auto, square, square_hd, portrait_*, landscape_*) |

**Implementation Notes:**
- `IMAGE_CREDIT_COSTS.nano_banana = 0`
- `IMAGE_CREDIT_COSTS.seedream = 0`
- Default auto mode selects Seedream (better aspect ratio support)
- Images remain free regardless of billing model changes

---

## Package Plans

### Payment Model
- **Type**: One-time purchase (lifetime access)
- **Payment Gateway**: Creem
- **Currency**: USD ($)
- **No Subscriptions**: Pay once, use forever

### Available Packages

#### 1. Lite Pack ($9)
```typescript
{
  name: 'Lite',
  price: 9,
  credits: 500,
  description: 'Entry Pack',
  videoEstimates: {
    veo3_fast: 25,   // 500 / 20 = 25 generations
    veo3: 3,         // 500 / 150 ≈ 3 generations
    sora2: 83        // 500 / 6 ≈ 83 generations
  }
}
```

**Features:**
- 500 credits
- ≈25 Veo3 Fast video generations
- ≈3 Veo3 high-quality video generations
- ≈83 Sora2 video generations
- Free unlimited downloads
- Free image generation
- Access to all workflows (Standard Ads, Multi-Variant Ads, Character Ads)

#### 2. Basic Pack ($29) - **RECOMMENDED**
```typescript
{
  name: 'Basic',
  price: 29,
  credits: 2000,
  description: 'Recommended Plan',
  videoEstimates: {
    veo3_fast: 100,  // 2000 / 20 = 100 generations
    veo3: 13,        // 2000 / 150 ≈ 13 generations
    sora2: 333       // 2000 / 6 ≈ 333 generations
  }
}
```

**Features:**
- 2,000 credits
- ≈100 Veo3 Fast video generations
- ≈13 Veo3 high-quality video generations
- ≈333 Sora2 video generations
- Free unlimited downloads
- Free image generation
- Access to all workflows
- **Highlighted as recommended plan in UI**

#### 3. Pro Pack ($49)
```typescript
{
  name: 'Pro',
  price: 49,
  credits: 3500,
  description: 'Advanced Pack',
  videoEstimates: {
    veo3_fast: 175,  // 3500 / 20 = 175 generations
    veo3: 23,        // 3500 / 150 ≈ 23 generations
    sora2: 583       // 3500 / 6 ≈ 583 generations
  }
}
```

**Features:**
- 3,500 credits
- ≈175 Veo3 Fast video generations
- ≈23 Veo3 high-quality video generations
- ≈583 Sora2 video generations
- Free unlimited downloads
- Free image generation
- Access to all workflows
- **Priority processing queue**

---

## Credit Usage Rules

### Generation Phase (PAID - Upfront Billing)
```typescript
// Cover image generation - NO credits consumed
IMAGE_CREDIT_COSTS.nano_banana = 0
IMAGE_CREDIT_COSTS.seedream = 0

// Video generation - Credits charged UPFRONT
CREDIT_COSTS.veo3_fast = 20   // 20 credits per 8s video
CREDIT_COSTS.veo3 = 150       // 150 credits per 8s video
CREDIT_COSTS.sora2 = 6        // 6 credits per 10s video

// Sora2 Pro - Dynamic pricing
getSora2ProCreditCost('10', 'standard') = 36   // 10s standard
getSora2ProCreditCost('10', 'high') = 54       // 10s high quality
getSora2ProCreditCost('15', 'standard') = 80   // 15s standard
getSora2ProCreditCost('15', 'high') = 160      // 15s high quality
```

### Download Phase (FREE)
```typescript
// All video downloads are completely FREE
// No credit deduction at download time
// Users can re-download videos unlimited times
```

**Implementation Notes:**
- Credits are deducted in workflow files (`lib/*-workflow.ts`)
- Automatic refund if generation fails
- Download API endpoints (`/api/*/download`) only mark download status
- No credit checking at download time

### Credit Transaction Types

```typescript
type TransactionType = 'usage' | 'purchase' | 'refund'

// Usage: Video generation (-credits) - charged upfront
// Purchase: Package purchases, initial free credits (+credits)
// Refund: Failed generations, error compensation (+credits)
```

**Transaction Recording:**
- All credit changes logged in `credit_transactions` table
- Linked to `history_id` when applicable (track which generation used credits)
- Amount is negative for usage, positive for purchases/refunds
- Downloads are NOT recorded as transactions (free)

---

## Auto Mode Intelligence

### Video Model Selection
```typescript
function getAutoModeSelection(userCredits: number): 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | null {
  // Priority: Fastest and most cost-effective model first
  if (userCredits >= CREDIT_COSTS.sora2) {
    return 'sora2'       // 6 credits - PRIORITIZED (cheapest)
  } else if (userCredits >= CREDIT_COSTS.veo3_fast) {
    return 'veo3_fast'   // 20 credits - FALLBACK
  } else if (userCredits >= CREDIT_COSTS.veo3) {
    return 'veo3'        // 150 credits
  } else if (userCredits >= getSora2ProCreditCost('10', 'standard')) {
    return 'sora2_pro'   // 36+ credits
  } else {
    return null          // Insufficient credits
  }
}
```

**Logic:**
1. Prioritize **Sora2** (cheapest at 6 credits, good quality)
2. Fallback to **Veo3 Fast** (20 credits, faster processing)
3. Fallback to **Veo3** (150 credits, highest quality)
4. Fallback to **Sora2 Pro** (36+ credits, professional quality)
5. Return `null` if insufficient credits for any model

### Image Model Selection
```typescript
function getAutoImageModeSelection(): 'nano_banana' | 'seedream' {
  return 'seedream'  // Default: Better aspect ratio support (16:9, 9:16)
}
```

**Rationale:**
- Seedream supports more aspect ratios (10 vs 9)
- Includes `square_hd` option for higher quality square images
- Better compatibility with video aspect ratios (16:9, 9:16)

---

## Credit Check and Validation

### Pre-Generation Check (Critical for Generation-Time Billing)
```typescript
// Check if user has sufficient credits before generation
async function checkCredits(userId: string, requiredCredits: number): Promise<{
  success: boolean
  hasEnoughCredits?: boolean
  currentCredits?: number
  error?: string
}>
```

**Validation Rules:**
1. Check current user balance from `user_credits` table BEFORE generation starts
2. Calculate required credits based on selected model and settings
3. For Sora2 Pro: Use `getSora2ProCreditCost(duration, quality)`
4. Reject operation if `currentCredits < requiredCredits`
5. Display insufficient credits modal with upgrade options
6. **Critical**: Must check BEFORE any generation starts (upfront billing)

### Credit Deduction
```typescript
// Deduct credits (supports negative values for refunds)
async function deductCredits(userId: string, creditsToDeduct: number): Promise<{
  success: boolean
  remainingCredits?: number
  error?: string
}>
```

**Process:**
1. Pre-check user has sufficient credits (if positive deduction)
2. Calculate new balance: `currentCredits - creditsToDeduct`
3. Update `user_credits` table atomically
4. Record transaction in `credit_transactions` table
5. Return new balance or error

### Credit Addition
```typescript
// Add credits (for purchases and refunds)
async function addCredits(userId: string, creditsToAdd: number): Promise<{
  success: boolean
  newBalance?: number
  error?: string
}>
```

**Use Cases:**
- Package purchases via Creem webhook
- Refunds for failed generations
- Admin credits grants
- Initial free credits for new users

---

## Payment Flow

### Purchase Process

1. **User Selects Package**
   - Frontend: `PricingPage.tsx` or `CreditsPage.tsx`
   - Click "Get Started" button

2. **Checkout Creation**
   ```typescript
   POST /api/create-checkout
   Body: { packageName: 'lite' | 'basic' | 'pro', userEmail: string }
   ```

3. **Creem Integration**
   - Create checkout session via Creem API
   - Redirect user to `checkout_url`
   - Creem handles payment collection

4. **Webhook Processing**
   ```typescript
   POST /api/webhooks/creem
   Body: { event: 'checkout.completed', product_id, customer_email, ... }
   ```

5. **Credit Grant**
   - Verify webhook signature
   - Map `product_id` to credits amount
   - Call `addCredits(userId, amount)`
   - Record transaction as 'purchase' type

### Product ID Mapping

```typescript
function getCreditsFromProductId(productId: string): { credits: number; packageName: string } | null {
  // Environment-specific product IDs
  const liteDevId = process.env.LITE_PACK_CREEM_DEV_ID
  const liteProdId = process.env.LITE_PACK_CREEM_PROD_ID
  const basicDevId = process.env.BASIC_PACK_CREEM_DEV_ID
  const basicProdId = process.env.BASIC_PACK_CREEM_PROD_ID
  const proDevId = process.env.PRO_PACK_CREEM_DEV_ID
  const proProdId = process.env.PRO_PACK_CREEM_PROD_ID

  // Returns matching package or null
}
```

**Environment Variables:**
- `LITE_PACK_CREEM_DEV_ID` / `LITE_PACK_CREEM_PROD_ID`
- `BASIC_PACK_CREEM_DEV_ID` / `BASIC_PACK_CREEM_PROD_ID`
- `PRO_PACK_CREEM_DEV_ID` / `PRO_PACK_CREEM_PROD_ID`

---

## Database Schema

### user_credits Table
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,  -- Clerk user ID
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- Read: Users can read their own credits
- Write: Service role only (server-side operations)

### credit_transactions Table
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,  -- Clerk user ID
  type TEXT NOT NULL,  -- 'usage' | 'purchase' | 'refund'
  amount INTEGER NOT NULL,  -- Negative for usage, positive for purchase/refund
  description TEXT NOT NULL,
  history_id UUID REFERENCES {workflow}_history(id),  -- Optional link to specific workflow
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexing:**
- `user_id` - For transaction history queries
- `created_at` - For sorting recent transactions
- `history_id` - For linking downloads to specific videos

---

## Error Handling and Refunds

### Automatic Refund Scenarios (Generation-Time Billing)

1. **Generation Failures** (Automatic Refund)
   - API timeout (>15min for images, >30min for videos)
   - External API errors (KIE, OpenRouter)
   - Invalid model outputs
   - Workflow execution errors
   - Credit already deducted upfront, must be refunded

2. **Download Failures** (No Refund Needed)
   - Downloads are FREE, no credits involved
   - No refund mechanism needed for downloads
   - Users can retry downloads unlimited times

### Refund Implementation
```typescript
// Automatic refund in workflow error handlers
catch (workflowError) {
  console.error('Workflow failed:', workflowError);

  // Refund credits that were deducted upfront
  if (creditsCost > 0) {
    await deductCredits(userId, -creditsCost);  // Negative = refund
    await recordCreditTransaction(
      userId,
      'refund',
      creditsCost,
      `Refund for failed ${videoModel} video generation`,
      historyId
    );
  }

  throw workflowError;  // Re-throw to mark project as failed
}
```

**Business Rules:**
- **Automatic refund** for all generation failures (credits already deducted)
- Manual refund via admin for quality issues
- No refund for user errors (wrong settings, etc.)
- Downloads never need refunds (free)

---

## Service Availability Monitoring

### KIE API Credit Threshold

```typescript
// Minimum KIE credits required for service availability
export const KIE_CREDIT_THRESHOLD = (() => {
  const raw = process.env.KIE_CREDIT_THRESHOLD;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();
```

**Purpose:**
- Prevent service failures when KIE API balance is low
- Default: 300 credits
- Configurable via environment variable
- Check via `/api/check-kie-credits` endpoint

**Monitoring:**
- Periodic API balance checks
- Alert admins when balance < threshold
- Display service unavailability message to users
- Automatic service resumption when balance restored

---

## Constants Reference

### File: `lib/constants.ts`

```typescript
// Credit costs for video models (GENERATION-TIME BILLING)
export const CREDIT_COSTS = {
  'veo3_fast': 20,   // Per 8s video generation
  'veo3': 150,       // Per 8s video generation
  'sora2': 6,        // Per 10s video generation
} as const

// Sora2 Pro dynamic pricing
export function getSora2ProCreditCost(
  duration: '10' | '15',
  quality: 'standard' | 'high'
): number {
  if (duration === '10' && quality === 'standard') return 36;
  if (duration === '10' && quality === 'high') return 54;
  if (duration === '15' && quality === 'standard') return 80;
  if (duration === '15' && quality === 'high') return 160;
  return 36; // Default fallback
}

// Image models (FREE)
export const IMAGE_CREDIT_COSTS = {
  'nano_banana': 0,
  'seedream': 0,
} as const

// Initial free credits
export const INITIAL_FREE_CREDITS = 100

// Package definitions
export const PACKAGES = {
  lite: { name: 'Lite', price: 9, credits: 500, ... },
  basic: { name: 'Basic', price: 29, credits: 2000, ... },
  pro: { name: 'Pro', price: 49, credits: 3500, ... }
} as const
```

---

## Usage Statistics

### Typical User Workflows (Generation-Time Billing)

**Standard Ads Workflow** (1 video):
- Image description: ~2 credits (OpenRouter) - **Currently FREE**
- Prompt generation: ~2 credits (OpenRouter) - **Currently FREE**
- Cover image: 0 credits (Nano/Seedream) - **FREE**
- Video generation: Charged upfront based on model:
  - Sora2: **6 credits**
  - Veo3 Fast: **20 credits**
  - Veo3 HQ: **150 credits**
  - Sora2 Pro: **36-160 credits** (depends on duration/quality)
- Video download: **FREE** (unlimited re-downloads)

**Total Cost Per Workflow:**
- With Sora2: **6 credits** (generation only, downloads free)
- With Veo3 Fast: **20 credits** (generation only, downloads free)
- With Veo3 HQ: **150 credits** (generation only, downloads free)
- With Sora2 Pro 10s Standard: **36 credits**
- With Sora2 Pro 15s High: **160 credits**

**Free Credits (100) Capacity:**
- ≈16 Sora2 video generations
- ≈5 Veo3 Fast video generations
- ≈0 Veo3 HQ video generations (need to purchase)
- ≈2 Sora2 Pro 10s Standard generations
- Unlimited downloads and image generations

---

## Business Model Advantages

1. **Transparent Pricing**: No hidden fees, clear credit costs upfront
2. **Try Before Buy**: 100 free credits to test platform (≈5 Veo3 Fast videos)
3. **No Subscriptions**: One-time purchase, lifetime access
4. **Free Downloads**: Unlimited re-downloads of generated content
5. **Pay for Results**: Credits charged at generation, refunded if failed
6. **Predictable Costs**: Fixed credit prices per model and settings
7. **Scalable**: Buy more credits as needed, no monthly commitment
8. **Risk-Free**: Automatic refunds for generation failures

---

## Future Considerations

### Potential Enhancements

1. **Credit Expiration**: Consider 1-year expiration for purchased credits
2. **Bulk Discounts**: Offer larger packages with better per-credit pricing
3. **Subscription Tier**: Optional monthly subscription for power users
4. **Credit Sharing**: Allow team accounts with shared credit pools
5. **Pay-as-you-go**: Smaller credit packages ($5 for 250 credits)
6. **Enterprise Plans**: Custom pricing for high-volume users

### Analytics to Track

- Average credits per user per month
- Most popular video model (Veo3 Fast vs Veo3 vs Sora2)
- Package conversion rates (Lite vs Basic vs Pro)
- Refund rate and reasons
- Credit balance distribution (identify inactive credits)

---

## Compliance and Legal

### Terms of Service Highlights

1. **No Refunds**: Once credits are purchased, no refunds (except service errors)
2. **Credit Ownership**: Credits are non-transferable
3. **Service Availability**: No SLA guarantee, best-effort basis
4. **Price Changes**: Prices may change for new purchases (existing credits unaffected)
5. **Account Termination**: Credits forfeited upon voluntary account deletion

### Privacy Considerations

- Credit transaction history stored for audit purposes
- No sharing of purchase data with third parties (except payment processor)
- Anonymized analytics for business intelligence

---

## Support and Contact

For billing issues, credit discrepancies, or refund requests:
- **Support Page**: `/dashboard/support`
- **Email**: Contact via support form
- **Response Time**: 24-48 hours

---

## Document Change Log

### Version 2.0 - 2025-10-13
**Major Update: Generation-Time Billing Model**

**Breaking Changes:**
- Credits now charged at **generation time** (not download)
- Downloads are now **completely FREE** (unlimited)
- All video models use **unified upfront billing**
- Automatic refunds implemented for generation failures

**New Features:**
- **Sora2 Pro** support with dynamic pricing (36-160 credits)
- Sora2 Pro duration options: 10s, 15s
- Sora2 Pro quality options: standard, high
- Updated credit costs: Veo3 Fast (20→20), Veo3 (150), Sora2 (6), Sora2 Pro (36-160)

**Rationale:**
- Simplifies user experience (no download friction)
- Reduces support overhead (no download credit issues)
- Encourages content sharing (free downloads)
- More predictable costs (pay upfront, refund on failure)

### Version 1.0 - Initial Release
- Download-time billing model
- Veo3 Fast (30 credits), Veo3 (150 credits), Sora2 (30 credits)
- Download cost: 18 credits (60% of Veo3 Fast)

---

**Document Version**: 2.0
**Last Updated**: 2025-10-13
**Maintained By**: Engineering Team
**Related Files**:
- `lib/constants.ts` - Credit costs and packages
- `lib/credits.ts` - Credit management functions
- `lib/payment.ts` - Payment flow handlers
- `lib/standard-ads-workflow.ts` - Standard ads workflow with billing
- `lib/multi-variant-ads-workflow.ts` - Multi-variant ads workflow
- `lib/character-ads-workflow.ts` - Character ads workflow (via API route)
- `lib/kie-sora2-pro.ts` - Sora2 Pro API integration
- `components/pages/PricingPage.tsx` - Pricing UI
- `components/pages/LandingPage.tsx` - Landing page pricing section
- `app/api/*/download/route.ts` - Download endpoints (no billing)
