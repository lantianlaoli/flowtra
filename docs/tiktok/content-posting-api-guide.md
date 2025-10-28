# TikTok Content Posting API - 完整技术指南

本文档详细介绍 TikTok Content Posting API 的工作原理、实现方法和最佳实践。

---

## 📋 目录

1. [API 概述](#api-概述)
2. [完整工作流程](#完整工作流程)
3. [API 端点详解](#api-端点详解)
4. [分块上传算法](#分块上传算法)
5. [视频要求](#视频要求)
6. [隐私设置与发布选项](#隐私设置与发布选项)
7. [错误处理](#错误处理)
8. [代码示例](#代码示例)
9. [限制和注意事项](#限制和注意事项)

---

## API 概述

TikTok Content Posting API 允许第三方应用程序代表用户向 TikTok 发布视频和图片内容。该 API 基于 OAuth 2.0 授权，需要用户授予 `video.publish` scope。

### 核心特性

- **视频发布：** 支持本地文件上传和 URL 拉取两种方式
- **分块上传：** 大文件分块传输，提高可靠性
- **异步处理：** 上传后异步处理，支持状态查询
- **隐私控制：** 支持公开、好友、私密三种隐私级别
- **发布选项：** 可控制评论、合拍、拼接等功能

### 前置要求

1. **注册应用：** 在 [TikTok for Developers](https://developers.tiktok.com) 注册应用
2. **启用产品：** 启用 "Content Posting API" 产品
3. **配置 Direct Post：** 在应用设置中启用 Direct Post 功能
4. **获取授权：**
   - 应用获得 `video.publish` scope 批准
   - 用户授权应用访问其账号
5. **获取 Token：** 通过 OAuth 流程获取有效的 access_token

---

## 完整工作流程

### 流程图

```
1. 查询创作者信息 (Creator Info)
   ↓
2. 初始化发布 (Init)
   ↓
3. 分块上传视频 (Upload Chunks)
   ↓
4. 查询发布状态 (Status Check)
   ↓
5. 获取发布结果
```

### 详细步骤

#### Step 1: 查询创作者信息（可选但推荐）

在发布前查询创作者的隐私选项和功能权限。

**端点：** `POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/`

**作用：**
- 获取用户支持的隐私级别
- 检查是否可以发布视频
- 获取账号限制信息

#### Step 2: 初始化发布

告知 TikTok 服务器准备上传视频，获取上传 URL。

**端点：** `POST https://open.tiktokapis.com/v2/post/publish/video/init/`

**响应：**
- `publish_id`: 发布任务的唯一标识符
- `upload_url`: 分块上传的目标 URL（仅 FILE_UPLOAD 模式）

#### Step 3: 分块上传视频

使用 HTTP PUT 请求将视频分块上传到指定 URL。

**端点：** `PUT https://open-upload.tiktokapis.com/video/upload/...`

**关键点：**
- 必须按序上传（chunk 0 → 1 → 2 ...）
- 使用 `Content-Range` 头指定字节范围
- 每个块 5MB-64MB，最后一块可达 128MB

#### Step 4: 查询发布状态

轮询检查视频处理和发布状态。

**端点：** `POST https://open.tiktokapis.com/v2/post/publish/status/fetch/`

**状态值：**
- `PROCESSING_UPLOAD`: 上传中
- `SEND_TO_USER_INBOX`: 已发送到收件箱（待审核）
- `PUBLISH_COMPLETE`: 发布完成
- `FAILED`: 失败

---

## API 端点详解

### 1. Creator Info Query

**URL:** `https://open.tiktokapis.com/v2/post/publish/creator_info/query/`

**Method:** POST

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{}  // 空对象
```

**Response:**
```json
{
  "data": {
    "creator_avatar_url": "https://...",
    "creator_username": "user123",
    "creator_nickname": "John Doe",
    "privacy_level_options": [
      "PUBLIC_TO_EVERYONE",
      "MUTUAL_FOLLOW_FRIENDS",
      "SELF_ONLY"
    ],
    "comment_disabled": false,
    "duet_disabled": false,
    "stitch_disabled": false,
    "max_video_post_duration_sec": 600
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "202501..."
  }
}
```

---

### 2. Video Direct Post Init

**URL:** `https://open.tiktokapis.com/v2/post/publish/video/init/`

**Method:** POST

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "post_info": {
    "title": "Check out this amazing video!",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 50000123,
    "chunk_size": 10000000,
    "total_chunk_count": 5
  }
}
```

**参数说明：**

**`post_info` 参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 视频标题，最多 2200 字符 |
| `privacy_level` | string | 是 | 隐私级别（见下文） |
| `disable_duet` | boolean | 否 | 禁用合拍功能 |
| `disable_comment` | boolean | 否 | 禁用评论 |
| `disable_stitch` | boolean | 否 | 禁用拼接功能 |
| `video_cover_timestamp_ms` | integer | 否 | 封面时间戳（毫秒） |

**`source_info` 参数（FILE_UPLOAD 模式）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | "FILE_UPLOAD" 或 "PULL_FROM_URL" |
| `video_size` | integer | 是 | 视频总字节数 |
| `chunk_size` | integer | 是 | 每块大小（5MB-64MB） |
| `total_chunk_count` | integer | 是 | 总块数 |

**Response:**
```json
{
  "data": {
    "publish_id": "v_pub_12345...",
    "upload_url": "https://open-upload.tiktokapis.com/video/upload/..."
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "202501..."
  }
}
```

---

### 3. Video Chunk Upload

**URL:** `<upload_url>` (from init response)

**Method:** PUT

**Headers:**
```
Content-Type: video/mp4
Content-Length: <chunk_byte_length>
Content-Range: bytes <start>-<end>/<total>
```

**Body:** Raw binary chunk data

**Content-Range 格式：**
```
Content-Range: bytes 0-9999999/50000123       // Chunk 1
Content-Range: bytes 10000000-19999999/50000123  // Chunk 2
Content-Range: bytes 20000000-29999999/50000123  // Chunk 3
Content-Range: bytes 30000000-39999999/50000123  // Chunk 4
Content-Range: bytes 40000000-50000122/50000123  // Chunk 5 (final)
```

**Response:**
```
HTTP/2 200 OK
```

---

### 4. Publish Status Fetch

**URL:** `https://open.tiktokapis.com/v2/post/publish/status/fetch/`

**Method:** POST

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "publish_id": "v_pub_12345..."
}
```

**Response:**
```json
{
  "data": {
    "status": "PUBLISH_COMPLETE",
    "publicaly_available_post_id": ["7123456789012345678"]
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "202501..."
  }
}
```

**状态说明：**

| 状态 | 说明 |
|------|------|
| `PROCESSING_UPLOAD` | 正在处理上传 |
| `SEND_TO_USER_INBOX` | 已发送到用户收件箱（待审核） |
| `PUBLISH_COMPLETE` | 发布完成 |
| `FAILED` | 发布失败 |

---

## 分块上传算法

### 计算逻辑

**规则：**
1. 每块至少 5MB，最多 64MB
2. 最后一块可以达到 128MB
3. 小于 5MB 的视频必须整体上传（chunk_size = video_size）
4. 大于 64MB 的视频必须分块
5. 最少 1 块，最多 1000 块
6. 必须按序上传

**公式：**
```typescript
// 计算总块数
total_chunk_count = Math.ceil(video_size / chunk_size)

// 计算每块的范围
for (let i = 0; i < total_chunk_count; i++) {
  const start = i * chunk_size;
  const end = Math.min(start + chunk_size - 1, video_size - 1);
  // 上传 bytes[start:end]
}
```

### 示例计算

**示例 1: 50MB 视频，10MB 块大小**
```
视频大小: 50,000,123 字节
块大小: 10,000,000 字节
总块数: ceil(50,000,123 / 10,000,000) = 5

Chunk 1: bytes 0-9,999,999 (10MB)
Chunk 2: bytes 10,000,000-19,999,999 (10MB)
Chunk 3: bytes 20,000,000-29,999,999 (10MB)
Chunk 4: bytes 30,000,000-39,999,999 (10MB)
Chunk 5: bytes 40,000,000-50,000,122 (10.000123MB) ✓ 合并尾部字节
```

**示例 2: 3MB 视频（小于 5MB）**
```
视频大小: 3,145,728 字节
块大小: 3,145,728 字节 (整体上传)
总块数: 1

Chunk 1: bytes 0-3,145,727 (3MB)
```

**示例 3: 200MB 视频，32MB 块大小**
```
视频大小: 209,715,200 字节
块大小: 33,554,432 字节 (32MB)
总块数: ceil(209,715,200 / 33,554,432) = 7

Chunk 1-6: 各 32MB
Chunk 7: 剩余字节 (约 8MB)
```

### TypeScript 实现

```typescript
interface ChunkInfo {
  chunkIndex: number;
  start: number;
  end: number;
  size: number;
}

export function calculateChunks(
  videoSize: number,
  preferredChunkSize: number = 10 * 1024 * 1024  // Default 10MB
): {
  chunkSize: number;
  totalChunks: number;
  chunks: ChunkInfo[];
} {
  const MIN_CHUNK_SIZE = 5 * 1024 * 1024;   // 5MB
  const MAX_CHUNK_SIZE = 64 * 1024 * 1024;  // 64MB
  const MAX_LAST_CHUNK = 128 * 1024 * 1024; // 128MB

  // 小于 5MB 的视频整体上传
  if (videoSize < MIN_CHUNK_SIZE) {
    return {
      chunkSize: videoSize,
      totalChunks: 1,
      chunks: [{ chunkIndex: 0, start: 0, end: videoSize - 1, size: videoSize }]
    };
  }

  // 确保块大小在有效范围内
  let chunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, preferredChunkSize));

  // 计算总块数
  const totalChunks = Math.ceil(videoSize / chunkSize);

  // 生成每块的信息
  const chunks: ChunkInfo[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, videoSize - 1);
    const size = end - start + 1;

    chunks.push({
      chunkIndex: i,
      start,
      end,
      size
    });
  }

  return { chunkSize, totalChunks, chunks };
}
```

---

## 视频要求

### 格式要求

| 项目 | 要求 |
|------|------|
| **视频格式** | MP4 |
| **视频编码** | H.264 |
| **音频编码** | AAC（推荐） |
| **最大时长** | 300 秒（5 分钟），根据账号权限可能不同 |
| **最大文件大小** | 根据账号类型，通常 2GB 以下 |
| **分辨率** | 建议 720p 或以上 |
| **宽高比** | 9:16（竖屏）、16:9（横屏）、1:1（方形） |

### 最佳实践

1. **视频质量：**
   - 使用 1080p 或 720p 分辨率
   - 保持良好的照明和清晰度
   - 避免过度压缩

2. **文件大小：**
   - 优先使用 H.264 编码
   - 使用适当的比特率（1-5 Mbps）
   - 考虑上传速度和用户体验

3. **内容合规：**
   - 遵守 TikTok 社区准则
   - 避免版权侵权内容
   - 不包含违禁内容

---

## 隐私设置与发布选项

### 隐私级别

| 值 | 说明 | 适用场景 |
|------|------|----------|
| `PUBLIC_TO_EVERYONE` | 公开可见 | 所有人都可以看到视频 |
| `MUTUAL_FOLLOW_FRIENDS` | 仅好友 | 只有互关好友可以看到 |
| `SELF_ONLY` | 私密 | 只有自己可以看到 |

### 发布选项

**禁用功能：**

```json
{
  "disable_duet": true,      // 禁用合拍功能
  "disable_comment": true,   // 禁用评论
  "disable_stitch": true     // 禁用拼接功能
}
```

**视频封面：**

```json
{
  "video_cover_timestamp_ms": 1000  // 使用视频 1 秒处作为封面
}
```

### 推荐配置

**公开视频（默认）：**
```json
{
  "privacy_level": "PUBLIC_TO_EVERYONE",
  "disable_duet": false,
  "disable_comment": false,
  "disable_stitch": false
}
```

**好友分享：**
```json
{
  "privacy_level": "MUTUAL_FOLLOW_FRIENDS",
  "disable_duet": true,
  "disable_comment": false,
  "disable_stitch": true
}
```

**私密草稿：**
```json
{
  "privacy_level": "SELF_ONLY",
  "disable_duet": true,
  "disable_comment": true,
  "disable_stitch": true
}
```

---

## 错误处理

### 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `invalid_token` | Access token 无效或过期 | 刷新 token 或重新授权 |
| `insufficient_permissions` | 缺少 `video.publish` scope | 请求用户重新授权 |
| `video_too_large` | 视频文件过大 | 压缩视频或分更多块 |
| `invalid_video_format` | 视频格式不支持 | 转换为 MP4 H.264 |
| `rate_limit_exceeded` | 超过速率限制 | 等待后重试 |
| `content_violation` | 内容违规 | 检查视频内容 |

### 错误响应格式

```json
{
  "error": {
    "code": "invalid_token",
    "message": "The access token is invalid or expired",
    "log_id": "20250128..."
  }
}
```

### 重试策略

**推荐重试策略：**

```typescript
async function uploadWithRetry(
  uploadFn: () => Promise<void>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await uploadFn();
      return;  // 成功
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;  // 最后一次重试失败
      }

      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 代码示例

### 完整发布流程（Node.js）

```typescript
import fs from 'fs';
import fetch from 'node-fetch';

interface TikTokPublishOptions {
  accessToken: string;
  videoPath: string;
  title: string;
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
}

async function publishToTikTok(options: TikTokPublishOptions): Promise<string> {
  const { accessToken, videoPath, title, privacyLevel } = options;

  // 1. 读取视频文件
  const videoBuffer = fs.readFileSync(videoPath);
  const videoSize = videoBuffer.length;

  console.log(`Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

  // 2. 计算分块
  const chunkSize = 10 * 1024 * 1024;  // 10MB
  const totalChunks = Math.ceil(videoSize / chunkSize);

  console.log(`Total chunks: ${totalChunks}`);

  // 3. 初始化发布
  const initResponse = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks
        }
      })
    }
  );

  const initData = await initResponse.json();
  if (initData.error.code !== 'ok') {
    throw new Error(`Init failed: ${initData.error.message}`);
  }

  const { publish_id, upload_url } = initData.data;
  console.log(`Publish ID: ${publish_id}`);

  // 4. 上传分块
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, videoSize);
    const chunk = videoBuffer.slice(start, end);

    console.log(`Uploading chunk ${i + 1}/${totalChunks}...`);

    await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': chunk.length.toString(),
        'Content-Range': `bytes ${start}-${end - 1}/${videoSize}`
      },
      body: chunk
    });
  }

  console.log('Upload complete. Checking status...');

  // 5. 轮询状态
  let status = 'PROCESSING_UPLOAD';
  let attempts = 0;
  const maxAttempts = 60;  // 5 minutes (5s interval)

  while (status === 'PROCESSING_UPLOAD' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5s

    const statusResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ publish_id })
      }
    );

    const statusData = await statusResponse.json();
    status = statusData.data.status;
    attempts++;

    console.log(`Status: ${status} (attempt ${attempts})`);

    if (status === 'PUBLISH_COMPLETE') {
      const postId = statusData.data.publicaly_available_post_id?.[0];
      console.log(`✓ Published successfully! Post ID: ${postId}`);
      return postId;
    } else if (status === 'FAILED') {
      throw new Error('Publish failed');
    }
  }

  throw new Error('Publish timeout');
}

// 使用示例
publishToTikTok({
  accessToken: 'act.example...',
  videoPath: './my-video.mp4',
  title: 'Check out this amazing video!',
  privacyLevel: 'PUBLIC_TO_EVERYONE'
})
  .then(postId => console.log('Success!', postId))
  .catch(error => console.error('Error:', error));
```

---

## 限制和注意事项

### API 限制

1. **速率限制：**
   - 每个用户每天发布数量有限
   - 短时间内频繁发布可能被限制
   - 建议间隔至少 30 秒

2. **文件大小：**
   - 建议不超过 500MB
   - 超大文件上传可能不稳定

3. **并发限制：**
   - 每个 access_token 同时只能有一个上传任务
   - 等待前一个任务完成后再开始下一个

### 内容审核

**重要：** "All content posted by unaudited clients will be restricted to private viewing mode."

- **未审核应用：** 发布的内容仅自己可见（私密模式）
- **审核通过后：** 内容可以公开发布
- **审核流程：** 在 TikTok for Developers 提交审核申请

### 最佳实践

1. **Token 管理：**
   - 定期刷新 access_token
   - 处理 token 过期情况
   - 安全存储 refresh_token

2. **用户体验：**
   - 显示上传进度
   - 提供取消功能
   - 清晰的错误提示

3. **性能优化：**
   - 服务器端上传（避免浏览器限制）
   - 使用 Node.js streams 处理大文件
   - 实现断点续传（高级）

4. **错误处理：**
   - 实现重试机制
   - 记录详细日志
   - 用户友好的错误消息

---

## 附录

### 参考链接

- [TikTok Content Posting API 官方文档](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [TikTok Developer Portal](https://developers.tiktok.com)
- [TikTok 社区准则](https://www.tiktok.com/community-guidelines)

### 更新日志

- **2025-01-28:** 初始版本创建
- 基于 TikTok API v2

---

**文档作者：** Flowtra Development Team
**最后更新：** 2025-01-28
**联系方式：** lantianlaoli@gmail.com
