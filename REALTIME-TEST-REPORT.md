# Avatar Ads Realtime 功能测试报告

**测试日期**: 2025-12-26
**测试项目**: Avatar Ads 页面 Realtime 数据同步与 UI 渲染

## 测试结果总结

### ✅ Realtime 订阅正常
- Supabase Realtime 成功监听 `avatar_ads_projects` 表的变化
- 控制台显示 `[Avatar Ads Realtime] Project updated` 事件正常触发
- Realtime 推送延迟 < 1秒（符合事件驱动架构预期）

### ❌ API 端点查询失败
- **问题**: `/api/avatar-ads/[id]/status` 返回 404 错误
- **根本原因**: Supabase 客户端在 API route 中调用数据库时抛出 `TypeError: fetch failed`
- **影响**: Realtime 接收到更新后无法获取完整项目数据，导致 UI 无法更新

###  UI 数据不一致
- **数据库实际值**: `status="awaiting_review"`, `progress_percentage=60`
- **UI 显示值**: `status="Queued"`, `progress=5%`
- **原因**: `updateGenerationFromStatus()` 未接收到正确的 payload

## 测试详情

### 测试步骤
1. 访问 `http://localhost:3000/dashboard/avatar-ads`
2. 创建新的 Avatar Ads 项目（选择默认男性角色）
3. 项目 ID: `b8f5a198-e950-46ef-8239-eb0acf23e472`
4. 观察控制台日志和 UI 变化

### Realtime 事件日志

```
[Avatar Ads Realtime] Setting up subscriptions for 1 projects: [b8f5a198-e950-46ef-8239-eb0acf23e472]
✅ [Avatar Ads Realtime] Subscribed to project b8f5a198-e950-46ef-8239-eb0acf23e472
⏳ [Avatar Ads Realtime] Project b8f5a198-e950-46ef-8239-eb0acf23e472 not found (attempt 1/3), retrying...
[Avatar Ads Realtime] Project updated: b8f5a198-e950-46ef-8239-eb0acf23e472 {status: generating_image, ...}
[Avatar Ads Realtime] Project updated: b8f5a198-e950-46ef-8239-eb0acf23e472 {status: awaiting_review, ...}
```

### API 错误日志

```
Failed to load resource: the server responded with a status of 404 (Not Found)
@ http://localhost:3000/api/avatar-ads/b8f5a198-e950-46ef-8239-eb0acf23e472/status

Error Details:
{
  "error": "Project not found",
  "details": {
    "message": "TypeError: fetch failed",
    "details": "TypeError: fetch failed\n    at node:internal/deps/undici/undici:15845:13"
  }
}
```

### 数据库查询结果（直接通过 Supabase MCP）

```sql
SELECT id, status, current_step, progress_percentage
FROM avatar_ads_projects
WHERE id = 'b8f5a198-e950-46ef-8239-eb0acf23e472';

-- 结果：
{
  "id": "b8f5a198-e950-46ef-8239-eb0acf23e472",
  "status": "awaiting_review",
  "current_step": "reviewing",
  "progress_percentage": 60
}
```

## 问题分析

### 1. API Route Supabase 客户端问题

**文件**: `app/api/avatar-ads/[id]/status/route.ts`

**当前实现**:
```typescript
const supabase = getSupabaseAdmin();
const { data: project, error } = await supabase
  .from('avatar_ads_projects')
  .select('*')
  .eq('id', id)
  .single();
```

**问题**:
- `getSupabaseAdmin()` 使用 `@supabase/supabase-js` 的 `createClient`
- Next.js App Router 推荐使用 `@supabase/ssr` 包
- 当前环境变量 `SUPABASE_SECRET_KEY` 格式正确（`sb_secret_` 前缀是新版本格式）

### 2. Supabase 客户端配置

**文件**: `lib/supabase.ts`

**当前配置**:
```typescript
export function getSupabaseAdmin(): SupabaseClient {
  if (serviceClient) return serviceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role configuration is missing')
  }

  serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return serviceClient
}
```

**可能的问题**:
- `createClient` 在 API route 中可能无法正确处理 fetch（Next.js 特定问题）
- 缺少 `global.fetch` 配置或自定义 fetch 实现

## 修复建议

### 方案 1: 使用 @supabase/ssr（推荐）

1. 安装 `@supabase/ssr` 包：
```bash
pnpm add @supabase/ssr
```

2. 创建服务端客户端工具：
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

3. 更新 API route：
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  // ... 其余代码不变
}
```

### 方案 2: 调试当前实现

1. 添加详细日志到 `lib/supabase.ts`：
```typescript
export function getSupabaseAdmin(): SupabaseClient {
  console.log('[Supabase Admin] Creating admin client');
  console.log('[Supabase Admin] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[Supabase Admin] Key exists:', !!process.env.SUPABASE_SECRET_KEY);

  // ... 其余代码
}
```

2. 检查 fetch polyfill 或全局配置

## 影响范围

### 已确认正常的功能
- ✅ Supabase Realtime 监听
- ✅ 数据库直接查询（通过 Supabase MCP）
- ✅ 项目创建（`/api/avatar-ads/create`）
- ✅ Webhook 接收（`/api/avatar-ads/webhooks/*`）

### 受影响的功能
- ❌ 项目状态查询 API (`/api/avatar-ads/[id]/status`)
- ❌ UI 进度条实时更新
- ❌ 项目详情显示

## 后续测试建议

1. 修复 API route 后重新测试 Realtime 功能
2. 验证 `updateGenerationFromStatus` 正确更新 UI
3. 测试多个并发项目的 Realtime 订阅
4. 压力测试：创建 10+ 个项目同时监听更新

## 环境信息

- **Next.js**: 16.0.10
- **@supabase/supabase-js**: ^2.50.5
- **Node**: v23+ (推断，基于错误堆栈)
- **Browser**: Chrome/Edge (基于 Playwright 测试)
