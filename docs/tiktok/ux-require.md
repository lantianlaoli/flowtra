# TikTok Content Sharing Guidelines
## Required UX Implementation in Your App (Checklist)

> Scope: Direct Post API “Post to TikTok” page UX requirements.

---

## 1) Must fetch latest creator info when rendering the “Post to TikTok” page

- [ ] Call `creator_info` API to retrieve the latest creator info before rendering the posting UI.
- [ ] Display the creator’s **nickname** on the upload/posting page so the user knows **which TikTok account** will receive the content.
- [ ] If `creator_info` indicates the creator **cannot make more posts at this moment**, you must:
  - [ ] Stop the current publishing attempt
  - [ ] Prompt the user to try again later
- [ ] If posting a video:
  - [ ] Validate the video duration against `max_video_post_duration_sec` from `creator_info`

---

## 2) Must let users enter/select required post metadata

### 2a) Title
- [ ] Allow user to enter/edit the post title

### 2b) Privacy Status (mandatory UX requirements)
- [ ] Privacy options shown in UX must match `privacy_level_options` from `creator_info`
- [ ] User must manually select privacy status from a dropdown
- [ ] No default privacy value is allowed

### 2c) Interaction Ability: Allow Comment / Duet / Stitch
- [ ] If `creator_info` says an interaction is disabled in creator settings:
  - [ ] Disable and grey out the corresponding checkbox in your UX
- [ ] None of these interaction checkboxes can be checked by default
- [ ] For **Photo Posts**:
  - [ ] Only “Allow Comment” can be displayed
  - [ ] Duet and Stitch are not applicable

### Consent declaration (before publish)
- [ ] Before allowing users to post, show a declaration asking for consent **before the publish button**
- [ ] The declaration must clearly state:
  - "By posting, you agree to TikTok's Music Usage Confirmation"

---

## 3) Must allow users to disclose Commercial Content

### 3a) Content Disclosure Setting
- [ ] Provide a commercial content disclosure toggle:
  - [ ] Default state: OFF
  - [ ] When enabled, show checkboxes:
    - [ ] "Your brand"
    - [ ] "Branded content"
- [ ] Behavior rules:
  - [ ] Multiple selection is allowed
  - [ ] At least one checkbox must be selected to proceed
  - [ ] If toggle is ON but no checkbox selected:
    - [ ] Disable the publish button
    - [ ] Show hover notification:
      - "You need to indicate if your content promotes yourself, a third party, or both."

### Labeling prompts (must show when selected)
- [ ] If user selects "Your brand":
  - Show prompt: "Your photo/video will be labeled as 'Promotional content'"
- [ ] If user selects "Branded content":
  - Show prompt: "Your photo/video will be labeled as 'Paid partnership'"
- [ ] If user selects both:
  - Show prompt: "Your photo/video will be labeled as 'Paid partnership'"

### 3b) Privacy Management (commercial content constraints)
- [ ] If user wants "Branded Content":
  - [ ] It can only be configured with visibility as public/friends
- [ ] If visibility is set to "private" (only me), then you must do ONE of the following:
  - [ ] Disable "Branded Content" option and inform user branded content can't be private
  - [ ] OR automatically switch visibility to public when user chooses "Branded Content" and inform user
- [ ] If commercial toggle is ON and "Branded Content" is checked BEFORE selecting privacy:
  - [ ] Disable "only me" permission
  - [ ] Hover prompt must state:
    - "Branded content visibility cannot be set to private."

---

## 4) Compliance requirements (declarations vary with commercial selections)

If commercial content toggle is ON:

- [ ] If ONLY "Your Brand" is checked:
  - Declaration: "By posting, you agree to TikTok's Music Usage Confirmation."
- [ ] If ONLY "Branded Content" is checked:
  - Declaration: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
- [ ] If BOTH are checked:
  - Declaration: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."

---

## 5) Users must have full awareness and control of what is posted

- [ ] Show a preview of the content to be posted
- [ ] Do NOT add promotional watermarks/logos to the creator’s content
- [ ] Any preset text (including title/hashtags) must be editable by the user before posting
- [ ] Only start sending content materials to TikTok AFTER the user has expressly consented to the upload
- [ ] Clearly notify users that after publishing, it may take a few minutes to process and become visible on their profile
- [ ] Provide posting status visibility by either:
  - [ ] Polling the `publish/status/fetch` API
  - [ ] Or handling status update webhooks

---