# Google + IndexNow 多渠道索引完整指南

本指南将帮助你配置多个搜索引擎索引 API，实现自动提交文章索引请求并验证实际索引状态的完整流程。

## 架构概述

### 提交层（多 API 策略）

**Google Indexing API**
- **触发频率**: 每 6 小时（Supabase pg_cron）
- **端点**: `/api/cron/submit-indexing`
- **配额限制**: 200 次/天
- **状态**: `pending` → `submitted` (提交成功) 或 `failed` (提交失败)
- **优势**: 影响 Google Search 排名

**IndexNow API**（新增）
- **触发频率**: 每 6 小时（同上，双重提交）
- **端点**: 同上（一次请求调用两个 API）
- **配额限制**: 无限制 ✅
- **支持搜索引擎**: Bing, Yandex, Seznam, Naver 等
- **优势**: 免费无限、即时索引（几分钟到几小时）

### 验证层（URL Inspection API）
- **Supabase pg_cron**: 每天凌晨 2 点触发验证任务
- **Next.js API**: `/api/cron/verify-indexing` 接口验证实际索引状态
- **URL Inspection API**: 查询 URL 在 Google 索引中的真实状态
- **状态**: `submitted` → `verified_indexed` (已索引) 或 `verified_not_indexed` (未索引)

### 完整工作流程

```
新文章创建
    ↓
[pending] 待提交
    ↓
每 6 小时同时提交到：
  ├─ Google Indexing API (200/天配额)
  └─ IndexNow API (无限) ✅
    ↓
[submitted] 任一 API 成功即标记
    ↓ (Bing/Yandex 几分钟内索引)
    ↓ (Google 等待 3 天验证)
URL Inspection API 验证 Google 状态 (每天一次)
    ↓
[verified_indexed] ✅ Google 确认已索引
或
[verified_not_indexed] ❌ Google 确认未索引
```

**重要区别**：
- `submitted` 状态 = **至少一个 API 提交成功**
- `verified_indexed` 状态 = **Google 真正索引**（通过 URL Inspection API 确认）
- **Bing/Yandex** 通过 IndexNow 几分钟内就能索引，无需额外验证

## 数据库字段说明

- `indexed_at`: 提交请求的时间（NOT 实际索引时间）
- `indexing_status`: 当前状态（pending/submitted/failed/verified_indexed/verified_not_indexed）
- `indexing_error`: 提交或验证的错误信息
- `indexing_attempts`: 提交重试次数（最多 3 次）
- `indexing_verified_at`: 通过 URL Inspection API 验证的时间
- `actual_indexing_state`: Google 返回的实际索引状态（coverageState）

## 前置要求

- Google Cloud Console 账号（用于 Google APIs）
- Google Search Console 访问权限（网站所有者）
- Supabase 项目（已启用 pg_cron 和 pg_net 扩展）
- IndexNow API 密钥文件（已放置在 public 目录）

---

## 第一步：Google Cloud Console 配置

### 1. 创建或选择项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击顶部项目选择器
3. 创建新项目或选择现有项目（推荐为 Flowtra 创建独立项目）

### 2. 启用必要的 APIs

1. 在 Google Cloud Console 中，导航到 **APIs & Services** > **Library**
2. 搜索并启用以下两个 API：
   - **Indexing API**（用于提交索引请求）
   - **Search Console API**（用于验证索引状态）
3. 对每个 API：
   - 点击 API 名称
   - 点击 **Enable** 按钮
   - 等待启用完成

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

### 1. IndexNow API 配置（新增 - 推荐先做）

IndexNow 是一个免费且无限制的索引协议，支持 Bing、Yandex 等搜索引擎。

**步骤：**

1. **验证密钥文件已存在**

   你已经将密钥放在了 `public/8f4249852f0b4d99bfb56cb4d9b5a57c.txt`。验证文件内容：

   ```bash
   cat public/8f4249852f0b4d99bfb56cb4d9b5a57c.txt
   # 应该输出：8f4249852f0b4d99bfb56cb4d9b5a57c
   ```

2. **确保文件可以公开访问**

   部署后，访问以下 URL 应该能看到密钥：
   ```
   https://www.flowtra.store/8f4249852f0b4d99bfb56cb4d9b5a57c.txt
   ```

3. **添加环境变量**

   在 `.env` 文件中添加：
   ```bash
   INDEXNOW_API_KEY=8f4249852f0b4d99bfb56cb4d9b5a57c
   ```

**注意**：
- 密钥值、文件名和文件内容必须完全一致
- 文件必须在 public 目录，可公开访问
- 密钥应为 8-128 位十六进制字符

### 2. Google Indexing API 配置

将以下环境变量添加到 `.env` 文件（或 Vercel 环境变量设置）：

```bash
# Google Indexing API (必需)
GOOGLE_CLIENT_EMAIL=flowtra-ai-n8n-blog@flowtra.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"

# IndexNow API (必需)
INDEXNOW_API_KEY=8f4249852f0b4d99bfb56cb4d9b5a57c

# Cron Security (可选)
# 如果你想额外保护 cron 接口，可以设置此值
# 留空则不验证（Supabase cron 是内部调用，通常不需要）
CRON_SECRET=
```

**注意事项**:
- `GOOGLE_PRIVATE_KEY` 必须用双引号包裹
- 保留 `\n` 换行符（不要替换为实际换行）
- `INDEXNOW_API_KEY` 必须与 public 目录中的文件名和内容一致
- `CRON_SECRET` 是可选的，可以留空

### 3. Vercel 环境变量设置

如果部署在 Vercel：
1. 进入项目设置 > Environment Variables
2. 添加以下三个环境变量：
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `INDEXNOW_API_KEY` ✅ 新增
3. 选择 **Production**, **Preview**, **Development** 环境
4. 点击 **Save**
5. 重新部署项目使环境变量生效

**提示**: `CRON_SECRET` 可以不添加，除非你需要额外的安全保护。

---

## 第四步：运行数据库 Migrations

### 1. 应用 Migrations

确保以下 migration 文件已应用到 Supabase 数据库：

1. **基础索引字段** - `20251103000000_add_indexing_fields_to_articles.sql`
2. **验证字段和状态更新** - `20251107000000_add_url_inspection_verification.sql`
3. **验证 Cron 任务** - `20251107000001_add_verify_indexing_cron.sql`

**应用方式**：

```bash
# 方式 1: 本地开发环境（如果安装了 Supabase CLI）
pnpm supabase db push

# 方式 2: 通过 Supabase Dashboard
# 1. 进入 Supabase Dashboard > SQL Editor
# 2. 依次打开上述 migration 文件
# 3. 复制内容并执行
```

### 2. 验证字段已添加

在 Supabase Dashboard > Table Editor > articles 表，检查以下字段：

**基础字段**：
- `indexed_at` (timestamptz) - 提交时间
- `indexing_status` (text) - 状态
- `indexing_error` (text) - 错误信息
- `indexing_attempts` (integer) - 重试次数

**验证字段**（新增）：
- `indexing_verified_at` (timestamptz) - 验证时间
- `actual_indexing_state` (text) - 实际索引状态

### 3. 验证约束已更新

运行以下 SQL 检查状态约束：

```sql
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'articles' AND con.conname = 'articles_indexing_status_check';
```

应该看到约束包含新的状态值：`pending`, `submitted`, `failed`, `verified_indexed`, `verified_not_indexed`

---

## 第五步：配置 Supabase Cron Jobs

### 1. 启用必要的扩展

在 Supabase Dashboard > SQL Editor 中执行：

```sql
-- 启用 pg_cron 扩展（定时任务）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 启用 pg_net 扩展（HTTP 请求）
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. 创建提交 Cron Job（每 6 小时）

在 Supabase Dashboard > SQL Editor 中执行：

```sql
-- 创建每 6 小时执行一次的提交任务
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

### 3. 创建验证 Cron Job（每天一次）

在 Supabase Dashboard > SQL Editor 中执行：

```sql
-- 创建每天凌晨 2 点执行的验证任务
SELECT cron.schedule(
  'verify-indexing-status',           -- 任务名称
  '0 2 * * *',                        -- Cron 表达式：每天 2:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://www.flowtra.store/api/cron/verify-indexing',
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
- 验证任务在凌晨 2 点执行，避开高峰期
- CRON_SECRET 是可选的，Supabase cron 是内部调用，通常不需要额外认证

### 4. 验证 Cron Jobs 已创建

```sql
-- 查看所有 cron 任务
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- 应该能看到两个任务：
-- 1. submit-google-indexing (每 6 小时)
-- 2. verify-indexing-status (每天一次)
```

### 5. 查看 Cron Job 执行日志

```sql
-- 查看提交任务的执行记录
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'submit-google-indexing')
ORDER BY start_time DESC
LIMIT 10;

-- 查看验证任务的执行记录
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'verify-indexing-status')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 第六步：测试配置

### 1. 测试提交端点

使用 curl 或 Postman 手动触发提交 API：

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

### 2. 检查提交响应

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

### 3. 验证数据库更新（提交）

在 Supabase Dashboard 查询：

```sql
SELECT id, title, slug, indexing_status, indexed_at, indexing_attempts, indexing_error
FROM articles
ORDER BY created_at DESC
LIMIT 10;
```

检查 `indexing_status` 是否已更新为 `submitted` 或 `failed`。

**重要**：`submitted` 状态只表示提交成功，并非已索引！需要等待验证任务确认。

### 4. 测试验证端点（可选）

等待 3 天后，或手动触发验证任务：

```bash
curl -X POST https://www.flowtra.store/api/cron/verify-indexing \
  -H "Content-Type: application/json"
```

### 5. 检查验证响应

成功响应示例：

```json
{
  "success": true,
  "message": "Verified 10 articles: 8 indexed, 2 not indexed, 0 failed",
  "stats": {
    "total": 10,
    "indexed": 8,
    "notIndexed": 2,
    "failed": 0,
    "duration": 6540
  },
  "results": [
    {
      "slug": "article-1",
      "url": "https://www.flowtra.store/blog/article-1",
      "status": "indexed",
      "verdict": "PASS",
      "lastCrawlTime": "2025-11-07T10:30:00Z"
    },
    ...
  ]
}
```

### 6. 验证数据库更新（验证）

```sql
SELECT
  id,
  title,
  slug,
  indexing_status,
  indexed_at,
  indexing_verified_at,
  actual_indexing_state
FROM articles
WHERE indexing_status IN ('verified_indexed', 'verified_not_indexed')
ORDER BY indexing_verified_at DESC
LIMIT 10;
```

检查 `indexing_status` 是否更新为 `verified_indexed` 或 `verified_not_indexed`。

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
-- 整体状态分布
SELECT
  indexing_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM articles
GROUP BY indexing_status
ORDER BY count DESC;

-- 预期结果：
-- pending (待提交)
-- submitted (已提交，待验证)
-- failed (提交失败)
-- verified_indexed (已确认索引) ✅
-- verified_not_indexed (已确认未索引)
```

### 2. 查看验证效果

```sql
-- 提交到实际索引的转化率
SELECT
  COUNT(*) FILTER (WHERE indexing_status = 'verified_indexed') as indexed_count,
  COUNT(*) FILTER (WHERE indexing_status IN ('verified_indexed', 'verified_not_indexed')) as total_verified,
  ROUND(
    COUNT(*) FILTER (WHERE indexing_status = 'verified_indexed') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE indexing_status IN ('verified_indexed', 'verified_not_indexed')), 0),
    2
  ) as success_rate_pct
FROM articles;

-- 提交到索引的平均时间
SELECT
  AVG(EXTRACT(EPOCH FROM (indexing_verified_at - indexed_at)) / 86400) as avg_days,
  MIN(EXTRACT(EPOCH FROM (indexing_verified_at - indexed_at)) / 86400) as min_days,
  MAX(EXTRACT(EPOCH FROM (indexing_verified_at - indexed_at)) / 86400) as max_days
FROM articles
WHERE indexing_status = 'verified_indexed';
```

### 3. 查看失败文章

```sql
-- 提交失败的文章
SELECT id, title, slug, indexing_attempts, indexing_error
FROM articles
WHERE indexing_status = 'failed'
ORDER BY indexing_attempts DESC;

-- 未被索引的文章（已验证）
SELECT
  id,
  title,
  slug,
  indexed_at,
  indexing_verified_at,
  actual_indexing_state
FROM articles
WHERE indexing_status = 'verified_not_indexed'
ORDER BY indexing_verified_at DESC;
```

### 4. 查看待验证文章

```sql
-- 已提交但尚未验证的文章
SELECT
  id,
  title,
  slug,
  indexed_at,
  EXTRACT(DAY FROM NOW() - indexed_at) as days_since_submission
FROM articles
WHERE indexing_status = 'submitted'
  AND indexing_verified_at IS NULL
ORDER BY indexed_at ASC;
```

### 5. 手动重试失败文章

```sql
-- 重置单篇文章状态
UPDATE articles
SET indexing_status = 'pending',
    indexing_attempts = 0,
    indexing_error = NULL
WHERE slug = 'your-article-slug';

-- 批量重置所有失败文章（谨慎使用）
UPDATE articles
SET indexing_status = 'pending',
    indexing_attempts = 0,
    indexing_error = NULL
WHERE indexing_status = 'failed';
```

### 6. 修改 Cron 执行频率

```sql
-- 删除现有提交任务
SELECT cron.unschedule('submit-google-indexing');

-- 创建新任务（例如每 12 小时）
SELECT cron.schedule(
  'submit-google-indexing',
  '0 */12 * * *',  -- 每 12 小时
  $$
  SELECT net.http_post(
    url := 'https://www.flowtra.store/api/cron/submit-indexing',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- 删除验证任务
SELECT cron.unschedule('verify-indexing-status');

-- 重新创建（如需修改时间）
-- ... 参考第五步
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

**Google APIs:**
- [Google Indexing API 官方文档](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
- [Google Search Console API 官方文档](https://developers.google.com/webmaster-tools/search-console-api-original)
- [URL Inspection API 文档](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- [Google Search Console](https://search.google.com/search-console)

**IndexNow:**
- [IndexNow 官方网站](https://www.indexnow.org/)
- [IndexNow API 文档](https://www.indexnow.org/documentation)
- [IndexNow FAQ](https://www.indexnow.org/faq)
- [支持的搜索引擎列表](https://www.indexnow.org/index)

**Supabase:**
- [Supabase pg_cron 文档](https://supabase.com/docs/guides/database/extensions/pg_cron)

---

## 更新日志

- **2025-11-07**:
  - **新增 IndexNow API 集成** ✨
    - 添加 Bing/Yandex 即时索引支持
    - 免费无限制配额
    - 双重提交策略（Google + IndexNow）
    - 新增 `lib/indexnow.ts` 模块
    - 更新 `submit-indexing` 端点同时调用两个 API
  - 添加 URL Inspection API 验证层
  - 新增 `verify-indexing` 端点和 cron 任务
  - 更新状态命名：`success` → `submitted`
  - 添加验证字段：`indexing_verified_at`, `actual_indexing_state`
  - 完善监控查询和文档
- **2025-11-03**: 初始版本，支持 Supabase cron + Google Indexing API 集成
