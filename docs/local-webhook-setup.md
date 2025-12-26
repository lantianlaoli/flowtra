# Local Development Webhook Setup

**Last Updated**: 2025-12-26

## Overview

Avatar Ads workflow uses webhooks from external services (KIE API and fal.ai) to receive real-time status updates. For local development, you need to expose your localhost server to the internet using ngrok.

## Why Webhooks Need Public URLs

External services (KIE API, fal.ai) need to send HTTP POST requests to your webhook endpoints when their operations complete. Since `localhost:3000` is not accessible from the internet, we use ngrok to create a public URL tunnel.

## Setup Steps

### 1. Install ngrok

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
# Download from https://ngrok.com/download
# Or use snap
snap install ngrok
```

**Windows:**
```bash
# Download from https://ngrok.com/download
# Or use chocolatey
choco install ngrok
```

### 2. Start Your Development Server

```bash
pnpm dev
# Server runs at http://localhost:3000
```

### 3. Start ngrok Tunnel

In a **separate terminal**:

```bash
ngrok http 3000
```

You'll see output like:

```
ngrok

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.0.0
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://01aa5cc06cec.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Copy the HTTPS forwarding URL** (e.g., `https://01aa5cc06cec.ngrok-free.app`)

### 4. Set Environment Variable

**Option A: Add to `.env.local` (Recommended)**

```bash
# Create or edit .env.local
echo "NEXT_PUBLIC_SITE_URL=https://01aa5cc06cec.ngrok-free.app" >> .env.local
```

**Option B: Export in Terminal**

```bash
export NEXT_PUBLIC_SITE_URL=https://01aa5cc06cec.ngrok-free.app
```

### 5. Restart Dev Server

**Important:** Environment variables are loaded at startup, so you must restart:

```bash
# Stop the dev server (Ctrl+C)
# Start again
pnpm dev
```

### 6. Verify Configuration

Check server logs when creating a project. You should see:

```
📡 Submitting merge task with webhook URL: https://01aa5cc06cec.ngrok-free.app/api/avatar-ads/webhooks/merge
🔔 Webhook will be called at: https://01aa5cc06cec.ngrok-free.app/api/avatar-ads/webhooks/merge when merge completes
```

## Webhook Endpoints

All Avatar Ads webhook endpoints:

| Service | Endpoint | Purpose |
|---------|----------|---------|
| KIE API | `POST /api/avatar-ads/webhooks/image` | Image generation callback |
| KIE API | `POST /api/avatar-ads/webhooks/video` | Video generation callback |
| fal.ai | `POST /api/avatar-ads/webhooks/merge` | Video merge callback |

## Testing Webhooks

### 1. Monitor ngrok Requests

Open the ngrok Web Interface in your browser:

```
http://127.0.0.1:4040
```

This shows all HTTP requests received by ngrok, including webhook callbacks.

### 2. Check Server Logs

Watch your dev server console for webhook logs:

```
[Avatar Ads Image Webhook] Received: { request_id: '...', status: 'COMPLETED' }
[Avatar Ads Video Webhook] Received: { taskId: '...', code: 200 }
[Avatar Ads Merge Webhook] Received: { request_id: '...', status: 'COMPLETED' }
```

### 3. Check Realtime Updates

Open browser console and filter for:

```javascript
console.log('[Avatar Ads Realtime]');
```

You should see instant updates (< 1 second) when webhooks are received.

## Troubleshooting

### Webhook Not Received

**Check 1: Is ngrok running?**
```bash
# Should show running ngrok session
curl http://127.0.0.1:4040/api/tunnels
```

**Check 2: Is NEXT_PUBLIC_SITE_URL set correctly?**
```bash
# In dev server console, check the webhook URL log
# Should show ngrok URL, not localhost
```

**Check 3: Did you restart the dev server?**
```bash
# Environment variables only load at startup
# Restart after changing .env.local
```

**Check 4: Is ngrok URL expired?**
```bash
# Free ngrok URLs expire after 2 hours
# Restart ngrok and update NEXT_PUBLIC_SITE_URL
```

### ngrok "Tunnel Not Found" Error

Free ngrok tunnels expire after the ngrok process is killed. To fix:

1. Restart ngrok: `ngrok http 3000`
2. Copy the new URL
3. Update `NEXT_PUBLIC_SITE_URL` in `.env.local`
4. Restart dev server

### Webhook Receives 404

Check that your Next.js routes match the webhook endpoints:

```bash
# Should exist:
ls -la app/api/avatar-ads/webhooks/image/route.ts
ls -la app/api/avatar-ads/webhooks/video/route.ts
ls -la app/api/avatar-ads/webhooks/merge/route.ts
```

## Development Without Webhooks

If you don't want to use ngrok, you can develop without webhooks:

1. Leave `NEXT_PUBLIC_SITE_URL` empty in `.env.local`
2. System will log warning: `⚠️ NEXT_PUBLIC_SITE_URL not set, webhooks will not be configured`
3. Avatar Ads will **not work** without webhooks (no polling fallback)

**Note:** Competitor UGC Replication still has polling fallback via `/api/competitor-ugc-replication/monitor-tasks`.

## ngrok Best Practices

### Free Plan Limitations

- Maximum 1 tunnel per agent
- Tunnel expires after 2 hours
- New random URL on each restart
- Rate limited to 40 requests/minute

### Upgrade to ngrok Pro (Optional)

Benefits:
- Custom domain (e.g., `https://myname.ngrok.app`)
- No expiration
- Multiple tunnels
- Higher rate limits

```bash
# Set up custom domain (Pro plan)
ngrok http 3000 --domain=myname.ngrok.app

# Then set permanently in .env.local
NEXT_PUBLIC_SITE_URL=https://myname.ngrok.app
```

## Production Deployment

In production, set `NEXT_PUBLIC_SITE_URL` to your actual domain:

```env
# Vercel, Netlify, etc.
NEXT_PUBLIC_SITE_URL=https://flowtra.ai
```

**Important:** No trailing slash!

```bash
# ✅ Correct
NEXT_PUBLIC_SITE_URL=https://flowtra.ai

# ❌ Wrong (will create double slashes in webhook URLs)
NEXT_PUBLIC_SITE_URL=https://flowtra.ai/
```

## Architecture Reference

For detailed webhook architecture documentation, see:

- [Avatar Ads Complete Event-Driven Architecture](./avatar-ads-complete-event-driven-architecture.md)
- [CLAUDE.md Implementation Notes](../CLAUDE.md#current-avatar-ads-complete-event-driven-architecture-100-webhook--realtime)
