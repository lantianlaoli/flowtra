# TikTok Login Kit Web - Integration Guide

This document provides a comprehensive understanding of TikTok Login Kit for Web and how it's integrated into the Flowtra application.

## Table of Contents

1. [Overview](#overview)
2. [OAuth 2.0 Authorization Flow](#oauth-20-authorization-flow)
3. [Configuration Requirements](#configuration-requirements)
4. [API Endpoints](#api-endpoints)
5. [Scope Permissions](#scope-permissions)
6. [Token Management](#token-management)
7. [User Information Retrieval](#user-information-retrieval)
8. [Security Best Practices](#security-best-practices)
9. [Content Posting API Integration](#content-posting-api-integration)
10. [Implementation in Flowtra](#implementation-in-flowtra)

---

## Overview

TikTok Login Kit for Web is an OAuth 2.0-based authentication system that allows third-party applications to:
- Authenticate users via their TikTok accounts
- Access user profile information (with permission)
- Publish videos to TikTok on behalf of users
- Retrieve user's video content

The integration follows the standard OAuth 2.0 authorization code grant flow, ensuring secure and user-controlled access to TikTok resources.

---

## OAuth 2.0 Authorization Flow

### Flow Diagram

```
1. User clicks "Connect TikTok" → Application redirects to TikTok authorization page
2. User logs in to TikTok (if not already) and grants permissions
3. TikTok redirects back to application with authorization code
4. Application exchanges authorization code for access token (backend)
5. Application uses access token to fetch user info and access TikTok APIs
```

### Detailed Steps

#### Step 1: Authorization Request

The application redirects users to TikTok's authorization endpoint:

```
https://www.tiktok.com/v2/auth/authorize/
```

**Required Parameters:**
- `client_key`: Your application's unique identifier
- `scope`: Comma-separated list of permissions (e.g., `user.info.basic,video.publish`)
- `response_type`: Must be `code`
- `redirect_uri`: Registered callback URL (must match exactly)
- `state`: Random CSRF token for security

**Example URL:**
```
https://www.tiktok.com/v2/auth/authorize/
  ?client_key=sbawxwrsuki77d4e51
  &scope=user.info.basic,video.publish
  &response_type=code
  &redirect_uri=https://www.flowtra.store/api/tiktok/auth/callback
  &state=a1b2c3d4e5f6...
```

#### Step 2: User Authorization

TikTok displays an authorization page where users:
- Log in (if not authenticated)
- Review requested permissions
- Approve or deny access

#### Step 3: Authorization Callback

Upon approval, TikTok redirects to your `redirect_uri` with:

**Success Response:**
- `code`: Authorization code (valid for ~10 minutes)
- `scopes`: Comma-separated granted scopes
- `state`: Echoed state parameter for CSRF validation

**Error Response:**
- `error`: Error code (e.g., `access_denied`)
- `error_description`: Human-readable error message

#### Step 4: Token Exchange

Your backend exchanges the authorization code for tokens:

**Endpoint:** `POST https://open.tiktokapis.com/v2/oauth/token/`

**Request Body (application/x-www-form-urlencoded):**
```
client_key=<YOUR_CLIENT_KEY>
client_secret=<YOUR_CLIENT_SECRET>
code=<AUTHORIZATION_CODE>
grant_type=authorization_code
redirect_uri=<SAME_REDIRECT_URI>
```

**Response:**
```json
{
  "access_token": "act.example12345...",
  "refresh_token": "rft.example12345...",
  "expires_in": 86400,
  "open_id": "user-open-id-123",
  "scope": "user.info.basic,video.publish",
  "token_type": "Bearer"
}
```

---

## Configuration Requirements

### Developer Portal Setup

1. **Register Application:**
   - Visit https://developers.tiktok.com
   - Create a new app or select existing app
   - Navigate to "Manage apps"

2. **Obtain Credentials:**
   - `Client Key`: Public identifier (safe to expose client-side)
   - `Client Secret`: Secret key (MUST remain on backend only)

3. **Configure Redirect URIs:**
   - Add authorized callback URLs
   - Maximum 10 URIs allowed
   - Each URI must be < 512 characters
   - Must use HTTPS in production
   - Cannot include fragments (#)
   - Must be static (no dynamic parameters)

**Example Valid URIs:**
```
https://www.flowtra.store/api/tiktok/auth/callback
https://dev.flowtra.store/api/tiktok/auth/callback
```

### Environment Variables

Store credentials securely in environment variables:

```env
# TikTok OAuth Credentials
TIKTOK_CLIENT_KEY=sbawxwrsuki77d4e51
TIKTOK_CLIENT_SECRET=SpX2tiQb16cfi8SJ2D0kND8uFKQjKJbG
TIKTOK_REDIRECT_URI=https://www.flowtra.store/api/tiktok/auth/callback

# Optional: Custom encryption key for token storage
TIKTOK_TOKEN_ENCRYPTION_KEY=<32-byte-key>
```

---

## API Endpoints

### 1. Authorization Endpoint

**URL:** `https://www.tiktok.com/v2/auth/authorize/`
**Method:** GET (redirect)
**Purpose:** Initiate OAuth flow

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_key` | Yes | Application client key |
| `scope` | Yes | Comma-separated scopes |
| `response_type` | Yes | Must be `code` |
| `redirect_uri` | Yes | Registered callback URL |
| `state` | Yes | CSRF protection token |
| `disable_auto_auth` | No | 0 or 1 (controls auto-approval) |

### 2. Token Exchange Endpoint

**URL:** `https://open.tiktokapis.com/v2/oauth/token/`
**Method:** POST
**Content-Type:** application/x-www-form-urlencoded

**Body Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_key` | Yes | Application client key |
| `client_secret` | Yes | Application client secret |
| `code` | Yes | Authorization code from callback |
| `grant_type` | Yes | Must be `authorization_code` |
| `redirect_uri` | Yes | Same URI used in authorization |

### 3. User Info Endpoint

**URL:** `https://open.tiktokapis.com/v2/user/info/`
**Method:** GET
**Authorization:** Bearer token

**Query Parameters:**
- `fields`: Comma-separated list of fields to retrieve
  - `open_id`: User's unique identifier
  - `union_id`: Cross-app user identifier
  - `avatar_url`: Profile picture URL
  - `display_name`: User's display name
  - `bio_description`: User bio
  - `profile_deep_link`: Deep link to profile

**Example:**
```
GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name
Authorization: Bearer act.example12345...
```

**Response:**
```json
{
  "data": {
    "user": {
      "open_id": "user-123",
      "union_id": "union-456",
      "avatar_url": "https://...",
      "display_name": "John Doe"
    }
  }
}
```

---

## Scope Permissions

Scopes define what data your application can access. They must be approved both at the app level (in developer portal) and by the user during authorization.

### Available Scopes

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `user.info.basic` | Access basic profile info (open_id, avatar, display name) | User identification |
| `video.publish` | Upload and publish videos to user's account | Content posting |
| `video.list` | Retrieve user's video list | Content management |

### Scope Usage in Flowtra

For publishing AI-generated videos to TikTok, we request:
```
user.info.basic,video.publish
```

This allows us to:
1. Display the connected TikTok account (user.info.basic)
2. Publish videos directly to the user's TikTok profile (video.publish)

---

## Token Management

### Access Token

- **Purpose:** Authenticate API requests on behalf of user
- **Lifetime:** Typically 24 hours (86400 seconds)
- **Usage:** Include in `Authorization: Bearer <token>` header
- **Storage:** Encrypt before storing in database

### Refresh Token

- **Purpose:** Obtain new access tokens without re-authorization
- **Lifetime:** Long-lived (months)
- **Usage:** Exchange for new access token via refresh endpoint
- **Storage:** Encrypt and store securely

### Token Expiration Handling

```javascript
// Pseudo-code for token refresh
if (tokenExpiresAt < Date.now()) {
  const newTokens = await refreshAccessToken(refreshToken);
  await updateStoredTokens(newTokens);
}
```

### Token Security

**Best Practices:**
1. **Encryption:** Encrypt tokens before storing in database
   ```javascript
   // Example using AES-256-CBC
   const encryptedToken = encryptToken(access_token);
   ```

2. **Secure Storage:** Store in backend database, never in client-side storage

3. **HTTPS Only:** Always transmit tokens over HTTPS

4. **Token Rotation:** Implement automatic token refresh before expiry

---

## User Information Retrieval

### Display API - User Info

After obtaining an access token, retrieve user information:

**Endpoint:** `GET /v2/user/info/`

**Available Fields:**
- `open_id`: TikTok's unique user identifier (stable across sessions)
- `union_id`: Cross-app identifier (optional, requires special approval)
- `avatar_url`: Standard resolution avatar
- `avatar_url_100`: 100x100px avatar
- `avatar_large_url`: High-resolution avatar
- `display_name`: User's public display name
- `bio_description`: User's profile bio
- `profile_deep_link`: Deep link to user's TikTok profile

**Note:** Due to scope migration, `user.info.basic` can only retrieve basic fields (open_id, union_id, avatar variants, display_name).

---

## Security Best Practices

### 1. CSRF Protection via State Token

**Purpose:** Prevent cross-site request forgery attacks

**Implementation:**
```javascript
// 1. Generate random state token before authorization
const csrfState = crypto.randomBytes(32).toString('hex');

// 2. Store in secure, httpOnly cookie
response.cookies.set('tiktok_oauth_state', csrfState, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 600 // 10 minutes
});

// 3. Validate in callback
if (callbackState !== storedState) {
  throw new Error('CSRF state mismatch');
}
```

### 2. Client Secret Protection

**Critical:** NEVER expose `client_secret` in:
- Client-side JavaScript
- Version control (use .env)
- Public repositories
- Browser DevTools

**Only use client_secret:**
- On backend/server-side code
- For token exchange requests

### 3. HTTPS Requirement

- Authorization page only accessible via HTTPS
- Redirect URIs must use HTTPS in production
- Token exchange must occur over HTTPS

### 4. Redirect URI Validation

- TikTok validates exact match of redirect_uri
- URI must be pre-registered in developer portal
- Cannot use wildcards or dynamic paths

### 5. Token Storage

**Recommended Approach:**
```javascript
// Encrypt tokens before database storage
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;

function encryptToken(token) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
```

---

## Content Posting API Integration

### Publishing Videos to TikTok

Once users connect their TikTok account, you can publish videos using the Content Posting API.

#### Required Scope
- `video.publish`

#### Publishing Flow

1. **Check Creator Info**
   ```
   POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
   Authorization: Bearer <access_token>
   ```
   Returns privacy options and posting restrictions.

2. **Initialize Video Upload**
   ```
   POST https://open.tiktokapis.com/v2/post/publish/video/init/
   Content-Type: application/json
   Authorization: Bearer <access_token>

   {
     "post_info": {
       "title": "Generated by Flowtra",
       "privacy_level": "PUBLIC_TO_EVERYONE",
       "disable_comment": false,
       "disable_duet": false,
       "disable_stitch": false,
       "video_cover_timestamp_ms": 1000
     },
     "source_info": {
       "source": "FILE_UPLOAD",
       "video_size": 12345678,
       "chunk_size": 10485760,
       "total_chunk_count": 2
     }
   }
   ```

3. **Upload Video Chunks**
   Upload video in chunks using provided upload URL.

4. **Check Post Status**
   ```
   POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
   Authorization: Bearer <access_token>

   {
     "publish_id": "<PUBLISH_ID>"
   }
   ```

#### Video Requirements
- **Format:** MP4 + H.264 codec
- **Max Size:** Varies by account type
- **Upload Method:** Chunked upload or URL pull

#### Important Notes
- **Audit Required:** Unaudited apps have content visibility restrictions
- **Rate Limits:** TikTok enforces posting rate limits
- **Content Policy:** Videos must comply with TikTok's community guidelines

---

## Implementation in Flowtra

### Architecture Overview

```
User (Browser)
    ↓
1. Click "Connect TikTok" → /api/tiktok/auth/authorize
    ↓
2. Redirect to TikTok Authorization Page
    ↓
3. User Approves → TikTok redirects to /api/tiktok/auth/callback
    ↓
4. Exchange code for tokens (Backend)
    ↓
5. Fetch user info from TikTok
    ↓
6. Store encrypted tokens in Supabase (user_tiktok_connections table)
    ↓
7. Redirect to /dashboard/account?tiktok_success=true
    ↓
8. Display connected account with avatar and username
```

### Database Schema

**Table:** `user_tiktok_connections`

```sql
CREATE TABLE user_tiktok_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,                    -- Clerk user ID
  tiktok_open_id VARCHAR NOT NULL UNIQUE,      -- TikTok user ID
  tiktok_union_id VARCHAR,                     -- Cross-app ID (optional)
  display_name VARCHAR NOT NULL,               -- TikTok display name
  avatar_url TEXT,                             -- Profile picture URL
  access_token TEXT NOT NULL,                  -- Encrypted access token
  refresh_token TEXT NOT NULL,                 -- Encrypted refresh token
  token_expires_at TIMESTAMPTZ NOT NULL,       -- Token expiry timestamp
  scope TEXT NOT NULL,                         -- Granted scopes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### API Routes

1. **`/api/tiktok/auth/authorize`** (GET)
   - Generates CSRF state token
   - Stores state and user ID in cookies
   - Redirects to TikTok authorization page

2. **`/api/tiktok/auth/callback`** (GET)
   - Validates CSRF state token
   - Exchanges authorization code for tokens
   - Fetches user info from TikTok
   - Encrypts and stores tokens in database
   - Redirects to account page with success message

3. **`/api/tiktok/user/info`** (GET)
   - Returns current user's TikTok connection status
   - Provides display name, avatar, and connection metadata

4. **`/api/tiktok/unbind`** (POST)
   - Removes user's TikTok connection from database
   - Returns success confirmation

### UI Components

**Connected Accounts Section** in `/dashboard/account`:

- **Unconnected State:**
  - TikTok logo and description
  - "Connect TikTok" button

- **Connected State:**
  - TikTok logo with "Connected" badge
  - User avatar and display name
  - "Disconnect" button

### Error Handling

URL parameters for error feedback:
- `?tiktok_success=true` - Connection successful
- `?tiktok_error=<error_code>` - Connection failed

**Error Codes:**
- `missing_parameters` - Missing code or state
- `invalid_state` - CSRF validation failed
- `session_expired` - User session lost
- `token_exchange_failed` - Token API error
- `user_info_failed` - User info API error
- `database_error` - Database operation failed
- `unexpected_error` - Uncaught exception

---

## Future Enhancements

### Planned Features

1. **Automatic Token Refresh:**
   - Background job to refresh tokens before expiry
   - Seamless re-authorization if refresh fails

2. **Direct Video Publishing:**
   - "Publish to TikTok" button on generated videos
   - Automatic upload to connected TikTok account

3. **Analytics Integration:**
   - Track video performance on TikTok
   - Display views, likes, comments in Flowtra dashboard

4. **Multi-Account Support:**
   - Connect multiple TikTok accounts
   - Choose which account to publish to

### Security Improvements

1. **Token Rotation:**
   - Implement automatic token refresh before expiry
   - Periodic re-validation of stored tokens

2. **Webhook Integration:**
   - Subscribe to TikTok webhook events
   - Handle token revocation notifications

3. **Rate Limit Handling:**
   - Track API rate limits
   - Queue video publishing when limits approached

---

## References

### Official TikTok Documentation

- **Login Kit Web:** https://developers.tiktok.com/doc/login-kit-web
- **Display API:** https://developers.tiktok.com/doc/display-api-get-started
- **Content Posting API:** https://developers.tiktok.com/doc/content-posting-api-get-started
- **OAuth 2.0 Token Endpoint:** https://developers.tiktok.com/doc/oauth-user-access-token-management

### Developer Resources

- **TikTok Developer Portal:** https://developers.tiktok.com
- **API Status Page:** https://developers.tiktok.com/status
- **Community Forum:** https://developers.tiktok.com/community

---

## Troubleshooting

### Common Issues

**1. "Invalid redirect_uri" Error**
- **Cause:** Redirect URI doesn't match registered URI exactly
- **Solution:** Verify URI in developer portal matches exactly (including protocol, domain, path)

**2. "Invalid client_key or client_secret"**
- **Cause:** Credentials are incorrect or expired
- **Solution:** Regenerate credentials in developer portal

**3. "State mismatch" Error**
- **Cause:** CSRF state token doesn't match or cookie expired
- **Solution:** Ensure cookies are enabled; check state cookie maxAge

**4. "Scope not approved" Error**
- **Cause:** Requested scope not enabled in developer portal
- **Solution:** Enable required scopes in app settings; may require app review

**5. Token Expired Errors**
- **Cause:** Access token expired (24h lifetime)
- **Solution:** Implement token refresh using refresh_token

---

## Changelog

### Version 1.0 (2025-10-28)
- Initial implementation of TikTok Login Kit integration
- OAuth 2.0 authorization flow
- Secure token storage with encryption
- User connection management UI
- Documentation created

---

**Last Updated:** October 28, 2025
**Author:** Flowtra Development Team
**Contact:** lantianlaoli@gmail.com
