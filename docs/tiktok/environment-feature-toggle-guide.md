# TikTok Feature Environment Toggle Guide

## Overview

TikTok integration features are now environment-aware. They are **enabled in development** and **disabled in production** with a "Coming Soon" status.

---

## Environment Detection

### Logic
```typescript
// File: lib/utils/environment.ts

export const isProduction = (): boolean => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  return siteUrl.includes('flowtra.store');
};

export const isTikTokFeatureEnabled = (): boolean => {
  return !isProduction();
};
```

### Detection Rules
- **Production**: URL contains `'flowtra.store'` → Features DISABLED
- **Development**: URL does NOT contain `'flowtra.store'` → Features ENABLED

---

## Feature Behavior

### Development Environment (Features Enabled)

**When**: `NEXT_PUBLIC_SITE_URL` does NOT contain `'flowtra.store'`

**Example URLs**:
- `http://localhost:3000`
- `https://long-needles-drum.loca.lt`
- `https://flowtra-dev.vercel.app`

**Behavior**:
- ✅ "Connect TikTok" button is clickable
- ✅ "Post to TikTok" button is clickable
- ✅ Full functionality available
- ✅ No "Coming Soon" badge shown
- ✅ All animations and hover effects work

---

### Production Environment (Features Disabled)

**When**: `NEXT_PUBLIC_SITE_URL` contains `'flowtra.store'`

**Example URLs**:
- `https://www.flowtra.store`
- `https://flowtra.store`

**Behavior**:
- ❌ "Connect TikTok" button is disabled (grayed out)
- ❌ "Post to TikTok" button is disabled (with overlay)
- 🟠 "Coming Soon" badge displayed prominently
- ❌ No animations or hover effects
- ❌ Buttons cannot be clicked

---

## UI Changes

### 1. CreditsPage - "Connect TikTok" Button

#### Development (Enabled)
```
┌─────────────────────┐
│  🔗 Connect TikTok  │  ← Normal button, clickable
└─────────────────────┘
```

#### Production (Disabled)
```
┌─────────────────────┐
│  🔗 Connect TikTok  │  🟠 Coming Soon  ← Disabled + Badge
└─────────────────────┘
   ↑ Grayed out
```

**Visual Changes**:
- Opacity reduced to 50%
- Cursor changes to `not-allowed`
- Orange "Coming Soon" badge appears to the right
- No hover effects

---

### 2. HistoryPage - "Post to TikTok" Button

#### Development (Enabled)
```
┌─────────────────────────┐
│  🎵 Post to TikTok  →  │  ← Animated gradient, clickable
└─────────────────────────┘
   ↑ Hover effects active
```

#### Production (Disabled)
```
┌─────────────────────────┐
│  🎵 Post to TikTok      │
│  ┌───────────────────┐  │
│  │ 🟠 Coming Soon    │  │  ← Overlay on button
│  └───────────────────┘  │
└─────────────────────────┘
   ↑ Cannot click
```

**Visual Changes**:
- Opacity reduced to 60%
- Gradient animation disabled
- Semi-transparent black overlay appears
- Gold "Coming Soon" badge centered on overlay
- No hover effects or shine animation
- Cursor changes to `not-allowed`

---

## Testing Guide

### Test 1: Local Development (Features Should Work)

**Current Setup**:
```bash
# Your current .env file
NEXT_PUBLIC_SITE_URL=https://long-needles-drum.loca.lt
```

**Steps**:
```bash
# 1. Start dev server
pnpm dev

# 2. Open browser
http://localhost:3000

# 3. Navigate to Credits page
/dashboard/credits

# 4. Verify TikTok button
✅ "Connect TikTok" button is enabled
✅ No "Coming Soon" badge visible
✅ Button can be clicked

# 5. Navigate to History page
/dashboard/history

# 6. Verify Post button (on any completed video)
✅ "Post to TikTok" button has animations
✅ Hover effects work
✅ No "Coming Soon" overlay
✅ Button can be clicked
```

**Expected Result**: ✅ All features work normally

---

### Test 2: Production Simulation (Features Should Be Disabled)

**Temporary Setup**:
```bash
# 1. Edit .env file TEMPORARILY
NEXT_PUBLIC_SITE_URL=https://www.flowtra.store

# 2. Restart dev server (IMPORTANT - env changes require restart)
# Ctrl+C to stop, then:
pnpm dev

# 3. Open browser
http://localhost:3000
```

**Steps**:
```bash
# 1. Navigate to Credits page
/dashboard/credits

# 2. Verify TikTok button
✅ "Connect TikTok" button is grayed out (disabled)
✅ "Coming Soon" orange badge visible to the right
✅ Button cannot be clicked
✅ Cursor shows "not-allowed" icon

# 3. Navigate to History page
/dashboard/history

# 4. Verify Post button (on any completed video)
✅ "Post to TikTok" button is dimmed (60% opacity)
✅ No gradient animation
✅ Black overlay with gold "Coming Soon" badge visible
✅ Button cannot be clicked
✅ No hover effects
✅ Cursor shows "not-allowed" icon
```

**Expected Result**: ✅ All TikTok features disabled with "Coming Soon" status

**IMPORTANT**: After testing, restore your `.env` file:
```bash
# Restore original value
NEXT_PUBLIC_SITE_URL=https://long-needles-drum.loca.lt

# Restart dev server
pnpm dev
```

---

## Deployment Behavior

### On Vercel Deployment

**Production Branch**:
```bash
# Vercel Environment Variable
NEXT_PUBLIC_SITE_URL=https://www.flowtra.store
```
→ TikTok features **DISABLED**, "Coming Soon" shown

**Preview Branches**:
```bash
# Vercel generates URLs like:
NEXT_PUBLIC_SITE_URL=https://flowtra-git-feature-abc.vercel.app
```
→ TikTok features **ENABLED** (no 'flowtra.store' in URL)

---

## How to Enable Features in Production

When TikTok integration is ready for production:

### Option 1: Remove Environment Check

**File**: `lib/utils/environment.ts`
```typescript
// Change this function:
export const isTikTokFeatureEnabled = (): boolean => {
  return true;  // Always enable
};
```

### Option 2: Use Environment Variable

**Better approach** - Add a feature flag:

```typescript
// lib/utils/environment.ts
export const isTikTokFeatureEnabled = (): boolean => {
  // Check for explicit feature flag first
  const featureFlag = process.env.NEXT_PUBLIC_TIKTOK_ENABLED;
  if (featureFlag !== undefined) {
    return featureFlag === 'true';
  }

  // Otherwise, disable in production
  return !isProduction();
};
```

Then in production `.env`:
```bash
# Enable TikTok features in production
NEXT_PUBLIC_TIKTOK_ENABLED=true
```

---

## Reverting Changes

If you need to completely remove the environment checks:

### Files to Modify

1. **CreditsPage.tsx**:
   - Remove `isTikTokFeatureEnabled()` checks from button disabled state
   - Remove Coming Soon badge conditional rendering

2. **HistoryPage.tsx**:
   - Remove `isTikTokFeatureEnabled()` checks
   - Remove Coming Soon overlay
   - Restore all hover effects and animations unconditionally

3. **environment.ts**:
   - Can keep for other purposes or delete

---

## Troubleshooting

### Issue: Changes not reflecting after .env update

**Solution**: Restart dev server
```bash
# Stop server (Ctrl+C)
pnpm dev  # Start again
```

**Reason**: Next.js caches environment variables at startup

---

### Issue: Features disabled in local development

**Check**:
```bash
# View your .env file
cat .env | grep NEXT_PUBLIC_SITE_URL

# Should NOT contain 'flowtra.store'
# Example good values:
# http://localhost:3000
# https://abc.loca.lt
# https://xyz.vercel.app
```

---

### Issue: Features enabled in production

**Check Vercel Environment Variables**:
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Find `NEXT_PUBLIC_SITE_URL`
5. Should be: `https://www.flowtra.store`

---

## Summary

✅ **Development**: Full TikTok functionality available
🟠 **Production**: TikTok features show "Coming Soon" status
🔧 **Easy to toggle**: Change environment variable or feature flag
📊 **User-friendly**: Clear visual feedback with badges and overlays
🎨 **Professional UI**: Disabled states match your design system

---

**All changes complete!** Test both environments to verify everything works as expected.
