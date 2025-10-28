# TikTok 发布功能调试指南

## 概述

本指南帮助你诊断和修复 TikTok 视频发布过程中遇到的问题。我们已经添加了详细的日志记录和测试工具，让你能够快速定位问题根源。

## 调试工具

### 1. 增强日志系统

我们在以下文件中添加了详细的日志记录：

- **`app/api/tiktok/publish/init/route.ts`**: 主发布流程日志，前缀 `[TikTok Publish]`
- **`lib/tiktok-upload-helper.ts`**: 分块上传日志，前缀 `[uploadChunk]`

### 2. 独立测试脚本

**位置**: `scripts/test-tiktok-publish.ts`

**用途**: 独立测试每个发布组件，快速定位故障点

**运行方式**:
```bash
# 仅测试连接和 token
npx tsx scripts/test-tiktok-publish.ts

# 完整测试（包括视频下载和上传）
npx tsx scripts/test-tiktok-publish.ts <history-id>
```

## 快速诊断流程

### Step 1: 检查本地 TikTok 连接

```bash
# 启动开发服务器
pnpm dev

# 访问 Dashboard 查看是否显示 TikTok 连接状态
# 应该显示: "Lantian laoli" 和 "Connected" 状态
```

**验证点**:
- ✅ UI 显示 TikTok 用户名 "Lantian laoli"
- ✅ 显示绿色 "Connected" 状态
- ✅ Token 过期时间显示正常（2025-10-29 02:55:34 之前有效）

**如果连接未显示**:
```sql
-- 检查数据库连接记录
SELECT
  user_id,
  display_name,
  token_expires_at,
  CASE
    WHEN token_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as token_status
FROM user_tiktok_connections
WHERE user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';
```

### Step 2: 运行独立测试脚本

```bash
# 获取一个已完成的 history ID
# 可以从 Dashboard 或数据库中获取

npx tsx scripts/test-tiktok-publish.ts <your-history-id>
```

**测试脚本会依次验证**:

1. **Test 1: TikTok Connection Check** ✅
   - 验证连接存在
   - 检查 token 过期时间

2. **Test 2: Access Token Validation** ✅
   - 解密 token
   - 调用 TikTok User Info API 验证 token 有效性

3. **Test 3: Video Download** ✅
   - 从数据库获取视频 URL
   - 下载视频 buffer
   - 验证视频格式和大小

4. **Test 4: TikTok Init API** ✅
   - 调用 TikTok init API
   - 获取 publish_id 和 upload_url

5. **Test 5: Chunk Upload** ✅
   - 上传第一个分块（仅测试，不完整上传）
   - 验证分块上传机制

**如果某个测试失败，脚本会立即停止并显示详细错误信息。**

### Step 3: 通过 UI 测试完整发布流程

```bash
# 确保开发服务器正在运行
pnpm dev

# 在浏览器中:
# 1. 访问 /dashboard/history
# 2. 找到一个已完成的视频项目
# 3. 点击 "Post to TikTok" 按钮
# 4. 填写表单并提交
```

**监控控制台日志**:

打开浏览器开发者工具（F12）和终端窗口，观察以下日志流：

```
[TikTok Publish] Fetching video from: https://...
[TikTok Publish] Starting video download...
[TikTok Publish] Video downloaded successfully, size: XXXXX bytes
[TikTok Publish] Validating video format...
[TikTok Publish] Video validation passed
[TikTok Publish] Video size: XX.XX MB
[TikTok Publish] Calculating chunks...
[TikTok Publish] Chunking: X chunks of ~XX.XX MB each
[TikTok Publish] Initializing TikTok upload...
[TikTok Publish] Init payload: {...}
[TikTok Publish] Init response status: 200
[TikTok Publish] Init response data: {...}
[TikTok Publish] Got publish_id: xxx
[TikTok Publish] Got upload_url: xxx
[TikTok Publish] Starting chunk upload (X chunks)...
[TikTok Publish] Uploading chunk 1/X (XX.XX MB, range 0-XXXXX)...
[uploadChunk] Uploading chunk 0: bytes 0-XXXXX/XXXXX (XXXXX bytes)
[uploadChunk] Chunk 0 response status: 200
[uploadChunk] Chunk 0 uploaded successfully
[TikTok Publish] Chunk 1/X uploaded successfully in XXXXms
...
[TikTok Publish] All chunks uploaded successfully
```

## 常见错误模式与解决方案

### Error 1: Token 过期

**症状**:
```
❌ Token has expired!
或
Token validation failed: 401 Unauthorized
```

**原因**: Access token 已过期（当前 token 在 2025-10-29 02:55:34 前有效）

**解决方案**:
1. 在生产环境重新绑定 TikTok 账号
2. 导出新的 token 数据
3. 更新本地数据库:
```sql
UPDATE user_tiktok_connections
SET
  access_token = '新的加密 token',
  refresh_token = '新的加密 refresh token',
  token_expires_at = '新的过期时间',
  updated_at = NOW()
WHERE user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';
```

### Error 2: 视频下载失败

**症状**:
```
❌ Video download failed: Failed to fetch video: 403 Forbidden
或
Failed to fetch video: 404 Not Found
```

**可能原因**:
1. Supabase 存储 URL 已过期（signed URLs 有时效）
2. 视频文件已被删除
3. 权限问题（RLS policy）

**诊断步骤**:
```bash
# 直接测试视频 URL
curl -I "视频 URL"

# 检查数据库中的视频状态
SELECT id, status, video_url
FROM standard_ads_projects
WHERE id = '<history-id>'
  AND user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';
```

**解决方案**:
- 如果是 signed URL 过期，重新生成视频或使用 public URL
- 检查 Supabase 存储权限配置

### Error 3: 视频格式验证失败

**症状**:
```
❌ Video validation failed: Video format may not be valid MP4
```

**原因**: 视频不是有效的 MP4 格式或编码不正确

**解决方案**:
1. 检查 KIE API 返回的视频格式
2. 确保视频使用 H.264 编码
3. 验证视频文件头（magic bytes）:
```bash
# 检查文件头
xxd -l 12 video.mp4
# 应该看到 'ftyp' 或 'mdat' 在偏移 4-8 字节
```

### Error 4: TikTok Init API 失败

**症状**:
```
❌ TikTok init failed (400): {"error":{"code":"invalid_request","message":"..."}}
```

**可能原因**:
1. Token 权限不足（缺少 `video.publish` scope）
2. 视频参数不符合 TikTok 要求
3. chunk_size 或 total_chunk_count 计算错误

**诊断步骤**:
```bash
# 检查 token scopes
SELECT scope
FROM user_tiktok_connections
WHERE user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';

# 应该包含: user.info.basic,video.publish
```

**检查日志中的 Init Payload**:
```json
{
  "post_info": {
    "title": "...",
    "privacy_level": "SELF_ONLY",  // 测试时使用私密
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 12345678,  // 必须准确
    "chunk_size": 10485760,   // 5MB-64MB
    "total_chunk_count": 2    // 必须准确
  }
}
```

**解决方案**:
- 验证所有参数符合 TikTok API 规范
- 确保 privacy_level 值正确: `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `SELF_ONLY`

### Error 5: 分块上传失败

**症状**:
```
❌ Chunk upload failed at X/Y: 400 Bad Request
或
Chunk upload failed (413): Request Entity Too Large
```

**可能原因**:
1. Content-Range 头不正确
2. 分块大小超出限制（5MB-64MB，最后一块可 128MB）
3. 网络超时
4. Upload URL 已过期

**诊断日志示例**:
```
[uploadChunk] Uploading chunk 0: bytes 0-10485759/20971520 (10485760 bytes)
[uploadChunk] Chunk 0 response status: 400
[uploadChunk] Chunk 0 failed with status 400: Invalid Content-Range
```

**解决方案**:
1. 验证 Content-Range 格式: `bytes {start}-{end}/{total}`
2. 确保分块边界正确（end = start + size - 1）
3. 检查分块大小计算:
```typescript
// 正确的分块计算在 lib/tiktok-upload-helper.ts
const { chunkSize, totalChunks, chunks } = calculateChunks(videoSize);
// chunkSize: 5MB-64MB
// 最后一块可以小于 chunkSize 或大于 64MB（但 ≤128MB）
```

### Error 6: 网络超时

**症状**:
```
❌ Chunk upload failed: fetch failed
或
Error: network timeout
```

**原因**:
- 网络不稳定
- 视频文件过大
- TikTok 服务器响应慢

**解决方案**:
1. 添加重试机制（已在代码中实现 `retryWithBackoff`）
2. 减小分块大小（当前默认 10MB）
3. 检查网络连接
4. 使用生产环境测试（生产服务器可能有更好的网络）

### Error 7: 未审核应用权限限制 ⚠️

**症状**:
```
❌ TikTok init failed (403): unaudited_client_can_only_post_to_private_accounts
或
{"error":{"code":"unaudited_client_can_only_post_to_private_accounts","message":"..."}}
```

**原因**:
TikTok 应用处于**开发模式**（未经 TikTok 官方审核），仅允许发布**私密视频**（privacy_level: SELF_ONLY）。

**TikTok API 权限级别**:
- **Development Mode** (当前): 🔒 仅私密发布
- **Production Mode** (需审核): ✅ 公开/好友/私密

**当前解决方案 (已实施)**:
✅ 代码已自动强制使用 `SELF_ONLY` 隐私级别
- 后端 API 会自动覆盖任何隐私级别为 SELF_ONLY
- 前端 UI 已移除隐私选择，显示明显警告
- 所有发布的视频仅发布者自己可见

**日志特征**:
```
[TikTok Publish] Privacy level: PUBLIC_TO_EVERYONE → forced to SELF_ONLY (unaudited app restriction)
```

**长期解决方案**:
如果将来需要支持公开发布：
1. 在 [TikTok Developer Portal](https://developers.tiktok.com/) 提交应用审核
2. 提供应用使用场景说明和演示视频
3. 等待 TikTok 审核（通常 1-2 周）
4. 审核通过后：
   - 移除代码中的强制 SELF_ONLY 限制
   - 恢复前端隐私级别选择功能
   - 用户可以选择公开/好友/私密发布

**审核材料准备**:
- 应用功能说明文档
- 用户流程演示视频
- 隐私政策和服务条款
- 数据使用说明
- 联系方式和技术支持信息

**注意事项**:
⚠️ 即使前端代码尝试发送其他隐私级别，后端也会强制覆盖为 SELF_ONLY
⚠️ 这不是 bug，而是 TikTok 平台的安全限制
⚠️ 私密视频功能完全正常，只是可见性受限

## 日志解读指南

### 成功的完整日志流

```
[TikTok Publish] Fetching video from: https://xavlyimjsqfcrhpfsadp.supabase.co/storage/v1/object/public/videos/...
[TikTok Publish] Starting video download...
[TikTok Publish] Video downloaded successfully, size: 8734567 bytes
[TikTok Publish] Validating video format...
[TikTok Publish] Video validation passed
[TikTok Publish] Video size: 8.33 MB
[TikTok Publish] Calculating chunks...
[TikTok Publish] Chunking: 1 chunks of ~8.33 MB each
[TikTok Publish] Initializing TikTok upload...
[TikTok Publish] Init payload: {
  "post_info": {
    "title": "Test Video",
    "privacy_level": "SELF_ONLY",
    ...
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 8734567,
    "chunk_size": 8734567,
    "total_chunk_count": 1
  }
}
[TikTok Publish] Init response status: 200
[TikTok Publish] Init response data: {
  "data": {
    "publish_id": "v_pub_xxxxxx",
    "upload_url": "https://open-upload.tiktokapis.com/video/..."
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "..."
  }
}
[TikTok Publish] Got publish_id: v_pub_xxxxxx
[TikTok Publish] Got upload_url: https://open-upload.tiktokapis.com/video/...
[TikTok Publish] Starting chunk upload (1 chunks)...
[TikTok Publish] Uploading chunk 1/1 (8.33 MB, range 0-8734566)...
[uploadChunk] Uploading chunk 0: bytes 0-8734566/8734567 (8734567 bytes)
[uploadChunk] Chunk 0 response status: 200
[uploadChunk] Chunk 0 uploaded successfully
[TikTok Publish] Chunk 1/1 uploaded successfully in 3245ms
[TikTok Publish] All chunks uploaded successfully
```

### 关键检查点

| 日志消息 | 含义 | 失败时检查 |
|---------|------|-----------|
| `Video downloaded successfully` | 视频下载成功 | URL 是否有效，权限是否正确 |
| `Video validation passed` | 视频格式正确 | 是否为 MP4 H.264 |
| `Init response status: 200` | TikTok 接受初始化请求 | Token 是否有效，参数是否正确 |
| `publish_id: v_pub_xxx` | 获得发布 ID | 检查 error.code 是否为 "ok" |
| `Chunk X response status: 200` | 分块上传成功 | Content-Range 是否正确 |
| `All chunks uploaded successfully` | 完整上传完成 | 可以查询发布状态 |

## 高级调试技巧

### 1. 手动测试 TikTok API

```bash
# 解密 access token（在 Node.js REPL 中）
node
> const crypto = require('crypto');
> const encrypted = 'b54a0c0a67378ea55db3950a6c61a329:39107058175f89c52867bec2ee014bc4...';
> const key = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY || process.env.TIKTOK_CLIENT_SECRET.slice(0, 32).padEnd(32, '0');
> const parts = encrypted.split(':');
> const iv = Buffer.from(parts[0], 'hex');
> const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
> let decrypted = decipher.update(parts[1], 'hex', 'utf8');
> decrypted += decipher.final('utf8');
> console.log(decrypted);

# 使用解密的 token 测试 User Info API
curl -H "Authorization: Bearer <decrypted-token>" \
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name"
```

### 2. 监控上传速度

从日志中提取上传时间，计算每个分块的上传速度：

```
Chunk 1/5 uploaded successfully in 2340ms
→ 速度 = 10 MB / 2.34s ≈ 4.27 MB/s
```

如果上传速度异常慢（< 1 MB/s），可能是网络问题。

### 3. 比较生产和本地日志

如果生产环境失败但本地成功（或反之），对比日志差异：
- Init payload 是否一致？
- 分块大小和数量是否相同？
- 响应状态码有何不同？

### 4. 检查 TikTok API 限流

TikTok API 有速率限制。如果收到 429 错误：
```
Response status: 429 Too Many Requests
```

**解决方案**: 等待一段时间后重试，或联系 TikTok 开发者支持提高限额。

## 环境差异注意事项

### 本地 vs 生产环境

| 差异点 | 本地 | 生产 |
|-------|------|------|
| **User ID** | `user_31j68a38A3Q4CDNgdXvWRgiCK7A` | `user_32XJdpmkWARt66oIoJ99ccgHIQF` |
| **Supabase** | 本地项目 | 生产项目 |
| **视频 URL** | 可能不同（本地生成 vs 生产生成） | 生产 URL |
| **TikTok 绑定** | 复制自生产（共享 token） | 真实绑定 |
| **网络** | 本地网络（可能较慢） | Vercel 边缘网络（更快） |

**重要**: 本地和生产共享同一个 TikTok token（从生产复制），因此：
- ✅ 可以在本地测试发布功能
- ⚠️ 在本地发布会真实发布到 TikTok 账号
- ⚠️ Token 过期影响两个环境

## Token 过期管理

**当前 Token 过期时间**: 2025-10-29 02:55:34+00

**剩余时间监控**:
```sql
SELECT
  display_name,
  token_expires_at,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 3600 AS hours_remaining
FROM user_tiktok_connections
WHERE user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';
```

**Token 过期前的处理**:

1. **提前 24 小时警告**: Token 快要过期时，在 UI 显示警告
2. **Refresh Token**: TikTok 支持刷新 token，但当前未实现自动刷新
3. **手动重新绑定**: 最可靠的方法

**刷新 Token 流程** (未来可以实现):
```typescript
// 使用 refresh_token 获取新的 access_token
const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: decryptedRefreshToken
  })
});
```

## 快速检查清单

在开始调试前，快速检查以下项目：

- [ ] 开发服务器正在运行 (`pnpm dev`)
- [ ] 数据库中有 TikTok 连接记录
- [ ] Token 未过期（< 2025-10-29 02:55:34）
- [ ] 环境变量已配置:
  - [ ] `TIKTOK_CLIENT_KEY`
  - [ ] `TIKTOK_CLIENT_SECRET`
  - [ ] `TIKTOK_TOKEN_ENCRYPTION_KEY` 或 `TIKTOK_CLIENT_SECRET`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 有至少一个已完成的视频项目可供测试
- [ ] 浏览器开发者工具已打开（查看前端日志）
- [ ] 终端窗口可见（查看后端日志）

## 获取帮助

如果以上步骤无法解决问题：

1. **收集完整日志**: 从开始到失败的全部日志（包括 `[TikTok Publish]` 和 `[uploadChunk]` 前缀）
2. **记录错误信息**: 精确的错误消息和状态码
3. **提供上下文**:
   - 哪个环境（本地/生产）
   - 视频大小和格式
   - 失败的具体步骤
   - Token 剩余有效时间

## 总结

本调试指南提供了三层调试工具：

1. **快速验证**: 独立测试脚本（`test-tiktok-publish.ts`）
2. **详细诊断**: 增强日志系统
3. **深入分析**: 手动 API 测试和日志分析

遵循本指南的步骤式诊断流程，你应该能够快速定位并修复 TikTok 发布功能中的任何问题。
