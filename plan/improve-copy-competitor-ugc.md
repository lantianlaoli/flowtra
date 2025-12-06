# Competitor UGC prompt upgrade – understanding

- 我们要把 `competitor-ugc-replication` 的提示词输出，完全标准化为 `plan/expect.json` 中的结构：每个 segment 固定 8 秒并包含 `is_continuation_from_prev`、`first_frame_description`、`shots[]`。
- `is_continuation_from_prev = true` 时，N+1 段生成首帧必须把上一段首帧图片一并传给 KIE（图生图基底），确保人物/造型/场景保持一致，而不是仅靠描述串联。
- `shots[]` 需要把 8 秒拆成多个合理的小片段（时间段、动作、音频、镜头、环境等信息齐全），方便后续编辑器逐条展示和修改。

## 新增理解（等待确认后再改代码）

### 1. KIE 视频生成流程调整
- 之前流程：`startSegmentVideoTask` 会把 segment 的高层描述拼成一段文本 prompt（描述/动作/对话等），再和首尾帧图片一起传给 KIE 做 Veo/Grok 生成。
- 目标流程：直接把 `shots[]` 原始结构传给 KIE 接口（需要确认 KIE 支持 JSON/结构化指令），让模型按照每个 shot 的时间段去生成，从而保证单段时长内的 beat 与提示完全一致；Veo3 系列默认 8 秒/Grok 默认 6 秒，其它模型按 `segment_duration_seconds` 动态决定。
- 因此需要：
  - 提示词生成阶段继续输出结构化 shots。
- KIE prompt 已支持 JSON 结构化，直接把 shots 数组按官方 schema (时间戳/动作/对话等字段) 传过去即可，不再做文本拼接。

### 2. Segment 编辑体验（前端）
- 目前编辑器只展示类似“单个 shot”的字段（action/subject/style…），无法逐条编辑 shots 列表。
- 调整后：
  - UI 中每个 segment 要渲染 `shots[]` 里的所有条目，允许用户新增/删除/重排 shot，或至少编辑每个 shot 的核心字段（时间段、动作、镜头、对话等）。
  - 保存时把整个 shots 数组写回 segment prompt 数据结构，以便 monitor/服务端重新发给 KIE。
  - SegmentInspector 需要从单表单模式改为可折叠的 shot 列表，每个 shot 有独立输入，确保与 `plan/expect.json` 对齐。

### 3. 旧流程 vs 新流程
- **旧**：segment prompt≈单一描述 → 文本 prompt → KIE；UI 只有“第一帧描述 + 通用视频字段”，无法精细编辑，也无法在 `is_continuation_from_prev` 时传入上一段首帧图。
- **新**：segment prompt 包含完整 shots 队列，每条 shot 明确时间/动作/镜头；`is_continuation_from_prev` 时把上一段首帧 URL 作为额外参考传给 KIE；UI 能逐条编辑 shots，确保生成和展示一致。

等待确认后，再改 server/workflow 与前端编辑器。
