
---

### **Summary of TikTok Content Sharing Guidelines**

This document outlines the key principles, user experience requirements, and technical considerations for developers using the TikTok API to share content.

---

#### **1. General Policy**

*   **Watermark Prohibition**: You are strictly forbidden from adding any brand names, logos, watermarks, promotional branding, links, or text to content shared on TikTok.
*   **Direct Post API Guidelines**:
    *   For unverified API clients, all uploaded content will be restricted to **private (self-visible)**.
    *   Unverified clients are limited to **5 unique users** posting content within a 24-hour period. These user accounts must be set to private at the time of posting.
    *   All API clients (both verified and unverified) are subject to rate limits, including a cap on the number of active creators and the number of posts per creator within a 24-hour period.

---

#### **2. API Intent**

*   **Promote Originality**: API clients should be designed to help creators publish original content directly to TikTok, not to copy or re-post content from other platforms.
*   **Public-Facing Applications**: The intended use for the API is for applications that serve a broad public audience, not for internal or private-use tools.

---

#### **3. User Experience (UX) Implementation Requirements**

*   **Creator Information**: Your application must display the creator's nickname on the posting page and properly handle any posting restrictions returned by the API.
*   **Content Metadata**: You must provide options for the user to manually input or select the following:
    *   Title/Caption
    *   Privacy Level (e.g., Public, Private)
    *   Interaction Permissions (Comments, Duet, Stitch)
*   **Commercial Content Disclosure**: You must include an option for users to declare if their content is promoting a brand, product, or service. If selected, your app must display the appropriate disclosure notices.
*   **User Consent and Control**:
    *   A preview of the content must be shown to the user before posting.
    *   Your application must not add any promotional watermarks.
    *   Users must be able to edit any preset text or captions.
    *   Uploading must only begin after the user gives explicit consent (e.g., by clicking a "Post" button).

---

#### **4. Technical Considerations**

*   **Client Secret Confidentiality**: Your `client_secret` must be kept confidential and secure. It should never be exposed on the client-side or in any public repository.
*   **Efficient Uploading**: Choose the correct upload method based on content location:
    *   `PULL_FROM_URL`: Use when the video content is hosted on your server.
    *   `FILE_UPLOAD`: Use when the video content is located on the user's device.

---
