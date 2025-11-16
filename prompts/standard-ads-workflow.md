# Standard Ads Workflow - Prompt Documentation

**Last Updated:** 2025-01-16
**Version:** 2.3 (Video-Image Separation Strategy)

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

### Version 2.3: Video-Image Separation Strategy

**核心原则**: 视频prompt可以包含儿童/婴儿，但图片生成必须转换为纯产品展示

**为什么需要分离策略？**
- **业务需求**: 销售婴儿玩具的视频广告必须展示婴儿与产品互动，否则广告无意义
- **技术限制**: Google Veo3检查的是**输入图片**而非视频prompt，只要图片不含儿童即可通过
- **解决方案**: AI生成完整prompt（含儿童）→ 视频使用完整prompt → 图片智能转换为产品展示

### 1. AI Prompt生成阶段 (无限制)

**适用范围**: `generateImageBasedPrompts()`函数

**Version 2.3变更**:
- ❌ 移除Version 2.2的所有AI生成限制
- ✅ AI可以自由生成包含儿童/婴儿的广告脚本
- ✅ 适用于传统模式和竞品引用模式

**原因**:
- 婴儿玩具广告需要展示婴儿与产品互动
- 儿童服装广告需要展示儿童穿着效果
- 视频生成不受儿童内容限制（只要图片合规）

**示例prompt输出**:
```json
{
  "action": "A baby sits on a playmat and begins to open a cardboard box...",
  "first_frame_prompt": "A medium shot of a cute baby sitting on a patterned playmat...",
  "dialogue": "Watch your little one discover the joy of learning..."
}
```

### 2. 图片生成阶段限制 (智能转换)

**适用范围**: 所有图片生成（封面、分段关键帧）

#### A. 图片转换策略

**关键实现**: `⚠️ CRITICAL IMAGE-ONLY TRANSFORMATION` 部分

**转换规则**:
```
The video prompt may describe people (children, babies, adults) interacting with the product.
For THIS IMAGE, you MUST transform any human interaction into product-focused composition:
- If prompt mentions "baby playing with toy" → Show the toy alone in an appealing display
- If prompt mentions "child wearing clothing" → Show the clothing displayed or on a mannequin
- If prompt mentions "parent demonstrating product" → Show the product with clear feature highlights
- If prompt describes human actions → Replace with product showcasing the same features
- Maintain the SCENE, LIGHTING, and STYLE from the prompt, but remove all people
- The goal: Create a visually appealing product image that conveys the same message WITHOUT human subjects
```

**应用位置**:
- `generateCover()` - 封面图生成 (lines 1004-1012)
- `createSegmentFrameTask()` - 分段关键帧生成 (lines 1298-1304)

#### B. 图片安全限制

**基础限制** (应用于所有模型和时长):
```
CRITICAL SAFETY RESTRICTION:
- DO NOT include children, minors, or anyone who appears to be under 18 years old
- DO NOT include babies, toddlers, or young people
- DO NOT include photorealistic human faces with clear, identifiable facial features
- DO NOT show close-up shots of faces or detailed facial characteristics
- If humans are necessary, only show silhouettes, blurred figures, or distant people without visible facial details
- Focus on product-only composition or depersonalized scenes
```

**Sora2额外限制** (仅Sora2/Sora2 Pro):
```
Sora2 Safety Requirements:
- Do not include photorealistic humans, faces, or bodies
- Focus entirely on the product, typography, or abstract environments without people
- Maintain a people-free composition that still feels dynamic and premium
```

### 3. 完整工作流程

```
用户上传婴儿玩具照片
        ↓
AI生成广告prompt（包含"baby playing with toy"等描述）
        ↓
    ┌─────────┴─────────┐
    ↓                   ↓
图片生成              视频生成
(转换为纯产品)      (使用完整prompt含婴儿)
    ↓                   ↓
玩具单独展示图      婴儿玩玩具视频
(Google Veo3接受)   (有意义的广告内容)
```

### 4. 技术优势

**相比Version 2.2的改进**:
- ✅ 视频内容真实有意义（婴儿玩具广告有婴儿）
- ✅ 图片符合Google Veo3政策（无儿童面孔）
- ✅ 最大化广告效果（不牺牲内容质量）
- ✅ 智能转换而非简单限制（保持场景美感）

**实际效果**:
- 视频: "一个婴儿坐在游戏垫上打开礼物盒，露出惊喜的表情..."
- 封面: 相同场景的游戏垫和礼物盒，但无婴儿，光线和构图保持一致
- 结果: Google Veo3接受封面图，生成有婴儿的视频内容

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

### Version 2.3 (2025-01-16)
- **重大战略调整**：从多层防御转向视频-图片分离策略
- **核心变更**：AI可以生成包含儿童的prompt，但图片生成会智能转换为纯产品展示
- **问题解决**：Version 2.2完全阻止儿童内容导致婴儿玩具广告无意义
- **技术实现**：
  - 移除AI prompt生成阶段的所有限制（恢复自由生成）
  - 在图片生成阶段添加"CRITICAL IMAGE-ONLY TRANSFORMATION"转换指令
  - 指示KIE API将人物互动转换为纯产品构图
- **应用场景**：
  - 婴儿玩具：视频有婴儿玩耍，封面仅展示玩具
  - 儿童服装：视频有儿童穿着，封面展示服装单品或模特
  - 母婴用品：视频有父母演示，封面聚焦产品特写
- **技术优势**：
  - 保持视频内容的真实性和吸引力
  - 确保图片符合Google Veo3内容政策
  - 智能转换而非生硬限制，保持视觉美感
- **文件修改**：
  - `lib/standard-ads-workflow.ts` - generateImageBasedPrompts()移除限制
  - `lib/standard-ads-workflow.ts` - generateCover()添加转换指令
  - `lib/standard-ads-workflow.ts` - createSegmentFrameTask()添加转换指令

### Version 2.2 (2025-01-16) [已废弃 - 策略错误]
- **错误实现**：在AI prompt生成阶段添加完整安全限制（第一道防线）
- 问题发现：Version 2.1只在图片生成阶段添加限制，但AI仍然生成包含婴儿的描述
- 错误解决方案：在`generateImageBasedPrompts()`函数中明确禁止生成包含儿童/婴儿的内容
- 适用于两种模式：
  - 传统模式：禁止在所有字段中使用"baby", "child", "kid"等词汇
  - 竞品引用模式：如果竞品包含儿童，必须替换为成人或纯产品场景
- **致命缺陷**：此方法导致婴儿玩具广告完全无法展示婴儿，违背产品营销本质
- **废弃原因**：用户反馈"用户就是卖儿童玩具的，整个视频都没有儿童呀"
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
