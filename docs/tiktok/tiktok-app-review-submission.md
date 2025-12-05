# TikTok App Review Submission - Flowtra

**Application Name**: Flowtra
**Submission Type**: Initial Review
**Submission Date**: October 28, 2025
**App Type**: Web Application

---

## Executive Summary

Flowtra is an AI-powered video creation platform that helps users generate professional advertising videos from product images. Our TikTok integration enables users to seamlessly share their created videos directly to TikTok, streamlining the content distribution workflow for digital marketers, e-commerce businesses, and content creators.

---

## Products and Scopes Used

### 1. Login Kit (TikTok OAuth 2.0)

**Purpose**: User Authentication and Authorization

**How It Works in Our App**:
- Users access our platform at https://www.flowtra.store
- When users want to connect their TikTok account, they click the "Connect TikTok" button in their dashboard
- Users are redirected to TikTok's OAuth authorization page
- After successful authorization, users are redirected back to our callback URL
- We securely store the encrypted access token and refresh token in our database
- The connection status is displayed in the user's dashboard

**User Benefit**:
- One-time authorization process
- Secure connection without sharing passwords
- Easy disconnection option available at any time

**Data Flow**:
1. User initiates connection → TikTok OAuth screen
2. User grants permission → Authorization code received
3. Exchange code for tokens → Store encrypted tokens
4. Display connection status → Ready to publish

---

### 2. Content Posting API - Video Publishing

**Purpose**: Publish User-Generated Videos to TikTok

**How It Works in Our App**:

#### Step 1: Video Creation
- Users generate videos using our AI tools (Competitor UGC Replication, Character Ads)
- Videos are processed and stored in our cloud storage (Supabase)
- Videos meet TikTok's technical requirements:
  - Format: MP4 with H.264 codec
  - Maximum size: 2GB
  - Duration: Typically 5-60 seconds

#### Step 2: Publish Initiation
- Users navigate to their video history page
- Click the "Post to TikTok" button on any completed video
- A dialog appears allowing users to customize:
  - Video title (up to 150 characters)
  - Interaction settings (Duet, Comments, Stitch)

#### Step 3: Video Upload
- Our backend downloads the video from our storage
- Video is validated for format and size compliance
- Video is uploaded to TikTok using chunked upload (5MB-64MB chunks)
- Real-time progress updates shown to user

#### Step 4: Processing and Completion
- TikTok processes the uploaded video
- Our system polls TikTok's status API every 5 seconds
- User receives notification when publishing is complete
- Direct link to the published video provided

**User Benefit**:
- Seamless one-click publishing from our platform to TikTok
- No need to download videos and manually upload to TikTok
- Saves time and simplifies workflow for content creators
- Maintains video quality with direct API upload

**Technical Implementation**:
- Chunked upload for reliable large file transfers
- Automatic retry mechanism for network failures
- Status polling with timeout protection (5 minutes)
- Error handling with user-friendly messages

---

## Scope Details

### Scope 1: `user.info.basic`

**Purpose**: Display User Profile Information

**What We Access**:
- TikTok username (display_name)
- TikTok user avatar (avatar_url)
- TikTok Open ID (unique identifier)
- TikTok Union ID (cross-app identifier)

**How We Use This Data**:
1. **Dashboard Display**: Show connected TikTok account name and avatar
2. **User Identification**: Verify the correct account is connected
3. **Connection Management**: Track which TikTok account is linked to which user
4. **User Experience**: Provide visual confirmation of successful connection

**Where It's Displayed**:
- User Dashboard → TikTok Connection Status Card
- Video History Page → "Post to TikTok" button (shows connected account)
- Settings Page → Connected Accounts Section

**Data Storage**:
- Stored in encrypted database (Supabase PostgreSQL)
- Updated on each successful authorization
- Deleted when user disconnects TikTok account

**Privacy Protection**:
- Data is only visible to the account owner
- Not shared with third parties
- Not used for marketing or analytics
- Complies with TikTok's data usage policies

---

### Scope 2: `video.publish`

**Purpose**: Publish Videos to TikTok on Behalf of Users

**What We Do**:
1. **Upload Video Content**: Transfer user-created videos to TikTok's servers
2. **Set Video Metadata**: Apply user-specified title and settings
3. **Configure Privacy**: Set visibility level (currently SELF_ONLY for development)
4. **Manage Interactions**: Configure Duet, Comment, Stitch permissions
5. **Monitor Status**: Track publishing progress and report completion

**When We Use This Scope**:
- Only when user explicitly clicks "Post to TikTok" button
- Requires active user action - no automatic posting
- User confirms all video details before publishing
- User can cancel at any time before upload completes

**User Control**:
- **User-Initiated Only**: We never post without explicit user action
- **Preview Before Publish**: Users see video thumbnail and can review
- **Title Customization**: Users write their own titles (no auto-generation)
- **Settings Control**: Users choose interaction settings
- **Cancellation Option**: Users can cancel during upload

**What We Don't Do**:
- ❌ No automatic scheduled posting
- ❌ No posting while user is logged out
- ❌ No modification of user's existing TikTok content
- ❌ No access to user's TikTok analytics
- ❌ No access to user's followers or following lists
- ❌ No commenting or liking on behalf of users

**Error Handling**:
- If upload fails, user is immediately notified
- Clear error messages with actionable solutions
- Failed uploads don't consume user credits
- Users can retry failed uploads

---

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Journey                             │
└─────────────────────────────────────────────────────────────┘

1. User Creates Account on Flowtra
   │
   ├── User generates video using AI tools
   │   └── Video saved to user's history
   │
2. User Connects TikTok Account (First Time Only)
   │
   ├── Click "Connect TikTok" in Dashboard
   ├── Redirect to TikTok OAuth
   ├── User grants permissions: user.info.basic, video.publish
   ├── Redirect back to Flowtra
   └── Display TikTok username and avatar ✓
   │
3. User Publishes Video to TikTok (Repeatable)
   │
   ├── Navigate to Video History
   ├── Click "Post to TikTok" on desired video
   ├── Dialog opens showing:
   │   ├── Video thumbnail preview
   │   ├── Title input field
   │   └── Interaction settings
   ├── User fills in title and configures settings
   ├── Click "Publish to TikTok" button
   │
   ├── [Backend Process - Transparent to User]
   │   ├── Validate user's TikTok connection
   │   ├── Check token expiration
   │   ├── Download video from storage
   │   ├── Validate video format and size
   │   ├── Initialize TikTok upload
   │   ├── Upload video in chunks
   │   └── Poll status until complete
   │
   ├── User sees real-time status:
   │   ├── "Uploading video to TikTok..." (progress)
   │   ├── "TikTok is processing your video..." (polling)
   │   └── "Successfully published to TikTok!" (complete)
   │
   └── Link to view video on TikTok provided ✓
   │
4. User Can Disconnect TikTok (Optional)
   │
   └── Click "Disconnect" in Settings
       └── All stored TikTok data deleted
```

---

## Data Privacy and Security

### Token Security

**Encryption**:
- All access tokens encrypted using AES-256-CBC
- Encryption key stored separately in environment variables
- Tokens never transmitted in plain text
- Tokens never logged or exposed in debugging

**Storage**:
- Encrypted tokens stored in secure PostgreSQL database
- Database protected by Row Level Security (RLS)
- Only accessible by authenticated user who owns the connection
- Automatic deletion when user disconnects account

**Token Refresh**:
- Tokens refreshed automatically before expiration
- Users never experience expired token errors
- Refresh tokens also encrypted with same security

### User Data Protection

**Data Minimization**:
- We only request scopes we actively use
- No unnecessary personal information collected
- Only store: username, avatar URL, and IDs
- No access to user's TikTok videos, followers, or analytics

**Data Retention**:
- TikTok connection data kept only while account is connected
- Immediate deletion when user disconnects
- Video publish history stored for 30 days (for reference)
- No long-term retention of TikTok-related data

**User Rights**:
- ✅ Right to disconnect at any time
- ✅ Right to view connected account information
- ✅ Right to delete all data
- ✅ Right to export published video history

### Compliance

- **GDPR Compliant**: User consent, data portability, right to deletion
- **CCPA Compliant**: User data disclosure, opt-out options
- **TikTok Developer Terms**: Full compliance with TikTok policies
- **OAuth 2.0 Standard**: Industry-standard secure authorization

---

## Technical Architecture

### System Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   User's     │         │   Flowtra    │         │   TikTok     │
│   Browser    │◄───────►│   Backend    │◄───────►│   API        │
└──────────────┘         └──────────────┘         └──────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   Supabase   │
                         │   Database   │
                         └──────────────┘
```

### API Endpoints Used

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/v2/oauth/authorize/` | User authorization | Once per connection |
| `/v2/oauth/token/` | Token exchange & refresh | Once per connection + auto-refresh |
| `/v2/user/info/` | Fetch user profile | Once per connection |
| `/v2/post/publish/video/init/` | Initialize video upload | Once per video publish |
| `[upload_url]` | Upload video chunks | Multiple (per chunk) |
| `/v2/post/publish/status/fetch/` | Check publishing status | Every 5s until complete |

### Rate Limiting Considerations

- **Token Exchange**: Limited by OAuth flow (user-initiated)
- **User Info**: Called once per connection
- **Video Upload Init**: Limited by user publishing frequency
- **Status Polling**: Max 60 attempts (5 minutes) per video
- **Expected Usage**: 1-10 video publishes per user per day

### Error Handling

**User-Facing Errors**:
- Clear, actionable error messages
- Suggestions for resolution
- No technical jargon exposed

**Backend Error Logging**:
- Detailed logs for debugging
- No sensitive data in logs (tokens masked)
- Error reporting to development team

---

## Development vs Production

### Current Status: Development Mode

**Limitations**:
- Can only publish to private TikTok accounts (account privacy setting)
- Videos set to SELF_ONLY visibility (only publisher can see)

**Why Development Mode**:
- Testing and validation of integration
- Ensuring user experience is smooth
- Validating security measures
- Preparing for production launch

### After Approval: Production Mode

**Capabilities Unlocked**:
- ✅ Publish to public TikTok accounts
- ✅ Support all privacy levels (PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY)
- ✅ Full user control over video visibility
- ✅ No restrictions on account privacy

**No Changes to Functionality**:
- Same user flow and interface
- Same security measures
- Same data protection policies
- Only permissions expanded

---

## Use Cases

### Primary Use Case: Digital Marketers

**Scenario**: E-commerce business owner creating product ads
1. Upload product images to Flowtra
2. Generate multiple video variations using AI
3. Review and select best performing versions
4. Publish directly to TikTok for A/B testing
5. Track which ads perform best

**Benefits**:
- Rapid content creation and distribution
- Streamlined workflow (no manual downloads)
- Test multiple versions quickly

### Secondary Use Case: Content Creators

**Scenario**: Influencer creating sponsored content
1. Use Flowtra to enhance product videos
2. Add AI-generated effects and transitions
3. Customize titles and settings
4. Publish to TikTok with one click
5. Maintain consistent posting schedule

**Benefits**:
- Professional quality videos
- Time savings (no manual uploads)
- Focus on content, not technical process

### Tertiary Use Case: Small Businesses

**Scenario**: Local business owner promoting services
1. Create promotional videos from photos
2. Generate multiple campaign variations
3. Schedule content creation workflow
4. Publish to TikTok to reach customers
5. Build social media presence

**Benefits**:
- Affordable video creation
- Easy social media management
- No video editing expertise required

---

## Monitoring and Compliance

### Usage Monitoring

**What We Track**:
- Number of TikTok connections per day
- Number of video publishes per day
- Success/failure rates
- Average publishing duration
- Common error types

**What We Don't Track**:
- User's TikTok video performance
- User's followers or engagement metrics
- Content of published videos
- User's browsing behavior on TikTok

### Compliance Measures

**Regular Audits**:
- Monthly review of TikTok API usage
- Quarterly security audits
- Annual privacy policy updates
- Continuous monitoring of TikTok developer terms

**Incident Response**:
- 24-hour response time for security issues
- User notification within 72 hours of data breach
- Immediate suspension if policy violation detected
- Cooperation with TikTok's security team

---

## Support and Contact

**Technical Support**:
- Email: support@flowtra.store
- Response time: Within 24 hours
- Help documentation: https://docs.flowtra.store

**Privacy Inquiries**:
- Email: privacy@flowtra.store
- Data deletion requests processed within 30 days
- GDPR/CCPA compliance contact

**Developer Contact**:
- Email: dev@flowtra.store
- GitHub Issues: https://github.com/flowtra/issues
- TikTok integration documentation available

---

## Conclusion

Flowtra's TikTok integration provides significant value to users by simplifying the video distribution workflow. We request only the minimal permissions necessary to deliver this functionality:

- **`user.info.basic`**: To display connected account information and provide visual confirmation
- **`video.publish`**: To enable one-click video publishing with full user control

We are committed to:
- ✅ User privacy and data security
- ✅ Transparent data usage
- ✅ Compliance with all TikTok policies
- ✅ Responsive support and communication
- ✅ Continuous improvement based on user feedback

We believe our integration enhances the TikTok ecosystem by making it easier for businesses and creators to share high-quality content on the platform.

---

## Appendix: Screenshots and Demos

### A. User Interface Screenshots

1. **TikTok Connection Page**
   - Location: `/dashboard/settings` → Connected Accounts
   - Shows: "Connect TikTok" button, connection status
   - Screenshot: [To be uploaded during submission]

2. **Video History with TikTok Button**
   - Location: `/dashboard/history`
   - Shows: Video thumbnails with "Post to TikTok" buttons
   - Screenshot: [To be uploaded during submission]

3. **TikTok Publish Dialog**
   - Shows: Video preview, title input, settings, privacy notice
   - Screenshot: [To be uploaded during submission]

4. **Publishing Progress**
   - Shows: Real-time status updates during upload
   - Screenshot: [To be uploaded during submission]

5. **Success Confirmation**
   - Shows: Success message with link to TikTok video
   - Screenshot: [To be uploaded during submission]

### B. Video Demo

**Demo Video URL**: [To be recorded and uploaded]

**Demo Content** (3-5 minutes):
1. User login to Flowtra
2. Click "Connect TikTok"
3. OAuth authorization flow
4. Successful connection display
5. Create a sample video
6. Navigate to video history
7. Click "Post to TikTok"
8. Fill in title and settings
9. Click publish
10. Show upload progress
11. Show success and link to TikTok

### C. Privacy Policy

**URL**: https://www.flowtra.store/privacy

**Relevant Sections**:
- TikTok Integration and Data Usage
- Third-Party Service Connections
- User Rights and Data Deletion
- OAuth Token Management

### D. Terms of Service

**URL**: https://www.flowtra.store/terms

**Relevant Sections**:
- Third-Party Service Integration
- User Responsibilities
- Content Publishing Guidelines
- Account Termination Policy

---

**End of Submission Document**

*For questions or clarifications regarding this submission, please contact: dev@flowtra.store*

*Last Updated: October 28, 2025*
