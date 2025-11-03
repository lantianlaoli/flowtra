# Google Indexing API 设置指南

本指南将帮助你配置 Google Search Console Indexing API，使 Flowtra 能够自动提交新文章到 Google 进行索引。

## 架构概述

- **Supabase pg_cron**: 每 6 小时自动触发一次索引任务
- **Next.js API**: `/api/cron/submit-indexing` 接口处理索引逻辑
- **Google Indexing API**: 向 Google 提交 URL 索引请求
- **数据库**: `articles` 表追踪每篇文章的索引状态

## 前置要求

- Google Cloud Console 账号
- Google Search Console 访问权限（网站所有者）
- Supabase 项目（已启用 pg_cron 和 pg_net 扩展）

---

## 第一步：Google Cloud Console 配置

### 1. 创建或选择项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击顶部项目选择器
3. 创建新项目或选择现有项目（推荐为 Flowtra 创建独立项目）

### 2. 启用 Indexing API

1. 在 Google Cloud Console 中，导航到 **APIs & Services** > **Library**
2. 搜索 "Indexing API"
3. 点击 "Indexing API"
4. 点击 **Enable** 按钮

### 3. 创建 Service Account

1. 导航到 **IAM & Admin** > **Service Accounts**
2. 点击 **Create Service Account**
3. 填写信息：
   - **Service account name**: `flowtra-indexing-bot`（或任意名称）
   - **Service account description**: `Service account for Google Indexing API`
4. 点击 **Create and Continue**
5. 跳过权限设置（不需要额外角色），点击 **Continue**
6. 点击 **Done**

### 4. 创建和下载密钥

1. 在 Service Accounts 列表中，找到刚创建的账号
2. 点击账号名称进入详情页
3. 切换到 **Keys** 标签
4. 点击 **Add Key** > **Create new key**
5. 选择 **JSON** 格式
6. 点击 **Create**
7. JSON 密钥文件会自动下载到本地

### 5. 提取凭据信息

打开下载的 JSON 文件，找到以下两个字段：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "flowtra-indexing-bot@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

复制 `client_email` 和 `private_key` 的值，稍后会用到。

---

## 第二步：Google Search Console 配置

### 1. 添加 Service Account 为网站所有者

1. 访问 [Google Search Console](https://search.google.com/search-console)
2. 选择你的网站属性（例如 `https://www.flowtra.store`）
3. 点击左侧菜单的 **Settings** (设置)
4. 点击 **Users and permissions** (用户和权限)
5. 点击 **Add user** (添加用户)
6. 粘贴 Service Account 的 `client_email`（例如 `flowtra-indexing-bot@your-project-id.iam.gserviceaccount.com`）
7. 权限选择 **Owner** (所有者)
8. 点击 **Add** (添加)

**重要**: 必须设置为 **Owner** 权限，否则 Indexing API 将无法工作。

---

## 第三步：环境变量配置

### 1. 在 Vercel/服务器上配置环境变量

将以下环境变量添加到 `.env` 文件（或 Vercel 环境变量设置）：

```bash
# Google Indexing API (必需)
GOOGLE_CLIENT_EMAIL=flwotra-ai-n8n-blog@flowtra.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"

# Cron Security (可选)
# 如果你想额外保护 cron 接口，可以设置此值
# 留空则不验证（Supabase cron 是内部调用，通常不需要）
CRON_SECRET=
```

**注意事项**:
- `GOOGLE_PRIVATE_KEY` 必须用双引号包裹
- 保留 `\n` 换行符（不要替换为实际换行）
- `CRON_SECRET` 是可选的，可以留空

### 2. Vercel 环境变量设置

如果部署在 Vercel：
1. 进入项目设置 > Environment Variables
2. 添加以下两个必需的环境变量：
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
3. 选择 **Production**, **Preview**, **Development** 环境
4. 点击 **Save**
5. 重新部署项目使环境变量生效

**提示**: `CRON_SECRET` 可以不添加，除非你需要额外的安全保护。

---

## 第四步：运行数据库 Migration

### 1. 应用 Migration

确保 migration 文件已应用到 Supabase 数据库：

```bash
# 本地开发环境
pnpm supabase db push

# 或通过 Supabase Dashboard
# 1. 进入 Supabase Dashboard > SQL Editor
# 2. 打开 supabase/migrations/20251103000000_add_indexing_fields_to_articles.sql
# 3. 复制内容并执行
```

### 2. 验证字段已添加

在 Supabase Dashboard > Table Editor > articles 表，检查以下新字段：
- `indexed_at` (timestamptz)
- `indexing_status` (text)
- `indexing_error` (text)
- `indexing_attempts` (integer)

---

## 第五步：配置 Supabase Cron Job

### 1. 启用必要的扩展

在 Supabase Dashboard > SQL Editor 中执行：

```sql
-- 启用 pg_cron 扩展（定时任务）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 启用 pg_net 扩展（HTTP 请求）
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. 创建 Cron Job

在 Supabase Dashboard > SQL Editor 中执行：

```sql
-- 创建每 6 小时执行一次的定时任务
SELECT cron.schedule(
  'submit-google-indexing',           -- 任务名称
  '0 */6 * * *',                      -- Cron 表达式：每 6 小时
  $$
  SELECT
    net.http_post(
      url := 'https://www.flowtra.store/api/cron/submit-indexing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

**注意**：
- 确保 URL 为你的生产域名
- CRON_SECRET 是可选的，Supabase cron 是内部调用，通常不需要额外认证

### 3. 验证 Cron Job 已创建

```sql
-- 查看所有 cron 任务
SELECT * FROM cron.job;

-- 应该能看到名为 'submit-google-indexing' 的任务
```

### 4. 查看 Cron Job 执行日志

```sql
-- 查看最近的执行记录
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'submit-google-indexing')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 第六步：测试配置

### 1. 手动触发测试

使用 curl 或 Postman 手动触发 API：

```bash
curl -X POST https://www.flowtra.store/api/cron/submit-indexing \
  -H "Content-Type: application/json"
```

如果你设置了 `CRON_SECRET`，则需要添加认证头：

```bash
curl -X POST https://www.flowtra.store/api/cron/submit-indexing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. 检查响应

成功响应示例：

```json
{
  "success": true,
  "message": "Processed 5 articles: 4 successful, 1 failed",
  "stats": {
    "total": 5,
    "successful": 4,
    "failed": 1,
    "duration": 2340
  },
  "articles": [
    { "slug": "article-1", "url": "https://www.flowtra.store/blog/article-1" },
    ...
  ]
}
```

### 3. 验证数据库更新

在 Supabase Dashboard 查询：

```sql
SELECT id, title, slug, indexing_status, indexed_at, indexing_attempts, indexing_error
FROM articles
ORDER BY created_at DESC
LIMIT 10;
```

检查 `indexing_status` 是否已更新为 `success` 或 `failed`。

---

## 故障排查

### 问题 1: "Unauthorized" 错误

**原因**: Service Account 未添加到 Search Console 或权限不足

**解决方案**:
1. 确认 Service Account email 已在 Google Search Console 中添加
2. 确认权限为 **Owner**（不是 Editor 或 Viewer）
3. 等待 5-10 分钟让权限生效

### 问题 2: "Invalid credentials" 错误

**原因**: 环境变量配置错误

**解决方案**:
1. 检查 `GOOGLE_CLIENT_EMAIL` 是否正确
2. 检查 `GOOGLE_PRIVATE_KEY` 格式：
   - 必须用双引号包裹
   - 必须包含 `\n` 换行符（不是实际换行）
   - 必须包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
3. 重新部署应用使环境变量生效

### 问题 3: Cron Job 未执行

**原因**: Supabase 扩展未启用或 cron 配置错误

**解决方案**:
1. 验证 `pg_cron` 和 `pg_net` 已启用：
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```
2. 检查 cron job 是否创建成功：
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'submit-google-indexing';
   ```
3. 检查错误日志：
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
   ```

### 问题 4: 文章提交失败

**原因**: URL 格式错误或网站无法访问

**解决方案**:
1. 验证 `NEXT_PUBLIC_SITE_URL` 环境变量正确
2. 确保文章 URL 可公开访问（无需登录）
3. 检查文章 slug 是否包含特殊字符
4. 查看 `indexing_error` 字段的详细错误信息

### 问题 5: API 配额超限

**原因**: Google Indexing API 每天限制 200 次请求（免费层）

**解决方案**:
1. 减少 cron 执行频率（改为每 12 或 24 小时）
2. 限制每次提交的文章数量
3. 升级到 Google Cloud 付费计划

---

## 监控和维护

### 1. 查看索引统计

```sql
SELECT
  indexing_status,
  COUNT(*) as count
FROM articles
GROUP BY indexing_status;
```

### 2. 查看失败文章

```sql
SELECT id, title, slug, indexing_attempts, indexing_error
FROM articles
WHERE indexing_status = 'failed'
ORDER BY indexing_attempts DESC;
```

### 3. 手动重试失败文章

```sql
-- 重置单篇文章状态
UPDATE articles
SET indexing_status = 'pending',
    indexing_attempts = 0,
    indexing_error = NULL
WHERE slug = 'your-article-slug';
```

### 4. 修改 Cron 执行频率

```sql
-- 删除现有任务
SELECT cron.unschedule('submit-google-indexing');

-- 创建新任务（例如每 12 小时）
SELECT cron.schedule(
  'submit-google-indexing',
  '0 */12 * * *',  -- 每 12 小时
  $$ ... $$  -- 保持原有的 HTTP 请求代码
);
```

---

## 安全建议

1. **保护 API 凭据**:
   - 妥善保管 Google Service Account 密钥
   - 不要将 private key 提交到版本控制
   - 定期轮换 Service Account

2. **CRON_SECRET（可选）**:
   - Supabase cron 是内部调用，通常不需要额外认证
   - 如果需要额外保护，可以设置 CRON_SECRET
   - 使用强随机字符串: `openssl rand -base64 32`

3. **限制 Service Account 权限**:
   - 仅在必要的 Google Cloud 项目中使用
   - 定期审查权限

4. **监控 API 使用**:
   - 在 Google Cloud Console > APIs & Services > Dashboard 查看配额使用情况
   - 设置配额告警

5. **日志记录**:
   - 定期检查 Supabase cron 执行日志
   - 监控失败率和错误模式

---

## 相关资源

- [Google Indexing API 官方文档](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
- [Supabase pg_cron 文档](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Google Search Console](https://search.google.com/search-console)

---

## 更新日志

- **2025-11-03**: 初始版本，支持 Supabase cron + Google Indexing API 集成
