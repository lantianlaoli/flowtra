# TikTok Content Posting API - Media Transfer Analysis

## 当前实现方式

**使用方式: File Upload (HTTP) ✅**

在 `/api/tiktok/publish/init` 路由中（第 220 行），我们明确使用了：

```typescript
source_info: {
  source: 'FILE_UPLOAD',  // ← 当前实现方式
  video_size: videoSize,
  chunk_size: chunkSize,
  total_chunk_count: totalChunks
}
```

## TikTok 支持的两种媒体传输方式

### 1. File Upload (HTTP) - 当前使用 ✅

**工作原理:**
1. 我们的后端从 KIE/Supabase 下载视频到内存（Buffer）
2. 将视频分块（5MB-64MB per chunk）
3. 依次将每个块上传到 TikTok 提供的 upload_url
4. 使用 Content-Range header 跟踪上传进度

**优点:**
- ✅ **无需域名验证** - 不需要验证视频 URL 的域名所有权
- ✅ **完全控制** - 我们控制整个上传过程和时机
- ✅ **适用任何 URL** - KIE、Supabase Storage、任何第三方 URL 都可以
- ✅ **错误处理** - 可以在上传失败时重试特定块
- ✅ **已实现且运行稳定** - 无需修改

**缺点:**
- ❌ 需要我们的服务器带宽（下载 + 上传）
- ❌ 内存占用（大视频需要完整加载到内存）
- ❌ API 响应时间较长（需要等待完整上传完成）

**技术实现:**
```typescript
// 1. 从 Supabase/KIE 下载视频
const videoBuffer = await fetchVideoBuffer(videoUrl);

// 2. 分块
const { chunks } = calculateChunks(videoSize);

// 3. 逐块上传到 TikTok
for (const chunk of chunks) {
  const chunkBuffer = videoBuffer.slice(chunk.start, chunk.end + 1);
  await uploadChunk(upload_url, chunkBuffer, chunk, videoSize);
}
```

### 2. Pull from URL - 另一种方式（未使用）

**工作原理:**
1. 我们提供视频的 HTTPS URL 给 TikTok
2. TikTok 服务器自己从 URL 下载视频
3. 我们的服务器只需提供 URL，无需处理视频传输

**要求:**
- ⚠️ **必须验证域名所有权** - DNS 记录或 URL 前缀验证
- ⚠️ **必须是 HTTPS** - 不支持 HTTP
- ⚠️ **不能有重定向** - URL 必须直接返回视频文件
- ⚠️ **URL 必须保持可访问** - 1 小时超时期间必须可用

**示例 API 调用:**
```typescript
source_info: {
  source: 'PULL_FROM_URL',
  video_url: 'https://your-verified-domain.com/video.mp4'
}
```

**为什么不适合我们:**

1. **域名验证问题** ❌
   ```
   我们的视频 URL:
   - KIE API: https://kie-api-domain.com/video/xxx.mp4
   - Supabase Storage: https://abc123.supabase.co/storage/v1/object/public/videos/xxx.mp4

   问题: 这些都不是我们自己的域名，无法进行域名验证！
   ```

2. **URL 所有权** ❌
   - KIE 和 Supabase 的域名不属于我们
   - 无法添加 DNS TXT 记录
   - 无法在这些域名上进行 URL 前缀注册

3. **URL 稳定性** ⚠️
   - Supabase Storage URL 可能有过期时间
   - KIE API URL 可能有访问限制
   - 无法保证 1 小时内一直可访问

## 域名验证详解

如果想使用 Pull from URL，需要：

### 方式 1: DNS 验证
```
1. 在 TikTok Developer Portal 获取验证字符串
2. 添加 TXT 记录到你的域名:
   _tiktok-developers.yourdomain.com TXT "verification-string-xxx"
3. TikTok 验证 DNS 记录
4. 验证后，yourdomain.com 及所有子域名都可用
```

### 方式 2: URL 前缀验证
```
1. 注册具体的 URL 前缀，如:
   https://yourdomain.com/tiktok-videos/
2. TikTok 会检查该 URL 是否可访问
3. 只有该前缀下的 URL 才能使用
```

## 解决方案选项

### 选项 1: 保持当前方式（推荐） ✅

**无需任何修改**，当前的 File Upload 方式完全满足需求：
- ✅ 支持任意视频 URL（KIE、Supabase、其他）
- ✅ 无需域名验证
- ✅ 已实现并测试通过
- ✅ 用户体验良好

**唯一改进建议:**
```typescript
// 可以考虑优化内存使用，使用流式处理
// 但对于我们的视频大小（通常 < 100MB），当前方式已足够好
```

### 选项 2: 切换到 Pull from URL

**前提条件:**
1. 需要自己的视频存储服务器（有自己的域名）
2. 完成 TikTok 域名验证
3. 修改视频上传流程：视频先传到自己的服务器

**不推荐原因:**
- ❌ 需要额外的存储基础设施
- ❌ 需要域名验证流程
- ❌ KIE 和 Supabase 的 URL 无法使用
- ❌ 增加系统复杂度

### 选项 3: 混合方式

```typescript
// 根据视频来源选择传输方式
const transferMethod = videoUrl.includes('yourdomain.com')
  ? 'PULL_FROM_URL'  // 自己域名的视频用 Pull
  : 'FILE_UPLOAD';   // 第三方 URL 用 File Upload

source_info: {
  source: transferMethod,
  // ...
}
```

**适用场景:**
- 有部分视频在自己的服务器上
- 想优化这部分视频的上传速度
- 但仍需支持 KIE/Supabase 的视频

## 性能对比

### File Upload (当前)
```
Total Time = Download Time + Upload Time + Processing Time
           ≈ 5-15 seconds   + 10-30 seconds + 3-10 seconds
           ≈ 18-55 seconds (取决于视频大小和网络)
```

### Pull from URL (如果使用)
```
Total Time = API Call + TikTok Download + Processing Time
           ≈ 1 second  + 10-30 seconds    + 3-10 seconds
           ≈ 14-41 seconds

优势: 减少 4-14 秒（省略了我们服务器的下载时间）
```

但考虑到域名验证的复杂性，**性能提升不足以抵消实现成本**。

## 数据库 URL 分析

### 当前存储结构
```typescript
// standard_ads_projects
{
  id: string,
  video_url: string,  // ← KIE/Supabase 返回的 URL
  // ...
}

// 可能的 URL 格式:
// - https://xxx.supabase.co/storage/v1/object/public/videos/abc.mp4
// - https://kie-api-cdn.com/videos/xxx.mp4
// - 其他第三方 CDN URL
```

### URL 特点
- ✅ 这些 URL 是公开可访问的（public bucket）
- ✅ 我们的 File Upload 方式可以下载这些 URL
- ❌ 但不是我们自己的域名，无法用于 Pull from URL
- ✅ URL 通常长期有效（至少几小时到几天）

## 最终建议

### 🎯 当前实现完全正确，无需修改

**理由:**
1. ✅ **File Upload 方式完全适合我们的架构**
   - 视频来自第三方（KIE、Supabase）
   - 无需域名验证
   - 实现简单可靠

2. ✅ **性能已经足够好**
   - 对于常见的视频大小（10-100MB），上传时间可接受
   - 用户可以在上传过程中看到进度（future improvement）

3. ✅ **代码质量高**
   - 错误处理完善
   - 支持分块上传
   - 类型安全

### 🔮 未来优化方向（可选）

如果未来想进一步优化，可以考虑：

1. **添加上传进度反馈**
   ```typescript
   // 在前端显示上传进度
   socket.emit('upload-progress', {
     chunk: i + 1,
     total: chunks.length
   });
   ```

2. **流式处理大视频**
   ```typescript
   // 对于超大视频（>500MB），使用流而不是一次性加载
   const videoStream = await fetchVideoStream(videoUrl);
   // 边下载边上传
   ```

3. **视频预处理**
   ```typescript
   // 在自己的服务器上预先下载和缓存热门视频
   // 但对我们的场景意义不大
   ```

## 总结

| 特性 | File Upload (当前) | Pull from URL |
|------|-------------------|---------------|
| **域名验证** | ❌ 不需要 | ✅ 必须 |
| **支持第三方 URL** | ✅ 支持 | ❌ 不支持 |
| **实现复杂度** | ✅ 简单 | ❌ 复杂 |
| **服务器带宽** | ⚠️ 需要 | ✅ 不需要 |
| **错误控制** | ✅ 完全控制 | ⚠️ 部分控制 |
| **适合我们的场景** | ✅✅✅ 完美匹配 | ❌ 不适合 |

**结论: 保持当前的 File Upload 实现，无需任何修改。** 🎉

---

*文档版本: 1.0*
*更新日期: 2025-10-28*
*作者: Claude Code*
