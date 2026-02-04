# Tikfly API — Get User Info

## Overview
Retrieve public profile information and statistics for a TikTok user by `uniqueId` (username).

This is an **unofficial TikTok API** provided by Tikfly and exposed via RapidAPI.

---

## Endpoint
GET /api/user/info

Base URL:
https://tiktok-api23.p.rapidapi.com

Full URL:
https://tiktok-api23.p.rapidapi.com/api/user/info

---

## Authentication
Required via HTTP header.

Headers:
- x-rapidapi-key: string (required)

---

## Query Parameters

| Name     | Type   | Required | Description |
|----------|--------|----------|-------------|
| uniqueId | string | yes      | TikTok username (e.g. "taylorswift") |

---

## Response Format
JSON object.

Top-level fields:
- userInfo: object
- statusCode: number

---

## Response Schema

### userInfo

#### userInfo.stats (number values)
User engagement statistics (numeric).

Fields:
- diggCount: number
- followerCount: number
- followingCount: number
- friendCount: number
- heart: number
- heartCount: number
- videoCount: number

---

#### userInfo.statsV2 (string values)
Same statistics as `stats`, but returned as strings.

Fields:
- diggCount: string
- followerCount: string
- followingCount: string
- friendCount: string
- heart: string
- heartCount: string
- videoCount: string

---

#### userInfo.user
User profile metadata.

Fields:
- id: string  
- secUid: string  
- uniqueId: string  
- nickname: string  
- signature: string  
- verified: boolean  

Avatar URLs:
- avatarLarger: string (1080x1080)
- avatarMedium: string (720x720)
- avatarThumb: string (100x100)

---

## Example Response

```json
{
  "userInfo": {
    "stats": {
      "diggCount": 2276,
      "followerCount": 33300000,
      "followingCount": 0,
      "friendCount": 0,
      "heart": 263500000,
      "heartCount": 263500000,
      "videoCount": 78
    },
    "statsV2": {
      "diggCount": "2276",
      "followerCount": "33265139",
      "followingCount": "0",
      "friendCount": "0",
      "heart": "263479941",
      "heartCount": "263479941",
      "videoCount": "78"
    },
    "user": {
      "id": "6881290705605477381",
      "secUid": "MS4wLjABAAAAqB08cUbXa...",
      "uniqueId": "taylorswift",
      "nickname": "Taylor Swift",
      "signature": "This is pretty much just a cat account",
      "verified": true,
      "avatarLarger": "https://...",
      "avatarMedium": "https://...",
      "avatarThumb": "https://..."
    }
  },
  "statusCode": 0
}
