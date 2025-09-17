# 工作流 V2 提示词文档

## 概述
工作流 V2 是批量多变体广告生成流程，用于从单张产品图片生成多个不同风格的广告变体。该工作流强调创意多样性，让用户能够测试不同的创意方向。

## 提示词列表

### 1. 图像分析提示词 (Image Analysis Prompt)

**功能**: 深度分析上传的图像，判断图像类型并提取品牌信息、色彩方案等关键元素。

**位置**: `lib/workflow-v2.ts` - `describeImage` 函数

**提示词内容**:
```
Analyze the given image and determine if it primarily depicts a product or a character, or BOTH. Return the analysis in the specified JSON format.
```

**输入**:
- 图像 URL

**输出**: 结构化 JSON 包含
- `type`: 图像类型 ("product" | "character" | "both")
- `brand_name`: 品牌名称（如果可见或可推断）
- `color_scheme`: 色彩方案数组
  - `hex`: 十六进制颜色代码
  - `name`: 颜色名称
- `font_style`: 字体风格描述
- `visual_description`: 视觉描述（忽略背景）
- `outfit_style`: 服装风格描述（针对角色类型）

**配置参数**:
- Model: `openai/gpt-4.1-mini`
- Max tokens: 500
- Temperature: 0.7
- Response format: JSON Schema (严格模式)

---

### 2. 多元素生成提示词 (Multiple Elements Generation)

**功能**: 基于图像分析结果生成多套不同风格的广告元素，每套都有独特的创意角度。

**位置**: `lib/workflow-v2.ts` - `generateMultipleElements` 函数

**系统提示词模板**:
```
### A - Ask:
Create exactly ${count} different sets of ELEMENTS for the uploaded ad image.
Each set must include **all required fields** and differ in tone, mood, or creative angle.

### G - Guidance:
**role:** Creative ad concept generator
**output_count:** ${count} sets
**constraints:**
- Every set must have:
  - product
  - character
  - ad_copy
  - visual_guide
  - Primary color, Secondary color, Tertiary color
- Ensure creative DIVERSITY between the ${count} sets:
  - One can be minimal/clean, the other bold/energetic (or premium/elegant vs. playful/dynamic).
- Characters must be living subjects or humans interacting with the product, not flat packaging graphics. If the packaging already shows a mascot, invent a different real-world subject (for pet food, use a breed that differs from the packaging artwork) who is actively engaging with the product experience.
- Describe characters and visual guides from the perspective of the target customer using cues from the product, and avoid copying or tracing printed illustrations on the pack.
- If user does not specify details, apply smart defaults:
  - ad_copy → short, catchy slogan
  - visual_guide → describe placement, size, activity of character, product angle, background mood
  - colors → decide based on the ad image
- IMPORTANT: Do NOT generate text_watermark field - this will be provided separately by the user

### E - Examples:
**good_examples:**
- **Set 1:** minimal, clean, muted tones, straightforward CTA.
- **Set 2:** bold, colorful, dynamic composition, playful character usage.

### N - Notation:
**format:** structured JSON with ${count} sets clearly separated.
```

**用户提示词模板**:
```
Your task: Based on the ad image I uploaded, create exactly ${count} different sets of ELEMENTS.
```

**输入**:
- 图像 URL
- 生成数量 (count)
- 用户水印文本（可选）
- 水印位置（可选）

**输出**: 元素集合数组，每个包含
- `product`: 产品描述
- `character`: 角色描述
- `ad_copy`: 广告文案
- `visual_guide`: 视觉指导
- `primary_color`: 主色调
- `secondary_color`: 辅助色
- `tertiary_color`: 第三色调
- `text_watermark`: 文本水印（用户提供）
- `text_watermark_location`: 水印位置

**配置参数**:
- Model: `openai/gpt-4.1-mini`
- Max tokens: 1500
- Temperature: 0.8
- Response format: JSON Schema (严格模式)

**重要注意事项**:
- 确保生成的多个集合在创意风格上有明显差异
- 每个集合都必须包含所有必需字段
- 角色必须与产品产生真实互动，不能沿用包装上的平面插画或商标人物
- 系统会自动添加用户提供的水印信息

---

### 3. 最终封面提示词生成 (Final Cover Prompt Generation)

**功能**: 结合产品描述和选定的元素集合，生成最终的图像广告提示词。

**位置**: `lib/workflow-v2.ts` - `generateFinalCoverPrompt` 函数

**系统提示词**:
```
## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent

### A - Ask:
Create exactly 1 structured image ad prompt with all required fields filled.

The final prompt should be written like this:

"""
Make an image ad for this product with the following elements. The product looks exactly like what's in the reference image.

product:
character:
ad_copy:
visual_guide:
text_watermark:
text_watermark_location:
Primary color of ad:
Secondary color of ad:
Tertiary color of ad:
"""

### G - Guidance:
role: Creative ad prompt engineer
output_count: 1
constraints:
- Always include all required fields.
- Integrate the user's special request as faithfully as you can in the final image prompt.
- If user input is missing, apply smart defaults:
  - text_watermark_location → "bottom left of screen"
  - primary_color → decide based on the image provided
  - secondary_color → decide based on the image provided
  - tertiary_color → decide based on the image provided
  - font_style → decide based on the image provided
  - ad_copy → keep short, punchy, action-oriented.
  - visual_guide → If the request involves a human character, define camera angle/camera used. If no visual guide is given, describe placement/size of character, what they're doing with the product, style of the ad, main background color and text color.
- CRITICAL: The product must look exactly like what's in the reference image. Do not redraw or alter logos, text, proportions, materials, or exact colors.

### E - Examples:
good_examples:
- character: as defined by the user
- ad_copy: as defined by the user, or decide if not provided
- visual_guide: as defined by the user. If detailed, expand to accommodate while respecting the color palette.
- text_watermark: as defined by the user, leave blank if none provided
- text_watermark_location: as defined by the user, or bottom left if none provided

### N - Notation:
format: text string nested within an "image_prompt" parameter. Avoid using double-quotes or raw newlines.
example_output: |
{
  "image_prompt": "final prompt here"
}
```

**用户提示词模板**:
```
Your task: Create 1 image prompt as guided by your system guidelines.

Description of the reference image: ${productDescription}

ELEMENTS FOR THIS IMAGE:

product: ${elements.product}
character: ${elements.character}
ad_copy: ${elements.ad_copy}
visual_guide: ${elements.visual_guide}
text_watermark: ${elements.text_watermark}
text_watermark_location: ${elements.text_watermark_location}

Primary color: ${elements.primary_color}
Secondary color: ${elements.secondary_color}
Tertiary color: ${elements.tertiary_color}
```

**输入**:
- 产品描述
- 选定的广告元素集合

**输出**:
- `image_prompt`: 最终的图像生成提示词

**配置参数**:
- Model: `openai/gpt-4.1-mini`
- Max tokens: 800
- Temperature: 0.7
- Response format: JSON Schema (严格模式)

---

### 4. 封面图像生成 (Cover Image Generation with Nano-Banana)

**功能**: 使用 Google 的 nano-banana-edit 模型生成最终的广告封面图像。

**位置**: `lib/workflow-v2.ts` - `generateCoverWithNanoBanana` 函数

**API**: KIE AI `jobs/createTask`

**请求模型**: `google/nano-banana-edit`

**输入参数**:
```json
{
  "model": "google/nano-banana-edit",
  "input": {
    "prompt": "${imagePrompt}",
    "image_urls": ["${originalImageUrl}"],
    "output_format": "png",
    "image_size": "${imageSize}"
  }
}
```

**输入**:
- 原始图像 URL
- 最终图像提示词
- 图像尺寸 (默认为 'auto')

**输出**:
- 任务 ID

**支持的图像尺寸**:
- `auto`: 原生分辨率
- `1:1`: 正方形
- `3:4`: 竖屏 3:4
- `9:16`: 竖屏 9:16
- `4:3`: 横屏 4:3
- `16:9`: 横屏 16:9

---

### 5. 视频设计生成提示词 (Video Design Generation)

**功能**: 基于生成的封面图像和广告元素，创建视频生成的结构化提示词。

**位置**: `lib/workflow-v2.ts` - `generateVideoDesignFromCover` 函数

**系统提示词**:
```
Video Prompt Generator for Product Creatives
Role
You are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned video content for product marketing.

Task
Generate a video prompt and return ONLY the JSON object inside video_prompt.

Guidance
Always use the product description and creative brief as provided by the user. Include these essential details in every prompt: description, setting, camera_type, camera_movement, action, lighting, other_details, dialogue, music, ending. Scenes must be visually rich and avoid generic or vague descriptions. Adhere strictly to the brand identity and ensure the final output feels polished, cinematic, and aligned with the marketing intent.

Constraints
Respond ONLY with the JSON object of video_prompt. Do NOT include any image URLs or references to image links in the JSON.
```

**用户提示词模板**:
```
Context:
product_description: ${productDescription}
elements: ${JSON.stringify(elements)}

Use the attached image input to ground the design. Return ONLY the JSON object for video_prompt.
```

**输入**:
- 封面图像 URL
- 广告元素数据
- 产品描述（可选）

**输出**: 视频提示词对象包含
- `description`: 视频描述
- `setting`: 场景设置
- `camera_type`: 摄像机类型
- `camera_movement`: 摄像机运动
- `action`: 动作描述
- `lighting`: 灯光效果
- `other_details`: 其他细节
- `dialogue`: 对话/旁白
- `music`: 背景音乐
- `ending`: 结尾描述

**配置参数**:
- Model: `openai/gpt-4.1-mini`
- Max tokens: 1200
- Temperature: 0.7
- Response format: JSON Schema (严格模式)

## 工作流程

1. **图像分析阶段**: 深度分析图像类型、品牌信息和视觉元素
2. **多元素生成阶段**: 创建多套不同风格的广告元素组合
3. **批量处理阶段**: 为每套元素生成对应的最终封面提示词
4. **图像生成阶段**: 使用 nano-banana 模型生成封面图像
5. **视频设计阶段**: 基于封面图像生成视频提示词
6. **结果展示**: 展示多个变体供用户选择和下载

## 技术特性

- **批量生成**: 支持同时生成 1-3 个广告变体
- **创意多样性**: 确保每个变体在风格和调性上有明显差异
- **用户定制**: 支持自定义水印文本和位置
- **灵活尺寸**: 支持多种图像比例设置
- **免费生成**: 生成过程免费，仅在下载时收费
- **实时预览**: 生成完成后可预览所有变体

## 相关文件

- 主逻辑: `lib/workflow-v2.ts`
- 前端组件: `components/pages/GenerateAdPageV2.tsx`
- Hook: `hooks/useWorkflowV2.ts`
- API 端点: `app/api/v2/start/route.ts`
- 状态监控: `app/api/v2/monitor-tasks/route.ts`
- 内容下载: `app/api/v2/download-content/[instanceId]/route.ts`
