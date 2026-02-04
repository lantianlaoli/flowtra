# Tikfly API — Download Video

## Overview
Download direct video file URLs (with and without watermark) for a specified TikTok video URL.

This endpoint is part of the **unofficial TikTok API** provided by Tikfly via RapidAPI.:contentReference[oaicite:1]{index=1}

---

## Endpoint
**GET** `/api/download/video`

Base URL:  
```

[https://tiktok-api23.p.rapidapi.com](https://tiktok-api23.p.rapidapi.com)

```

Full URL:  
```

[https://tiktok-api23.p.rapidapi.com/api/download/video](https://tiktok-api23.p.rapidapi.com/api/download/video)

````

---

## Authentication
Required via HTTP header.

| Header | Value | Required |
|--------|-------|----------|
| `x-rapidapi-key` | string | yes |

---

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string (uri) | yes | Full TikTok video URL (e.g., `https://www.tiktok.com/@user/video/1234567890`) |:contentReference[oaicite:2]{index=2}

---

## Response Format
Top-level JSON object containing download links.

### Response Fields

| Field           | Type   | Description |
|----------------|--------|-------------|
| `play`         | string | Direct video download URL **without watermark** |:contentReference[oaicite:3]{index=3}
| `play_watermark` | string | Direct video download URL **with watermark** |:contentReference[oaicite:4]{index=4}

---

## Example cURL

```bash
curl --request GET \
  --url "https://tiktok-api23.p.rapidapi.com/api/download/video?url=https://www.tiktok.com/@user/video/1234567890" \
  --header "x-rapidapi-key: <your-api-key>"
````

Response:

```json
{
  "play": "<direct_video_url_without_watermark>",
  "play_watermark": "<direct_video_url_with_watermark>"
}
```
