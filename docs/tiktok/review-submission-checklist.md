# TikTok App Review Submission Checklist

**Before submitting your TikTok app for review, complete this checklist**

---

## 📋 Pre-Submission Checklist

### 1. Documentation Prepared ✓

- [x] Full detailed explanation document created
  - File: `docs/tiktok/tiktok-app-review-submission.md`
  - Use this for comprehensive reference

- [x] Short form text prepared
  - File: `docs/tiktok/tiktok-review-form-text.md`
  - Use this if form has character limits

### 2. Required Materials to Prepare

#### A. Screenshots (Required) 📸

**Take screenshots of the following**:

- [ ] **TikTok Connection Page**
  - Path: `/dashboard/settings` → Connected Accounts
  - Shows: "Connect TikTok" button
  - Status: Before and After connection

- [ ] **OAuth Authorization Screen**
  - TikTok's permission request page
  - Shows: Requested scopes (user.info.basic, video.publish)

- [ ] **Connected Account Display**
  - Shows: TikTok username and avatar in dashboard
  - Proves `user.info.basic` is used for display

- [ ] **Video History Page**
  - Shows: Video thumbnails with "Post to TikTok" buttons
  - Path: `/dashboard/history`

- [ ] **TikTok Publish Dialog**
  - Shows: Video preview, title input, settings
  - Shows: Privacy notice about private publishing

- [ ] **Publishing Progress**
  - Shows: "Uploading video to TikTok..." status
  - Shows: "Processing..." status

- [ ] **Success Confirmation**
  - Shows: "Successfully published to TikTok!" message
  - Shows: Link to view video on TikTok

**Screenshot Tips**:
- Use full browser window captures
- Ensure UI text is readable
- Highlight important elements if needed
- Show real user data (with permission) or test data

---

#### B. Demo Video (Highly Recommended) 🎥

**Create a 3-5 minute video showing**:

1. **Login and Dashboard** (30s)
   - User logs into Flowtra
   - Navigate to TikTok connection settings

2. **TikTok Connection Flow** (60s)
   - Click "Connect TikTok"
   - OAuth authorization screen
   - Grant permissions
   - Successful connection display
   - Show username and avatar appear

3. **Video Creation** (60s)
   - Create a sample video using AI tools
   - Show completed video in history

4. **Publishing to TikTok** (90s)
   - Click "Post to TikTok" button
   - Fill in video title
   - Configure interaction settings
   - Click "Publish to TikTok"
   - Show upload progress
   - Show "Processing" status
   - Show success message

5. **Verify on TikTok** (30s)
   - Click link to view video
   - Show video published on TikTok
   - Confirm it appears in user's profile

**Video Tips**:
- Screen recording with voiceover explanation
- Use English narration
- Clear, professional quality
- Show real functionality (not mockups)
- Upload to YouTube (unlisted) or Vimeo

---

#### C. Website & Documentation URLs

**Ensure these pages exist and are complete**:

- [ ] **Privacy Policy**: https://www.flowtra.store/privacy
  - Must include: TikTok integration section
  - Must explain: Data collection, storage, deletion
  - Must state: User rights

- [ ] **Terms of Service**: https://www.flowtra.store/terms
  - Must include: Third-party service integration
  - Must explain: User responsibilities
  - Must state: Content guidelines

- [ ] **Help/Support Page**: https://www.flowtra.store/help (or similar)
  - Must include: How to connect TikTok
  - Must include: How to publish videos
  - Must include: How to disconnect

- [ ] **Contact Page**: Support email visible
  - Recommended: support@flowtra.store
  - Recommended: privacy@flowtra.store

---

### 3. Technical Verification

**Before submitting, verify**:

- [ ] **OAuth Flow Works**
  - Test full authorization flow
  - Verify callback URL is correct in TikTok Developer Portal
  - Confirm tokens are stored encrypted

- [ ] **Token Refresh Works**
  - Verify automatic token refresh before expiration
  - Test with expired token scenario

- [ ] **Video Publishing Works**
  - Test end-to-end video publishing
  - Verify status polling completes
  - Confirm success message displays

- [ ] **Error Handling Works**
  - Test with invalid video
  - Test with expired token
  - Verify user-friendly error messages

- [ ] **Disconnection Works**
  - Test TikTok disconnection
  - Verify all data is deleted from database
  - Confirm UI updates correctly

---

### 4. TikTok Developer Portal Setup

**Login to https://developers.tiktok.com/**

- [ ] **App Basic Information Complete**
  - App name: Flowtra
  - App description: Filled out
  - App icon: Uploaded (512x512 PNG)
  - Category: Selected (e.g., "Video & Entertainment" or "Business")

- [ ] **Redirect URIs Configured**
  - Production: `https://www.flowtra.store/api/tiktok/callback`
  - Development: `http://localhost:3000/api/tiktok/callback` (if needed)

- [ ] **Scopes Requested**
  - ✅ user.info.basic
  - ✅ video.publish

- [ ] **Webhook URLs** (Optional)
  - If using webhooks, configure URL
  - Otherwise, leave empty

- [ ] **Terms Accepted**
  - TikTok Developer Terms: Accepted
  - Content Posting API Terms: Accepted

---

### 5. Submission Form Fields

**Prepare answers for these common questions**:

#### Q: What does your app do?
**Answer**:
```
Flowtra is an AI-powered video creation platform that helps businesses
and content creators generate professional advertising videos from
product images. Users can create videos using our AI tools and publish
them directly to TikTok with one click.
```

#### Q: How do you use Login Kit?
**Answer**: (Use content from `tiktok-review-form-text.md` → Login Kit section)

#### Q: How do you use user.info.basic?
**Answer**: (Use content from `tiktok-review-form-text.md` → Scope: user.info.basic section)

#### Q: How do you use video.publish?
**Answer**: (Use content from `tiktok-review-form-text.md` → Scope: video.publish section)

#### Q: What user data do you collect?
**Answer**:
```
We only collect TikTok username, avatar URL, Open ID, and Union ID
from the user.info.basic scope. This data is used solely to display
the connected account in the user's dashboard. All data is encrypted
and stored securely. Users can disconnect and delete all data at any time.
```

#### Q: How do you protect user privacy?
**Answer**: (Use content from `tiktok-review-form-text.md` → Data Security section)

#### Q: Why do you need these scopes?
**Answer**:
```
- user.info.basic: To display the connected TikTok account (username
  and avatar) in the user's dashboard, providing visual confirmation
  of successful connection.

- video.publish: To enable users to publish their AI-generated videos
  directly to TikTok with one click, streamlining their content
  distribution workflow.
```

---

### 6. Account for Testing

**TikTok will need a test account to review your app**:

- [ ] **Create Test TikTok Account**
  - Username: flowtra_test (or similar)
  - Set account to **PRIVATE** (required for development apps)
  - Add some basic profile information

- [ ] **Provide Test Credentials**
  - Username: _______________
  - Password: _______________
  - (Send via secure method in submission form)

- [ ] **Create Test Video in Your App**
  - Use test account to create a video
  - Keep video in history (don't publish yet)
  - TikTok reviewers can test publishing

---

### 7. Final Checks Before Submission

- [ ] **All Forms Filled Completely**
  - No required fields left empty
  - All URLs working and correct
  - All descriptions clear and accurate

- [ ] **All Materials Uploaded**
  - Screenshots uploaded
  - Demo video uploaded (URL provided)
  - App icon uploaded

- [ ] **App is Live and Accessible**
  - Production app at https://www.flowtra.store is accessible
  - TikTok integration is functional
  - No critical bugs or errors

- [ ] **Test Account Ready**
  - Test account credentials provided
  - Account is private (required)
  - Test video exists for reviewers to publish

- [ ] **Contact Information Correct**
  - Email address monitored daily
  - Prepared to respond to reviewer questions
  - Response time: Within 24 hours

---

## 📝 Submission Process

### Step 1: Access Developer Portal
1. Go to https://developers.tiktok.com/
2. Login with your developer account
3. Navigate to "My Apps"
4. Select your app (Flowtra)

### Step 2: Request Production Access
1. Click "Request Production Access" or similar button
2. Fill in application form
3. Upload all prepared materials

### Step 3: Form Sections

#### A. Basic Information
- App Name: Flowtra
- App Description: (Use prepared description)
- Website URL: https://www.flowtra.store
- Privacy Policy URL: https://www.flowtra.store/privacy
- Terms of Service URL: https://www.flowtra.store/terms

#### B. Products & Scopes
- Select: Login Kit
- Select: Content Posting API
- Check: user.info.basic
- Check: video.publish

#### C. Detailed Explanation
- Copy from: `tiktok-review-form-text.md`
- Or if more space: Use `tiktok-app-review-submission.md`

#### D. Screenshots
- Upload all prepared screenshots
- Label each screenshot clearly

#### E. Demo Video
- Provide YouTube/Vimeo URL
- Or upload video file directly

#### F. Test Account
- Provide credentials securely
- Note: Account must be private

### Step 4: Submit
1. Review all information carefully
2. Check all required fields are filled
3. Click "Submit for Review"
4. Save confirmation email

---

## ⏰ After Submission

### Expected Timeline
- **Review Duration**: 1-2 weeks (typically)
- **May Request More Info**: Respond within 24 hours
- **Approval**: Will receive email notification

### While Waiting
- [ ] Monitor email daily for reviewer questions
- [ ] Keep test account active and private
- [ ] Keep app functional and bug-free
- [ ] Don't make major changes to TikTok integration

### If Approved ✅
1. You'll receive approval email
2. App status changes to "Live" or "Production"
3. Update code to remove SELF_ONLY restriction:
   - Remove forced privacy level in API
   - Restore privacy selection in UI
4. Test public account publishing
5. Announce feature to users

### If Rejected ❌
1. Review rejection reasons carefully
2. Address all feedback points
3. Make requested changes
4. Resubmit with explanation of changes
5. Reference: Update "Revision History" section

---

## 🆘 Common Rejection Reasons

**Be prepared to address these**:

1. **Insufficient Documentation**
   - Solution: Use our comprehensive documents
   - Solution: Provide more detailed screenshots

2. **Privacy Policy Missing TikTok Section**
   - Solution: Add dedicated TikTok integration section
   - Solution: Explain data usage clearly

3. **Demo Video Not Clear**
   - Solution: Add voiceover explanation
   - Solution: Show complete user flow

4. **Test Account Not Working**
   - Solution: Verify account is private
   - Solution: Ensure credentials are correct
   - Solution: Create test video for reviewers

5. **Unclear Scope Usage**
   - Solution: Our documents explain this clearly
   - Solution: Emphasize user control and transparency

6. **Security Concerns**
   - Solution: Explain token encryption
   - Solution: Highlight data minimization
   - Solution: Show compliance measures

---

## 📞 Support During Review

**If you have questions**:
- TikTok Developer Support: https://developers.tiktok.com/support
- Check Status: Developer Portal → My Apps → Flowtra
- Response Time: Allow 2-3 business days for support responses

**If reviewers contact you**:
- Respond within 24 hours
- Provide requested information promptly
- Be professional and thorough
- Reference your documentation

---

## 🎯 Success Criteria

**Your submission is ready when**:

✅ All checklist items marked complete
✅ All materials uploaded and working
✅ All URLs accessible and correct
✅ Test account functional
✅ Demo video clear and complete
✅ Documentation comprehensive
✅ App fully functional with no critical bugs

---

**Good luck with your submission!** 🚀

If you follow this checklist carefully, your approval chances are very high. The key is being thorough, transparent, and demonstrating clear user benefit.

---

*For questions about this checklist, contact: dev@flowtra.store*
