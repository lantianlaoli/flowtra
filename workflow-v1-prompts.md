# 工作流 V1 提示词文档

## 概述
工作流 V1 是传统的单一广告生成流程，用于从单张产品图片生成一个完整的视频广告。该工作流包含三个主要步骤，每个步骤都使用特定的 AI 提示词。

## 提示词列表

### 1. 图像描述提示词 (Image Description Prompt)

**功能**: 分析上传的产品图像，生成详细的产品描述，专注于产品本身而忽略背景元素。

**位置**: `lib/workflow.ts` - `describeImage` 函数

**提示词内容**:
```
Describe the product and brand in this image in full detail. Fully ignore the background. Focus ONLY on the product.
```

**输入**:
- 产品图像 URL

**输出**:
- 产品的详细文本描述 (最多 500 tokens)

**配置参数**:
- Model: `openai/gpt-4.1-mini` (可通过环境变量配置)
- Max tokens: 500
- Temperature: 0.7

---

### 2. 创意提示词生成 (Creative Prompts Generation)

**功能**: 基于产品描述生成结构化的创意Brief，包含图像提示词、视频提示词、标题和创意总结。

**位置**: `lib/workflow.ts` - `generatePrompts` 函数

**系统提示词**:
```
You are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned image and video content for product marketing.

Task
Generate an image prompt and a video prompt (return both as part of a structured JSON output).

Provide a concise caption.

Produce a clear creative summary based on the user's reference and intent.

All video prompts must be a JSON object containing all required fields (see below). CRITICAL: The dialogue field must contain actual voiceover script or spoken narration - never use phrases like "No dialogue", "None", or leave it empty. Write compelling spoken content that a narrator would say to sell the product.

Output Requirements
Respond ONLY with the following structured JSON:

{
  "image_prompt": "...",
  "video_prompt": {
    "description": "...",
    "setting": "...",
    "camera_type": "...",
    "camera_movement": "...",
    "action": "...",
    "lighting": "...",
    "dialogue": "...",
    "music": "...",
    "ending": "...",
    "other_details": "..."
  },
  "caption": "...",
  "creative_summary": "...",
  "aspect_ratio": "...",
  "video_model": "..."
}
```

**用户提示词模板**:
```
This is the initial creative brief:
Create a compelling video advertisement with voiceover and audio

Description of the product:
${productDescription}

IMPORTANT: The video must include:
- Engaging voiceover narration or dialogue that describes the product benefits
- Background music or sound effects that enhance the mood
- Clear spoken content that explains why customers should choose this product

Make sure the 'dialogue' field contains actual spoken words, not just "No dialogue" or empty content.

Use the Think tool to double check your output
```

**输入**:
- 产品描述文本

**输出**:
结构化 JSON 对象包含:
- `image_prompt`: 封面图像生成描述
- `video_prompt`: 视频生成结构化提示词
  - `description`: 视频描述
  - `setting`: 场景设置
  - `camera_type`: 摄像机类型
  - `camera_movement`: 摄像机运动
  - `action`: 动作描述
  - `lighting`: 灯光效果
  - `dialogue`: 实际旁白脚本（必须包含实际语音内容）
  - `music`: 背景音乐描述
  - `ending`: 结尾描述
  - `other_details`: 其他细节
- `caption`: 简洁标题
- `creative_summary`: 创意总结
- `aspect_ratio`: 画面比例
- `video_model`: 推荐的视频模型

**配置参数**:
- Model: `openai/gpt-4.1-mini` (可通过环境变量配置)
- Max tokens: 1500
- Temperature: 0.8
- Response format: JSON Schema (严格模式)

**重要注意事项**:
- `dialogue` 字段必须包含实际的旁白脚本，不能为空或使用 "No dialogue"
- 所有字段都是必需的，确保 JSON 结构完整
- 输出必须严格遵循 JSON Schema 格式

---

### 3. 封面图像生成提示词 (Cover Image Generation)

**功能**: 基于原始产品图像和生成的图像提示词，创建广告封面图像。

**位置**: `lib/workflow.ts` - `generateCover` 函数

**提示词模板**:
```
Take the product in the image and place it in this scenario: ${imagePrompt}
```

**API**: KIE AI `gpt4o-image/generate`

**输入**:
- 原始产品图像 URL
- 生成的图像提示词

**输出**:
- 任务 ID (用于后续获取生成的封面图像)

**配置参数**:
- Size: "3:2" (固定比例)
- 基于原始产品图像进行场景重构

## 工作流程

1. **图像分析阶段**: 使用图像描述提示词分析上传的产品图片
2. **创意生成阶段**: 基于产品描述生成完整的创意Brief和结构化提示词
3. **视觉生成阶段**: 使用图像提示词生成封面图像，并准备视频生成
4. **后台处理**: 系统会在后台继续处理视频生成任务

## 技术实现要点

- 所有 API 调用都包含重试机制和错误处理
- 支持环境变量配置模型选择
- 包含完整的请求头和认证信息
- 使用结构化 JSON 输出确保数据一致性
- 支持进度跟踪和状态更新

## 相关文件

- 主逻辑: `lib/workflow.ts`
- 前端组件: `components/pages/GenerateAdPage.tsx`
- Hook: `hooks/useWorkflow.ts`
- API 端点: `app/api/start-workflow/route.ts`