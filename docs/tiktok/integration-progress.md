# TikTok 功能集成进度文档

本文档记录 Flowtra 应用与 TikTok 平台的完整集成进度，包括已完成功能、当前任务和未来规划。

---

## 📋 目录

1. [集成概述](#集成概述)
2. [技术架构](#技术架构)
3. [Phase 1: 账号绑定（已完成）](#phase-1-账号绑定已完成)
4. [Phase 2: 内容发布（进行中）](#phase-2-内容发布进行中)
5. [Phase 3: 高级功能（规划中）](#phase-3-高级功能规划中)
6. [功能清单](#功能清单)
7. [已知问题](#已知问题)
8. [下一步计划](#下一步计划)

---

## 集成概述

### 项目目标

将 Flowtra 的 AI 视频生成能力与 TikTok 平台深度集成，实现一键发布工作流：

```
生成 AI 视频 → 一键发布到 TikTok → 追踪发布状态 → 分析数据
```

### 集成范围

- **用户管理：** TikTok 账号绑定/解绑
- **内容发布：** 视频直接发布到 TikTok
- **状态追踪：** 实时监控发布进度
- **数据分析：**（未来）视频表现数据同步

---

## 技术架构

### 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js App Router | 15.4.4 |
| **UI 库** | TailwindCSS, Framer Motion | - |
| **后端** | Next.js API Routes | 15.4.4 |
| **数据库** | Supabase (PostgreSQL) | - |
| **文件存储** | Supabase Storage | - |
| **认证** | Clerk | - |
| **TikTok API** | TikTok API v2 | v2 |
| **语言** | TypeScript | 5.x |

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Flowtra Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   User Interface │         │   Clerk Auth     │          │
│  │  (Next.js Pages) │◄────────┤  (User Session)  │          │
│  └────────┬─────────┘         └──────────────────┘          │
│           │                                                   │
│           ▼                                                   │
│  ┌──────────────────────────────────────────────┐           │
│  │          Next.js API Routes                   │           │
│  ├──────────────────────────────────────────────┤           │
│  │  - /api/tiktok/auth/*                        │           │
│  │  - /api/tiktok/user/info                     │           │
│  │  - /api/tiktok/unbind                        │           │
│  │  - /api/tiktok/publish/init      [Phase 2]  │           │
│  │  - /api/tiktok/publish/status    [Phase 2]  │           │
│  └─────────────┬────────────────────────────────┘           │
│                │                                              │
│                ▼                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │         Supabase Database                     │           │
│  ├──────────────────────────────────────────────┤           │
│  │  - user_tiktok_connections                   │           │
│  │  - tiktok_publish_history        [Phase 2]  │           │
│  │  - competitor_ugc_replication_projects                     │           │
│  │  - avatar_ads_projects                    │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │       TikTok Platform                  │
        ├───────────────────────────────────────┤
        │  - OAuth 2.0 Authorization            │
        │  - Login Kit API                      │
        │  - Display API                        │
        │  - Content Posting API    [Phase 2]  │
        └───────────────────────────────────────┘
```

---

## Phase 1: 账号绑定（已完成）

### 实施时间
**2025-01-28** ✅ 已完成

### 功能描述

实现 TikTok Login Kit OAuth 2.0 授权流程，允许用户绑定 TikTok 账号。

### 已完成功能

#### 1. OAuth 授权流程 ✅

**实现文件：**
- `app/api/tiktok/auth/authorize/route.ts`
- `app/api/tiktok/auth/callback/route.ts`

**功能点：**
- ✅ 生成 CSRF state token 防止攻击
- ✅ 重定向到 TikTok 授权页面
- ✅ 处理授权回调
- ✅ 交换 authorization code 获取 access_token
- ✅ 获取用户基本信息（open_id, display_name, avatar_url）
- ✅ Token 加密存储（AES-256-CBC）

**请求的 Scopes:**
- `user.info.basic` - 基本用户信息
- `video.publish` - 视频发布权限

#### 2. 数据库设计 ✅

**表：** `user_tiktok_connections`

```sql
CREATE TABLE user_tiktok_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,                    -- Clerk user ID
  tiktok_open_id VARCHAR NOT NULL UNIQUE,      -- TikTok user ID
  tiktok_union_id VARCHAR,                     -- Cross-app ID
  display_name VARCHAR NOT NULL,               -- TikTok display name
  avatar_url TEXT,                             -- Profile picture URL
  access_token TEXT NOT NULL,                  -- Encrypted access token
  refresh_token TEXT NOT NULL,                 -- Encrypted refresh token
  token_expires_at TIMESTAMPTZ NOT NULL,       -- Token expiry timestamp
  scope TEXT NOT NULL,                         -- Granted scopes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Row Level Security (RLS):** 已启用，用户只能访问自己的连接

#### 3. 用户管理 UI ✅

**实现文件：**
- `components/pages/CreditsPage.tsx`（/dashboard/account）

**功能点：**
- ✅ "Connected Accounts" 区域
- ✅ TikTok 卡片显示（logo, 状态, 用户信息）
- ✅ 未绑定状态：显示 "Connect TikTok" 按钮
- ✅ 已绑定状态：显示用户名、头像、"Disconnect" 按钮
- ✅ 实时状态刷新

#### 4. API 端点 ✅

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/tiktok/auth/authorize` | GET | 发起 OAuth 授权 | ✅ |
| `/api/tiktok/auth/callback` | GET | 处理授权回调 | ✅ |
| `/api/tiktok/user/info` | GET | 获取绑定状态 | ✅ |
| `/api/tiktok/unbind` | POST | 解绑账号 | ✅ |

#### 5. 安全措施 ✅

- ✅ CSRF Protection（state token）
- ✅ Token 加密存储（AES-256-CBC）
- ✅ HttpOnly cookies
- ✅ HTTPS 强制（secure: true, sameSite: 'none'）
- ✅ Clerk middleware 公开路由配置

#### 6. 已修复问题 ✅

**问题 1：** Clerk middleware 拦截 callback
- **解决方案：** 将 `/api/tiktok/auth/callback` 添加到公开路由

**问题 2：** Cookie 跨域问题（CSRF state mismatch）
- **解决方案：** 使用 `sameSite: 'none'` 和 `secure: true`

### 相关文档

- ✅ `docs/tiktok/login-kit-guide.md` - 完整的 Login Kit 技术文档
- ✅ GitHub Commit: `68a16bb`, `f9675f7`

---

## Phase 2: 内容发布（进行中）

### 实施时间
**2025-01-28** 🔄 进行中

### 功能描述

允许用户将 Flowtra 生成的视频直接发布到 TikTok 平台。

### 实施计划

#### 1. 后端 API 开发 🔄

**任务 1：** 创建初始化发布 API

**文件：** `app/api/tiktok/publish/init/route.ts`

**功能：**
- 检查用户 TikTok 绑定状态
- 验证视频存在性和所有权
- 从 Supabase Storage 获取视频 URL
- 下载视频到服务器内存/临时文件
- 计算分块参数
- 调用 TikTok `/v2/post/publish/video/init/` API
- 执行分块上传
- 返回 `publish_id` 给前端

**请求格式：**
```typescript
POST /api/tiktok/publish/init
{
  historyId: string;
  title: string;
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
}
```

**响应格式：**
```typescript
{
  success: boolean;
  publishId?: string;
  error?: string;
}
```

---

**任务 2：** 创建状态查询 API

**文件：** `app/api/tiktok/publish/status/route.ts`

**功能：**
- 接收 `publish_id`
- 调用 TikTok `/v2/post/publish/status/fetch/` API
- 返回当前状态和 post_id（如果完成）

**请求格式：**
```typescript
GET /api/tiktok/publish/status?publishId=<publish_id>
```

**响应格式：**
```typescript
{
  success: boolean;
  status: 'PROCESSING_UPLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED';
  postId?: string;
  postUrl?: string;
  error?: string;
}
```

---

**任务 3：** 创建上传辅助函数

**文件：** `lib/tiktok-upload-helper.ts`

**功能：**
- `calculateChunks()` - 计算分块参数
- `uploadChunk()` - 上传单个分块
- `uploadVideo()` - 完整上传流程
- `pollPublishStatus()` - 轮询发布状态

---

#### 2. 前端 UI 开发 ⏳

**任务 1：** 修改视频历史页面

**文件：** `components/pages/HistoryPage.tsx`

**功能：**
- 检查 TikTok 连接状态
- 在每个视频卡片添加 "Post to TikTok" 按钮
- 按钮条件渲染：
  - 未绑定：显示 "Connect TikTok"（跳转到 /dashboard/account）
  - 已绑定 + 视频完成：显示 "Post to TikTok"
  - 发布中：显示 "Posting..." + 加载动画
- 点击触发发布对话框

---

**任务 2：** 创建发布对话框组件

**文件：** `components/TikTokPublishDialog.tsx`

**功能：**
- 视频标题输入框
- 隐私级别选择器（单选）
- 高级选项（复选框）：
  - Disable Duet
  - Disable Comment
  - Disable Stitch
- 视频预览缩略图
- 确认和取消按钮
- 实时状态显示：
  - 初始化...
  - 上传中...
  - 处理中...
  - 发布完成 ✓
  - 失败 ✗

---

**任务 3：** 实现发布流程

**流程：**
```
1. 用户点击 "Post to TikTok" 按钮
   ↓
2. 打开发布对话框
   ↓
3. 用户填写标题和选项
   ↓
4. 点击 "Post" 确认
   ↓
5. 调用 /api/tiktok/publish/init
   ↓
6. 显示上传进度
   ↓
7. 轮询 /api/tiktok/publish/status (每 5 秒)
   ↓
8. 显示最终结果（成功/失败）
   ↓
9. 关闭对话框
```

---

#### 3. 数据库扩展（可选）⏳

**表：** `tiktok_publish_history`

```sql
CREATE TABLE tiktok_publish_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  history_id UUID NOT NULL,              -- 关联到 ads projects
  tiktok_publish_id VARCHAR NOT NULL,
  tiktok_post_url TEXT,
  tiktok_post_id VARCHAR,
  status VARCHAR DEFAULT 'processing',
  title TEXT,
  privacy_level VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  FOREIGN KEY (history_id) REFERENCES competitor_ugc_replication_projects(id)
);
```

**用途：**
- 追踪发布历史
- 显示发布记录
- 数据分析

---

### 当前进度

| 任务 | 状态 | 进度 |
|------|------|------|
| **后端 API** |  |  |
| ├─ init API | ⏳ 待实施 | 0% |
| ├─ status API | ⏳ 待实施 | 0% |
| └─ 辅助函数 | ⏳ 待实施 | 0% |
| **前端 UI** |  |  |
| ├─ HistoryPage 按钮 | ⏳ 待实施 | 0% |
| ├─ 发布对话框 | ⏳ 待实施 | 0% |
| └─ 状态追踪 | ⏳ 待实施 | 0% |
| **文档** |  |  |
| ├─ API Guide | ✅ 已完成 | 100% |
| └─ Integration Progress | ✅ 已完成 | 100% |

---

## Phase 3: 高级功能（规划中）

### 计划时间
**未来规划** 📅

### 功能规划

#### 1. 批量发布 📅

**描述：** 允许用户一次性选择多个视频发布到 TikTok

**功能点：**
- 多选视频界面
- 批量配置发布参数
- 队列管理
- 进度追踪

**预估工作量：** 2-3 天

---

#### 2. 定时发布 📅

**描述：** 支持预定发布时间

**功能点：**
- 日期时间选择器
- 定时任务队列（可能使用 Vercel Cron 或外部服务）
- 发布提醒
- 取消/修改功能

**预估工作量：** 3-5 天

**技术挑战：**
- 需要持久化任务队列
- 可靠的触发机制
- 时区处理

---

#### 3. 视频数据分析 📅

**描述：** 同步 TikTok 视频表现数据到 Flowtra

**功能点：**
- 观看数、点赞数、评论数同步
- 数据可视化图表
- 趋势分析
- 导出报告

**预估工作量：** 5-7 天

**技术要求：**
- 使用 TikTok Video API
- 定期数据同步（Cron Job）
- 数据存储和索引

---

#### 4. 多账号管理 📅

**描述：** 支持绑定和管理多个 TikTok 账号

**功能点：**
- 添加/删除多个账号
- 账号切换
- 为每个账号独立发布
- 账号统计对比

**预估工作量：** 2-3 天

**数据库修改：**
- 移除 `tiktok_open_id` unique 约束
- 添加 `is_primary` 字段
- 添加账号别名

---

#### 5. 自动发布工作流 📅

**描述：** 视频生成完成后自动发布到 TikTok

**功能点：**
- 自动发布开关
- 预设发布模板
- 自动标题生成（AI）
- 发布通知

**预估工作量：** 3-4 天

---

## 功能清单

### 已实现功能 ✅

- [x] TikTok OAuth 2.0 授权
- [x] 用户账号绑定
- [x] Token 安全存储（加密）
- [x] 绑定状态管理 UI
- [x] 账号解绑功能
- [x] CSRF 攻击防护
- [x] 跨域 Cookie 处理
- [x] Clerk middleware 配置
- [x] 完整技术文档

### 开发中功能 🔄

- [ ] 视频发布初始化 API
- [ ] 分块上传实现
- [ ] 发布状态查询 API
- [ ] 发布按钮 UI
- [ ] 发布对话框组件
- [ ] 状态轮询机制

### 计划中功能 📅

- [ ] 批量发布
- [ ] 定时发布
- [ ] 数据分析同步
- [ ] 多账号管理
- [ ] 自动发布工作流
- [ ] 发布模板管理

---

## 已知问题

### 已解决 ✅

1. **Clerk Middleware 拦截回调**
   - 状态：✅ 已解决
   - 解决方案：添加 `/api/tiktok/auth/callback` 到公开路由
   - 提交：`f9675f7`

2. **Cookie 跨域无法传递（CSRF state mismatch）**
   - 状态：✅ 已解决
   - 解决方案：使用 `sameSite: 'none'` + `secure: true`
   - 提交：`f9675f7`

### 待解决 ⚠️

1. **Token 自动刷新**
   - 状态：⚠️ 未实现
   - 影响：Token 过期后需要用户手动重新授权
   - 优先级：中
   - 计划：Phase 2 或 Phase 3

2. **大文件上传性能**
   - 状态：⚠️ 待测试
   - 影响：超大视频（>500MB）上传可能不稳定
   - 优先级：低
   - 计划：Phase 3 优化

---

## 下一步计划

### 短期目标（1-2 周）

1. ✅ 完成 Phase 2 后端 API 开发
   - init 端点
   - status 端点
   - 上传辅助函数

2. ✅ 完成 Phase 2 前端 UI 开发
   - HistoryPage 集成
   - 发布对话框
   - 状态追踪

3. ✅ 测试和优化
   - 单元测试
   - 集成测试
   - 用户验收测试

### 中期目标（1 个月）

1. 📅 实现 Token 自动刷新
2. 📅 添加发布历史追踪
3. 📅 优化用户体验
4. 📅 收集用户反馈

### 长期目标（3-6 个月）

1. 📅 实现 Phase 3 高级功能
2. 📅 数据分析集成
3. 📅 多账号管理
4. 📅 自动化工作流

---

## 贡献者

- **开发团队：** Flowtra Development Team
- **主要开发者：** Claude Code Assistant
- **项目负责人：** lantianlaoli@gmail.com

---

## 更新日志

### 2025-01-28
- ✅ 完成 Phase 1（账号绑定）
- ✅ 创建集成进度文档
- ✅ 创建 Content Posting API 技术文档
- 🔄 启动 Phase 2（内容发布）

---

**最后更新：** 2025-01-28
**文档版本：** 1.0
**联系方式：** lantianlaoli@gmail.com
