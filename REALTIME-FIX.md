# Avatar Ads Realtime 修复方案

## 问题诊断结果

### ✅ Supabase 连接测试
所有7项测试全部通过：
- Anonymous Client ✅
- Service Role Client ✅
- Custom Fetch ✅
- REST API ✅

**结论**: Supabase 客户端配置正确，连接正常。

### ✅ API Route 测试
`/api/avatar-ads/[id]/status` 返回 **200 OK** + 完整数据

**结论**: API endpoint 工作正常。

### ❌ 根本问题：Realtime 回调缺少 Retry 逻辑

**时序问题**：
1. 项目创建后立即设置 Realtime 订阅
2. 初始 fetch (`fetchWithRetry`) 有 3 次重试
3. **但 Realtime 回调中的 fetch 没有 retry**（`components/pages/AvatarAdsPage.tsx:763`）
4. 如果 Realtime 触发时 API 暂时不可用 → fetch 失败 → UI 永远不更新

**证据**：
```javascript
// 控制台日志显示：
[Avatar Ads Realtime] Project updated: {status: generating_image}  // ✓ 触发
[Avatar Ads Realtime] Project updated: {status: awaiting_review}   // ✓ 触发

// 但缺少以下日志（说明 fetch 失败）：
🔄 [Avatar Ads Realtime] Updated project ... to status: ...  // ✗ 未显示
```

## 修复方案

### 方案 1: 在 Realtime 回调中添加 Retry（推荐）

**优点**:
- 完整的错误处理
- 确保最终一致性
- 保持现有架构

**实现**:
```typescript
// components/pages/AvatarAdsPage.tsx

// 提取公共 retry 逻辑
const fetchWithRetry = async (projectId: string, attempt = 1, maxAttempts = 3) => {
  try {
    const response = await fetch(`/api/avatar-ads/${projectId}/status`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404 && attempt < maxAttempts) {
        console.log(`⏳ [Avatar Ads Realtime] Project ${projectId} not found (attempt ${attempt}/${maxAttempts}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return fetchWithRetry(projectId, attempt + 1, maxAttempts);
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[Avatar Ads Realtime] Fetch failed for ${projectId}:`, error);
    return null;
  }
};

// 初始 fetch 使用共享函数
activeProjectIds.forEach((projectId) => {
  const initialFetch = async () => {
    const payload = await fetchWithRetry(projectId);
    if (payload && isMountedRef.current) {
      updateGenerationFromStatus(projectId, payload);
      console.log(`✅ [Avatar Ads Realtime] Initial fetch for project ${projectId}:`, payload.project.status);
    }
  };
  initialFetch();

  // Realtime 订阅也使用共享函数
  const channel = supabase
    .channel(`avatar-ads-project-${projectId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'avatar_ads_projects',
      filter: `id=eq.${projectId}`,
    }, async (payload) => {
      console.log('[Avatar Ads Realtime] Project updated:', projectId, payload.new);

      // 使用带 retry 的 fetch
      const fullPayload = await fetchWithRetry(projectId);
      if (fullPayload && isMountedRef.current) {
        updateGenerationFromStatus(projectId, fullPayload);
        console.log(`🔄 [Avatar Ads Realtime] Updated project ${projectId} to status: ${fullPayload.project.status} (${fullPayload.project.progress_percentage}%)`);
      }
    })
    .subscribe(...);
});
```

### 方案 2: 直接使用 Realtime Payload（更简单）

**优点**:
- 无需额外 API 调用
- 更快的 UI 更新
- 减少服务器负载

**限制**:
- Realtime payload 可能不包含所有字段
- 需要确保 payload 包含 UI 所需的所有数据

**实现**:
```typescript
const channel = supabase
  .channel(`avatar-ads-project-${projectId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'avatar_ads_projects',
    filter: `id=eq.${projectId}`,
  }, async (payload) => {
    console.log('[Avatar Ads Realtime] Project updated:', projectId, payload.new);

    // 直接使用 Realtime 数据更新 UI
    const project = payload.new as any;

    // 如果关键字段都在 payload 中，直接使用
    if (project.status && project.progress_percentage !== undefined) {
      const partialPayload: CharacterAdsStatusPayload = {
        success: true,
        project: {
          id: project.id,
          status: project.status,
          progress_percentage: project.progress_percentage,
          current_step: project.current_step,
          // ... 其他必需字段
        },
        stepMessages: { /* ... */ },
        isCompleted: project.status === 'completed',
        isFailed: project.status === 'failed',
        isProcessing: ['generating_prompts', 'generating_image', 'generating_videos', 'merging_videos'].includes(project.status)
      };

      if (isMountedRef.current) {
        updateGenerationFromStatus(projectId, partialPayload);
        console.log(`🔄 [Avatar Ads Realtime] Updated project ${projectId} to status: ${project.status} (${project.progress_percentage}%)`);
      }
    } else {
      // Fallback 到 API fetch（带 retry）
      const fullPayload = await fetchWithRetry(projectId);
      if (fullPayload && isMountedRef.current) {
        updateGenerationFromStatus(projectId, fullPayload);
      }
    }
  })
  .subscribe(...);
```

### 方案 3: 混合方案（最佳）

**优点**:
- 立即使用 Realtime 数据更新关键 UI
- 异步加载完整数据用于详情显示
- 最佳用户体验

**实现**:
```typescript
const channel = supabase
  .channel(`avatar-ads-project-${projectId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'avatar_ads_projects',
    filter: `id=eq.${projectId}`,
  }, async (payload) => {
    console.log('[Avatar Ads Realtime] Project updated:', projectId, payload.new);

    const project = payload.new as any;

    // 1. 立即使用部分数据更新 UI（关键状态）
    if (project.status && project.progress_percentage !== undefined) {
      const quickUpdate = {
        success: true,
        project: {
          id: project.id,
          status: project.status,
          progress_percentage: project.progress_percentage,
          current_step: project.current_step,
        },
        // ... minimal required fields
      };

      updateGenerationFromStatus(projectId, quickUpdate as any);
      console.log(`⚡ [Avatar Ads Realtime] Quick update: ${project.status} (${project.progress_percentage}%)`);
    }

    // 2. 后台加载完整数据（带 retry）
    const fullPayload = await fetchWithRetry(projectId);
    if (fullPayload && isMountedRef.current) {
      updateGenerationFromStatus(projectId, fullPayload);
      console.log(`🔄 [Avatar Ads Realtime] Full update loaded`);
    }
  })
  .subscribe(...);
```

## 推荐实施

**建议采用方案 1**（在 Realtime 回调中添加 Retry），因为：
1. 最小改动，风险低
2. 保持现有架构完整性
3. 确保数据一致性
4. 易于调试和维护

## 实施步骤

1. ✅ 提取 `fetchWithRetry` 为独立函数
2. ✅ 在初始 fetch 中使用
3. ✅ 在 Realtime 回调中使用
4. ✅ 测试时序问题是否解决
5. ✅ 验证 UI 实时更新

## 验证测试

创建新项目后检查控制台日志应显示：
```
[Avatar Ads Realtime] Setting up subscriptions for 1 projects: [...]
✅ [Avatar Ads Realtime] Subscribed to project ...
✅ [Avatar Ads Realtime] Initial fetch for project ...: generating_prompts
[Avatar Ads Realtime] Project updated: ... {status: generating_image}
⏳ [Avatar Ads Realtime] Project ... not found (attempt 1/3), retrying...  // 可能出现
✅ [Avatar Ads Realtime] Initial fetch for project ...: generating_image  // 重试成功
🔄 [Avatar Ads Realtime] Updated project ... to status: awaiting_review (60%)  // ← 关键！
```

UI 应显示：
- Status: "Awaiting Review" (不是 "Queued")
- Progress: 60% (不是 5%)
