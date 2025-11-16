# Standard Ads Workflow - Prompt Documentation

**Last Updated:** 2025-01-16
**Version:** 2.2 (Multi-Layer Safety Defense)

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

## 安全限制 (Safety Restrictions)

### 1. AI Prompt生成阶段限制

**适用范围**: AI生成广告脚本和描述时（`generateImageBasedPrompts`函数），适用于两种模式

**传统模式和竞品引用模式共享的安全规则**:
```
🚫 CRITICAL CONTENT SAFETY RESTRICTIONS:
- DO NOT include children, minors, babies, toddlers, or anyone under 18 years old in ANY part of the advertisement
- DO NOT describe scenes with children or young people in the description, action, dialogue, or any other field
- DO NOT use words like "baby", "child", "kid", "toddler", "infant", "minor", "young people", "teen", "teenager" in any content
- If the product is designed for children (toys, baby products, etc.), show ONLY the product itself or adults demonstrating it
- Focus on product-only compositions, abstract scenes, or adult models only
- This restriction applies to ALL generated content including: description, setting, action, dialogue, first_frame_prompt, closing_frame_prompt, segment descriptions, and all other fields
```

**竞品引用模式额外规则**:
```
- If the competitor ad contains children, REPLACE them with adults or product-only scenes
```

**说明**:
- 这是**第一道防线**，在AI生成prompt阶段就阻止儿童/婴儿内容
- 即使产品是婴儿玩具，AI也必须生成纯产品展示或成人演示的场景
- 竞品引用模式：如果竞品广告包含儿童，必须替换为成人或纯产品场景

### 2. 图片生成阶段限制

**适用范围**: 所有图片生成（封面、分段关键帧），无论选择的视频时长或模型

**图片生成安全规则** (应用于所有duration和所有视频模型):
```
CRITICAL SAFETY RESTRICTION:
- DO NOT include children, minors, or anyone who appears to be under 18 years old
- DO NOT include babies, toddlers, or young people
- DO NOT include photorealistic human faces with clear, identifiable facial features
- DO NOT show close-up shots of faces or detailed facial characteristics
- If humans are necessary, only show silhouettes, blurred figures, or distant people without visible facial details
- Focus on product-only composition or depersonalized scenes
```

**Sora2额外限制** (仅当选择Sora2或Sora2 Pro视频模型时):
```
Sora2 Safety Requirements:
- Do not include photorealistic humans, faces, or bodies
- Focus entirely on the product, typography, or abstract environments without people
- Maintain a people-free composition that still feels dynamic and premium
```

**说明**:
- 这是**第二道防线**，在图片实际生成时再次强调安全限制
- 基础限制适用于所有模型，确保不出现儿童和清晰人脸特写
- Sora2模型有更严格的限制，完全禁止真实人类
- 封面生成 (`generateCover`) 和分段帧生成 (`createSegmentFrameTask`) 都遵循相同规则
- 无论视频时长（8s/10s/16s/24s/32s），所有生成的图片都应用此限制

### 3. 多层防御策略

**为什么需要两层限制？**

1. **AI Prompt生成阶段** (第一道防线):
   - 阻止AI在描述和脚本中包含儿童/婴儿
   - 确保生成的JSON prompt本身就是政策合规的
   - 适用于所有下游使用此prompt的操作

2. **图片生成阶段** (第二道防线):
   - 即使prompt通过了第一道防线，图片生成时再次强调限制
   - 防止KIE图片生成API误解prompt
   - 最终确保生成的图片符合Google Veo3的内容策略

**实际效果**:
- Google Veo3视频生成会拒绝包含未成年人的内容
- 两层防御确保在视频生成之前就已经完全排除了此类内容
- 降低因内容策略违规导致的生成失败率

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

### Version 2.2 (2025-01-16)
- **关键修复**：在AI prompt生成阶段添加完整安全限制（第一道防线）
- 问题发现：Version 2.1只在图片生成阶段添加限制，但AI仍然生成包含婴儿的描述
- 解决方案：在`generateImageBasedPrompts()`函数中明确禁止生成包含儿童/婴儿的内容
- 适用于两种模式：
  - 传统模式：禁止在所有字段中使用"baby", "child", "kid"等词汇
  - 竞品引用模式：如果竞品包含儿童，必须替换为成人或纯产品场景
- 多层防御策略：
  - 第一道防线：AI生成prompt时就排除儿童内容
  - 第二道防线：图片生成时再次强调限制
- 改进OpenRouter API错误处理，增加详细日志

### Version 2.1 (2025-01-16)
- 增强安全限制，禁止所有图片生成中出现真实人脸特写
- 适用于所有视频时长（8s/10s/16s/24s/32s）和所有视频模型
- 更新 `generateCover()` 和 `createSegmentFrameTask()` 安全提示
- 保留Sora2的额外严格限制（完全禁止真实人类）
- 允许模糊人影、剪影或远景人物，但不能有清晰面部特征

### Version 2.0 (2025-01-16)
- 实现双模式支持：传统模式 + 竞品引用模式
- 根据是否选择竞品自动切换prompt策略
- 产品照片在竞品模式下仅作为替换参考
- 竞品模式重点分析竞品视频的完整结构
- 保持相同的JSON输出格式，确保后续workflow兼容

### Version 1.0 (Initial)
- 仅支持传统AI自主生成模式
- 竞品广告作为"额外参考"而非核心分析对象
