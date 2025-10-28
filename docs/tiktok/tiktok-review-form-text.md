# TikTok App Review - Short Form Version

**Use this concise version if the submission form has character limits**

---

## Product & Scope Explanation

### Overview
Flowtra is an AI-powered video creation platform that helps users generate professional advertising videos from product images. Our TikTok integration enables seamless video publishing directly to TikTok.

---

### Login Kit (OAuth 2.0)

**Purpose**: Secure user authentication and authorization

**Implementation**:
Users click "Connect TikTok" in our dashboard → Redirected to TikTok OAuth → Grant permissions → Redirected back to our app → Connection displayed with username and avatar.

**User Benefit**: One-time secure connection without sharing passwords. Users can disconnect anytime.

---

### Scope: user.info.basic

**What We Access**: Username, avatar, Open ID, Union ID

**How We Use It**:
1. Display connected TikTok account in user dashboard for verification
2. Show avatar and username for visual confirmation
3. Track which TikTok account is linked to user's Flowtra account
4. Provide better user experience with personalized connection status

**Where It Appears**: Dashboard connection status, video history page, settings page

**Privacy**: Data stored encrypted, only visible to account owner, not shared with third parties, deleted on disconnection.

---

### Scope: video.publish

**Purpose**: Publish user-created videos to TikTok

**How It Works**:
1. User creates video using our AI tools
2. User clicks "Post to TikTok" button on completed video
3. User enters title and interaction settings (Duet, Comments, Stitch)
4. User clicks "Publish" to confirm
5. Our system uploads video to TikTok using Content Posting API
6. User sees real-time progress and success notification
7. Link to published video provided

**User Control**:
- Publishing only happens when user explicitly clicks "Publish" button
- User writes own title and configures all settings
- User can cancel during upload
- No automatic or scheduled posting
- Preview shown before publishing

**What We DON'T Do**:
- No automatic posting without user action
- No access to user's existing TikTok content
- No access to analytics, followers, or following lists
- No commenting or liking on user's behalf
- No modification of user's other TikTok videos

**Technical Flow**:
- Download video from our storage → Validate format/size → Initialize TikTok upload → Upload in chunks (5-64MB) → Poll status every 5s → Notify user on completion

---

### Data Security

**Token Protection**:
- All tokens encrypted using AES-256-CBC
- Stored in secure PostgreSQL database with Row Level Security
- Tokens never logged or exposed
- Automatic refresh before expiration

**Data Minimization**:
- Only request permissions we actively use
- Store minimal data: username, avatar, IDs
- Delete all data when user disconnects
- No long-term retention of TikTok data

**Compliance**: GDPR, CCPA, TikTok Developer Terms, OAuth 2.0 standards

---

### Use Cases

**Digital Marketers**: Create product ads → Generate multiple variations → Publish to TikTok for A/B testing

**Content Creators**: Enhance videos with AI → Customize titles → One-click publishing → Maintain posting schedule

**Small Businesses**: Create promotional videos → Build social media presence → No video editing expertise needed

---

### Development vs Production

**Current (Development Mode)**:
- Testing on private accounts only (TikTok requirement)
- Videos set to SELF_ONLY visibility
- Validating integration and security

**After Approval (Production Mode)**:
- Support public accounts
- All privacy levels available (PUBLIC, FRIENDS, SELF_ONLY)
- Full user control over visibility
- No functionality changes, only permissions expanded

---

### Monitoring

**What We Track**: Connection count, publish success rate, error types, usage statistics

**What We Don't Track**: User's TikTok video performance, followers, engagement, browsing behavior

---

### Support

**Email**: support@flowtra.store
**Privacy**: privacy@flowtra.store
**Response Time**: Within 24 hours
**Website**: https://www.flowtra.store

---

### Commitment

We are committed to:
- User privacy and data security
- Transparent data usage
- Full compliance with TikTok policies
- Responsive support
- Continuous improvement

Our integration enhances the TikTok ecosystem by making it easier for businesses and creators to share high-quality content on the platform.

---

## Revision History

**Version 1.0** (Initial Submission - October 28, 2025)
- Initial submission for review
- No prior versions

---

*End of Form Text*
