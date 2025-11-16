# Standard Ads Workflow - Prompt Documentation

**Last Updated:** 2025-01-16
**Version:** 2.0 (Dual-Mode Support)

## Overview

Standard Ads workflow支持两种不同的广告生成模式：

1. **传统AI自主生成模式** - 深度分析产品照片，生成原创广告创意
2. **竞品引用模式** - 分析竞品广告结构，将创意应用于自己的产品

---

## 工作模式

### 模式1: 传统AI自主生成 (Traditional Auto-Generation Mode)

**触发条件**: 用户未选择竞品广告

**工作流程**:
```
产品照片 → AI深度分析 → 生成产品描述 → 生成视频prompt → 生成封面 → 生成视频
```

**核心特点**:
- AI对产品照片进行深度分析
- 提取产品特征、颜色、材质、设计等视觉元素
- 推断产品类别和使用场景
- 结合品牌信息和用户需求生成原创创意
- 完全自由的创意方向

**Prompt重点**:
- 分析产品外观和视觉特征
- 推断潜在使用场景
- 基于产品美学选择场景设置
- 创造性地生成广告脚本
- 考虑品牌身份和用户指定的要求

---

### 模式2: 竞品引用模式 (Competitor Reference Mode)

**触发条件**: 用户选择了竞品广告（图片或视频）

**工作流程**:
```
竞品视频/图片 → AI分析竞品结构 → 生成视频prompt → 结合产品照片生成封面 → 生成视频
```

**核心特点**:
- AI主要分析竞品广告的创意结构
- 产品照片仅作为"替换素材"的视觉参考
- 克隆竞品的脚本、镜头语言、视觉风格
- 保持竞品的叙事结构和节奏
- 产品替换而非创意创新

**Prompt重点**:
- 完整提取竞品视频的脚本和叙事结构
- 分析第一帧画面的构图（用于封面生成）
- 记录镜头运动和转场效果
- 捕捉色彩风格和视觉美学
- 将竞品的所有创意元素应用于我们的产品

---

## 详细Prompt模板

### 传统模式Prompt (generateImageBasedPrompts)

```
🤖 TRADITIONAL AUTO-GENERATION MODE

Analyze the product image and generate ONE creative video advertisement prompt.

[Product & Brand Context - if available]
Product Details: {product_details}
Brand: {brand_name}
Brand Slogan: {brand_slogan}
Brand Details: {brand_details}

[User Requirements - if provided]
{userRequirements}

Focus on:
- Visual elements in the product image (appearance, colors, textures, design)
- Product category and potential use cases you can infer from the visuals
- Emotional appeal based on visual presentation
- Natural scene settings that match the product aesthetics
- Product details and brand identity
- User-specified requirements and creative direction

[Segment Plan Requirements - if segmented video]
- Output EXACTLY {segmentCount} segment objects
- Each segment needs its own "segment_title" and "segment_goal"
- "first_frame_prompt" for opening still image
- "closing_frame_prompt" for ending still image
- Keep style, camera, lighting consistent across segments
- Define one narrator voice for continuity

DO NOT include:
- Brand names or slogans (unless visually present in the image)
- Marketing copy or taglines
- Pre-existing brand positioning or assumptions

Generate a JSON object with these elements:
- description: Main scene description based on product visuals and user requirements
- setting: Natural environment that suits the product
- camera_type: Cinematic shot type that showcases the product best
- camera_movement: Dynamic camera movement
- action: Engaging product demonstration or lifestyle scene
- lighting: Professional lighting setup that enhances the product
- dialogue: Natural voiceover content focused on product benefits (in English, NO brand slogans)
- music: Music style matching the mood and product category
- ending: Natural ad conclusion (e.g., product close-up, lifestyle shot)
- other_details: Creative visual elements that enhance the advertisement
- language: The language name for voiceover generation (e.g., "English", "Urdu")

CRITICAL: Return EXACTLY ONE advertisement prompt object, NOT an array of objects.
IMPORTANT: All text content (dialogue, descriptions, etc.) should be written in English.
IMPORTANT: The dialogue should be naturally creative and product-focused, NOT a brand slogan.
```

---

### 竞品引用模式Prompt (generateImageBasedPrompts)

```
🎯 COMPETITOR REFERENCE MODE

You are analyzing a competitor advertisement to create a similar ad for OUR product.

📺 COMPETITOR AD ({file_type}):
From: "{competitor_name}"

TASK: Analyze the competitor {file_type} and extract its complete creative structure:

1. **Complete Video Script Analysis**:
   - Extract all dialogue, voiceover, and text content
   - Document the narrative flow and storytelling structure
   - Note pacing, transitions, and segment timing

2. **Visual Structure Analysis**:
   - First frame composition and visual elements
   - Camera angles, movements, and shot types throughout
   - Scene transitions and progression
   - Color palette, lighting style, and visual aesthetics

3. **Technical Specifications**:
   - Camera movements (pan, zoom, tracking, etc.)
   - Lighting setup and mood
   - Music style and emotional tone
   - Overall production quality and style

📸 OUR PRODUCT:
The second image shows our product that should REPLACE the competitor's product in the advertisement.

🎬 GENERATION REQUIREMENTS:
Generate a JSON advertisement prompt that:
- **CLONES the competitor's complete creative structure** (script, timing, camera work, style)
- **REPLACES the competitor's product with ours** from the product image
- **MAINTAINS identical narrative flow** and storytelling approach
- **PRESERVES the visual style** (colors, lighting, aesthetics)
- **KEEPS the same tone and pacing** for equivalent engagement

⚠️ CRITICAL:
- DO NOT analyze the product image deeply - it's only for visual reference to replace the competitor's product
- Focus on extracting and replicating the competitor's creative approach
- The output should feel like the same ad, just with our product instead

[Product & Brand Context - if available]
(Use only to ensure product placement accuracy)

[User Requirements - if provided]
Note: Apply these requirements while maintaining the competitor's core creative structure.

[Segment Plan Requirements - if segmented video]
[Same as Traditional Mode]

DO NOT include:
- Brand names or slogans (unless visually present in the image)
- Marketing copy or taglines
- Pre-existing brand positioning or assumptions

Generate a JSON object with these elements:
- description: Main scene description based on competitor structure, with our product
- setting: Environment matching competitor ad style
- camera_type: Shot type matching competitor ad
- camera_movement: Camera movement from competitor ad
- action: Action sequence based on competitor structure, with our product
- lighting: Lighting style from competitor ad
- dialogue: Voiceover content adapted from competitor script, for our product (in English)
- music: Music style matching competitor ad
- ending: Conclusion style from competitor ad, with our product
- other_details: Creative elements from competitor ad applied to our product
- language: The language name for voiceover generation

CRITICAL: Return EXACTLY ONE advertisement prompt object, NOT an array of objects.
IMPORTANT: All text content (dialogue, descriptions, etc.) should be written in English.
IMPORTANT: The dialogue should be naturally creative and product-focused, NOT a brand slogan.
```

---

## JSON输出格式

两种模式都使用相同的JSON schema，确保后续workflow步骤（封面生成、视频生成）无需修改。

### 单段视频 (8-10秒)

```json
{
  "description": "Main scene description",
  "setting": "Location/environment",
  "camera_type": "Type of camera shot",
  "camera_movement": "Camera movement style",
  "action": "What happens in the scene",
  "lighting": "Lighting setup",
  "dialogue": "Spoken content/voiceover",
  "music": "Music style",
  "ending": "How the ad concludes",
  "other_details": "Additional creative elements",
  "language": "English"
}
```

### 多段视频 (16/24/32秒)

```json
{
  "description": "Overall ad description",
  "setting": "...",
  "camera_type": "...",
  "camera_movement": "...",
  "action": "...",
  "lighting": "...",
  "dialogue": "...",
  "music": "...",
  "ending": "...",
  "other_details": "...",
  "language": "English",
  "segments": [
    {
      "description": "...",
      "setting": "...",
      "camera_type": "...",
      "camera_movement": "...",
      "action": "...",
      "lighting": "...",
      "dialogue": "...",
      "music": "...",
      "ending": "...",
      "other_details": "...",
      "segment_title": "Segment 1 title",
      "segment_goal": "What this segment achieves",
      "first_frame_prompt": "Opening still image description",
      "closing_frame_prompt": "Ending still image description",
      "voice_type": "Narrator accent + gender",
      "voice_tone": "Mood/energy"
    },
    // ... 更多segments
  ]
}
```

---

## 关键差异总结

| 方面 | 传统模式 | 竞品引用模式 |
|-----|---------|------------|
| **产品照片作用** | 深度分析，提取特征和卖点 | 仅作为视觉参考，用于产品替换 |
| **创意来源** | AI原创生成 | 克隆竞品结构 |
| **分析重点** | 产品外观、类别、使用场景 | 竞品脚本、镜头、风格 |
| **prompt生成** | 基于产品特征创造 | 基于竞品结构复制 |
| **适用场景** | 希望获得原创创意 | 希望参考成功案例 |
| **用户需求** | 完全融入创意方向 | 在竞品框架内调整 |

---

## 技术实现细节

### 竞品视频处理

**视频转Base64**:
- Gemini仅支持YouTube URLs或base64格式的视频
- 使用 `fetchVideoAsBase64()` 函数下载并转换竞品视频
- 60秒超时限制
- 自动检测MIME类型（mp4/webm/mov）

**图片处理**:
- 竞品图片直接作为 `image_url` 传入
- 无需额外转换

### Prompt顺序

**竞品模式**:
1. 竞品视频/图片 (video_url 或 image_url)
2. 产品照片 (image_url)
3. 文本指令

**传统模式**:
1. 产品照片 (image_url)
2. 文本指令

---

## 版本历史

### Version 2.0 (2025-01-16)
- 实现双模式支持：传统模式 + 竞品引用模式
- 根据是否选择竞品自动切换prompt策略
- 产品照片在竞品模式下仅作为替换参考
- 竞品模式重点分析竞品视频的完整结构
- 保持相同的JSON输出格式，确保后续workflow兼容

### Version 1.0 (Initial)
- 仅支持传统AI自主生成模式
- 竞品广告作为"额外参考"而非核心分析对象
