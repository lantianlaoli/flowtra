# Tikfly API — Get User Posts

## Overview
Retrieve a list of video posts published by a TikTok user.  
This endpoint returns paginated feed items including video metadata, author info, engagement stats, and more.

This is part of the **unofficial TikTok API** offered by Tikfly via RapidAPI.:contentReference[oaicite:1]{index=1}

---

## Endpoint
**GET** `/api/user/posts`

Base URL:  
```

[https://tiktok-api23.p.rapidapi.com](https://tiktok-api23.p.rapidapi.com)

```

Full URL:  
```

[https://tiktok-api23.p.rapidapi.com/api/user/posts](https://tiktok-api23.p.rapidapi.com/api/user/posts)

````

---

## Authentication
Required via HTTP headers.

| Header | Value | Required |
|--------|-------|----------|
| `x-rapidapi-key` | string | yes |

---

## Query Parameters
*(Note: specific parameters like user ID/username may be documented in the full API doc but not shown in the snippet; typical patterns include `uniqueId` or `secUid` identifiers.)*:contentReference[oaicite:2]{index=2}

| Name      | Type   | Required | Description |
|-----------|--------|----------|-------------|
| *identifier* | string | yes | Public TikTok user identifier (e.g., uniqueId or secUid) |
| cursor    | string | no | Cursor for pagination |
| count     | integer | no | Number of items to return per page |

---

## Response Format
Top-level JSON object containing:

- `data`: object
  - `cursor`: string
  - `hasMore`: boolean
  - `itemList`: list of post objects

---

## Response Schema

### data
| Field | Type | Description |
|-------|------|-------------|
| cursor | string | Pagination cursor for next request |
| hasMore | boolean | Whether more data is available |
| itemList | array | List of post items |

---

### itemList[i]
Each post object contains detailed video and author information.

#### Author
| Field | Type | Description |
|-------|------|-------------|
| avatarLarger | string | High-res author avatar |
| avatarMedium | string | Medium-res author avatar |
| avatarThumb | string | Thumbnail avatar URL |
| id | string | Numeric author ID |
| uniqueId | string | TikTok username |
| nickname | string | Display name |
| secUid | string | Secure user identifier |
| verified | boolean | Whether account is verified |
| privateAccount | boolean | Privacy flag |

---

#### AuthorStats
| Field | Type | Description |
|-------|------|-------------|
| diggCount | number | Number of likes on author |
| followerCount | number | Follower count |
| followingCount | number | Following count |
| friendCount | number | Friend count |
| heart | number | Total hearts |
| videoCount | number | Number of videos posted |

*(Also returned as string values in `authorStatsV2`.)*:contentReference[oaicite:3]{index=3}

---

#### Post Metadata
| Field | Type | Description |
|-------|------|-------------|
| id | string | Post/item ID |
| desc | string | Caption / description |
| createTime | number | Unix timestamp |
| stats | object | Engagement statistics |
| statsV2 | object | Same fields as strings |
| music | object | Music metadata (title, author, play URL) |
| video | object | Video streaming URLs + metadata |
| challenges | array | Hashtag/challenge objects |
| duetEnabled | boolean | Duet enabled flag |
| stitchEnabled | boolean | Stitch enabled flag |
| privateItem | boolean | Post privacy flag |

Engagement stats include:
- `playCount` — video plays
- `diggCount` — likes
- `commentCount` — comments
- `shareCount` — shares
*(values exist in both numeric and string forms.)*:contentReference[oaicite:4]{index=4}

---

## Example Response (abbreviated)

```json
{
  "data": {
    "cursor": "1665126038000",
    "hasMore": true,
    "itemList": [
      {
        "author": {
          "uniqueId": "taylorswift",
          "nickname": "Taylor Swift",
          "avatarLarger": "...",
          "verified": true
        },
        "authorStats": {
          "followerCount": 33300000,
          "heart": 263500000
        },
        "desc": "Some description text",
        "id": "7572198435487501598",
        "stats": {
          "playCount": 6600000,
          "diggCount": 1100000
        },
        "video": {
          "playAddr": "https://..."
        }
      }
    ]
  }
}
````