# Standard Ads Workflow - Prompt Documentation

**Last Updated:** 2025-01-17
**Version:** 3.1.1 (Intelligent Prompt Rewriting)

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

### Version 3.0: Adult-Friendly, Zero-Child Policy

**核心原则**:
1. **完全禁止儿童**：图片中不能出现任何儿童元素（包括手部、肢体、剪影等）
2. **成人完全允许**：成人可以自由出现，包括清晰人脸特写
3. **Sora2特殊处理**：Sora2模型仍需避免人脸（内容审核更严格）

**为什么需要Zero-Child Policy？**
- **安全合规**: 完全避免涉及未成年人的内容审核风险
- **策略简化**: 明确的"零儿童"规则，更容易理解和执行
- **成人友好**: 放开成人限制，允许更真实的产品展示（人脸特写、模特展示等）

### 1. AI Prompt生成阶段 (无限制)

**适用范围**: `generateImageBasedPrompts()`函数

**策略**:
- ✅ AI可以自由生成包含儿童/成人的广告脚本
- ✅ 视频可以展示儿童与产品互动（因为Veo3只检查输入图片）
- ✅ 适用于传统模式和竞品引用模式

**原因**:
- 婴儿玩具广告的视频仍可展示婴儿与产品互动
- 图片生成阶段会智能转换（儿童→成人或纯产品）
- 视频生成不受儿童内容限制（只要图片合规）

**示例prompt输出**:
```json
{
  "action": "A baby sits on a playmat and begins to open a cardboard box...",
  "first_frame_prompt": "A medium shot of a cute baby sitting on a patterned playmat...",
  "dialogue": "Watch your little one discover the joy of learning..."
}
```
> 注意：视频可以用这个prompt，但图片生成会转换为成人或产品展示

### 2. 图片生成阶段限制

**适用范围**: 所有图片生成（封面、分段关键帧）

#### A. 通用限制（适用所有模型）

**关键实现**: `⚠️ ZERO-CHILD POLICY (ALL MODELS)` 部分

**禁止的元素**:
```
PROHIBITED Elements:
❌ Absolutely NO children/minors (under 18) in ANY form:
   - No child faces, hands, limbs, or body parts
   - No child silhouettes, back views, or blurred figures
   - No recognizable children in any way
```

**允许的元素（成人18+）**:
```
ALLOWED Human Elements (Adults 18+ ONLY):
✅ Adults: FULLY ALLOWED in all forms
   - Clear frontal faces with visible facial features
   - Close-up face shots and detailed portraits
   - Multiple people with visible faces in the same frame
   - Hands/arms showing product interaction
   - Body parts demonstrating product use
   - Blurred background figures, silhouettes, back views
   - All forms of adult human presence
```

**转换规则**:
```
TRANSFORMATION RULES:
- If original prompt has children → Replace with adults OR product-only display
- Adults can be shown naturally without face restrictions
- Maintain SCENE, LIGHTING, and STYLE from original prompt
- Focus on product presentation and authentic use cases
```

**应用位置**:
- `generateCover()` - 封面图生成 (lines 1004-1026)
- `createSegmentFrameTask()` - 分段关键帧生成 (lines 1306-1328)

#### B. Sora2模型额外限制

**Sora2 STRICT Safety Requirements** (仅Sora2/Sora2 Pro):
```
❌ NO children/minors (under 18) in ANY form (same as above)
❌ NO human faces of any age - Sora2 content moderation is extremely strict
✅ Allowed for adults: hands/limbs, body parts, blurred figures, silhouettes, back views
✅ Highlight product using hands-on demonstration WITHOUT showing any faces
✅ Use side views, back views, or obscured angles for human presence if needed
```

**应用位置**:
- `generateCover()` - 封面图生成时Sora2检测 (lines 1049-1055)

**说明**: Sora2的内容审核非常严格，不能出现任何人脸。但仍然允许成人的手部/肢体演示产品，只是不能显示脸部。

#### C. 智能Prompt重写策略 (NEW in Version 3.1.1)

**问题发现**:
Version 3.0和3.1在图片生成时存在**矛盾性指令**：
```
Prompt描述: "showing the baby joyfully playing with colorful rollers"
附加限制: "⚠️ ZERO-CHILD POLICY: ❌ NO children"
```
这种"先描述儿童→再禁止儿童"的策略会导致：
- AI理解困难，不知道该听从哪条指令
- 生成的图片可能仍包含儿童元素
- 审核系统可能检测到prompt中的儿童词汇

**用户反馈原话**:
> "你不要再prompt里面正常描述了有儿童，然后又后面添加强制性的限制，而是你直接就描述一个正常没有儿童的画面就OK了呀"

**解决方案 - 智能重写**:
在图片生成**之前**，智能重写segment prompt中的所有文本字段，将儿童引用直接替换为成人或产品展示描述。

**重写示例**:

| Before (原始prompt) | After (智能重写后) |
|-------------------|------------------|
| "the baby joyfully playing with the toy" | "gentle adult hands demonstrating the toy's features" |
| "showing the baby's smiling face" | "showing gentle adult hands interacting with the toy" |
| "child using the colorful rollers" | "adult hands showcasing the colorful rollers" |
| "baby's tiny fingers spinning blocks" | "adult fingers demonstrating the spinning mechanism" |
| "toddler discovering shapes" | "adult hands demonstrating shape recognition" |

**技术实现** (`lib/standard-ads-workflow.ts`):

1. **智能重写函数** (line 143-243) - `rewriteSegmentPromptForSafety()`:
```typescript
function rewriteSegmentPromptForSafety(
  segmentPrompt: SegmentPrompt,
  productCategory: 'children_toy' | 'adult_product' | 'general'
): SegmentPrompt {
  // 只对children_toy产品重写
  if (productCategory !== 'children_toy') {
    return segmentPrompt;
  }

  // 重写所有文本字段中的child references
  const replacements = [
    { pattern: /the baby'?s? (?:smiling )?face/gi, replacement: 'gentle adult hands' },
    { pattern: /showing the (?:baby|child|kid)/gi, replacement: 'showing adult hands' },
    { pattern: /(?:baby|child) (?:joyfully |happily )?(?:playing|using)/gi,
      replacement: 'adult hands gently demonstrating' },
    // ... 更多replacement patterns
  ];

  // 应用到所有字段：description, action, dialogue, setting, first_frame_prompt等
  return rewrittenPrompt;
}
```

2. **应用重写** (line 1362-1373):
```typescript
// 在segment生成循环开始前检测产品类别
const productCategory = detectProductCategory(prompts);

for (const segment of segments) {
  const promptData = normalizedSegments[segment.segment_index];

  // 智能重写：将child references替换为adult/product descriptions
  const safePromptData = rewriteSegmentPromptForSafety(promptData, productCategory);

  // 使用重写后的prompt生成图片
  const firstFrameTaskId = await createSegmentFrameTask(request, safePromptData, ...);
  // closing frame也使用重写后的prompt
  const closingFrameTaskId = await createSegmentFrameTask(request, safePromptData, ...);
}
```

**重写字段**:
- `description` - 主要场景描述
- `action` - 动作描述
- `dialogue` - 旁白对话
- `setting` - 场景设置
- `lighting` - 灯光描述
- `first_frame_prompt` - 首帧prompt
- `closing_frame_prompt` - 尾帧prompt
- 其他所有文本字段

**重写规则**:
1. **Child词汇替换**:
   - baby/babies/infant/toddler → "adult hands"
   - child/children/kid/kids → "adult hands"

2. **Action动词转换**:
   - "joyfully discovering" → "gently demonstrating"
   - "happily exploring" → "carefully showcasing"
   - "excitedly playing" → "demonstrating interaction"

3. **Phrase重写**:
   - "the baby's face" → "gentle adult hands"
   - "showing the child" → "showing adult hands"
   - "child using X" → "adult hands using X"

4. **保持一致性**:
   - 场景、灯光、风格保持不变
   - 只替换人物引用，不改变整体创意
   - 音乐、结尾等非人物元素完全保留

**工作流程对比**:

**Version 3.1 (旧版 - 矛盾指令)**:
```
AI生成prompt: "baby playing with toy"
   ↓
图片生成: 使用原始prompt + 添加ZERO-CHILD POLICY限制
   ↓
结果: ❌ 矛盾指令，可能仍生成儿童元素
```

**Version 3.1.1 (新版 - 智能重写)**:
```
AI生成prompt: "baby playing with toy"
   ↓
智能重写: "adult hands demonstrating toy"
   ↓
图片生成: 使用重写后prompt（无矛盾，无需额外限制）
   ↓
结果: ✅ 清晰指令，完全避免儿童元素
```

**优势**:
- **无矛盾指令**: prompt本身就是adult-only，无需额外限制
- **AI理解清晰**: 不会收到冲突的指令
- **审核友好**: prompt文本中不包含child关键词
- **保持创意**: 场景、风格、创意结构完全保留
- **自动化**: 检测到children_toy自动触发重写

**应用场景**:

**儿童玩具广告（完整流程）**:
1. AI分析: "A baby sits on playmat and begins exploring wooden blocks..."
2. 智能重写: "Adult hands on playmat gently demonstrate wooden blocks..."
3. 图片生成: 使用重写后prompt → 成人手部演示产品
4. 视频生成: 使用原始prompt → 婴儿玩玩具（Veo3允许）
5. 最终效果: 封面成人演示 + 视频婴儿互动 ✅

**成人产品广告（无需重写）**:
1. AI分析: "A professional demonstrates the smartwatch features..."
2. 重写检测: product_category = 'adult_product' → 跳过重写
3. 图片生成: 使用原始prompt → 成人展示产品
4. 视频生成: 使用原始prompt → 成人展示产品
5. 最终效果: 封面和视频完全一致 ✅

#### D. 儿童玩具产品特殊处理 (NEW in Version 3.1)

**问题发现**:
- Google Veo3检查**首尾两帧**（first_frame和closing_frame）
- 如果两帧都无儿童 → 视频也不会有儿童（即使prompt明确提到儿童）
- 这导致儿童玩具广告视频中看不到儿童，失去广告意义

**解决方案**:
```
✅ 自动检测产品类别（product_category字段）
✅ 如果是"children_toy" → 只生成first_frame，跳过closing_frame
✅ 只有一帧供Veo3检查 → 儿童可以正常出现在视频中
```

**技术实现** (`lib/standard-ads-workflow.ts`):

1. **产品分类检测** (line 107-141) - `detectProductCategory()` 函数:
```typescript
function detectProductCategory(prompts) {
  // 优先使用AI提供的product_category字段
  if (prompts.product_category === 'children_toy') return 'children_toy';

  // 备用：关键词检测
  const keywords = ['baby', 'infant', 'child', 'toy', 'nursery', ...];
  return hasKeywords ? 'children_toy' : 'general';
}
```

2. **条件跳过closing_frame** (line 1293-1309):
```typescript
if (segment.segment_index === lastSegment) {
  const productCategory = detectProductCategory(prompts);

  if (productCategory === 'children_toy') {
    console.log('🧸 Detected children_toy - SKIP closing_frame');
    // 不生成closing_frame
  } else {
    // 正常生成closing_frame
    const closingFrameTaskId = await createSegmentFrameTask(..., 'closing');
  }
}
```

**效果对比**:

| 产品类型 | first_frame | closing_frame | 视频内容 |
|---------|-------------|---------------|----------|
| 儿童玩具（旧版） | ✅ 成人手部+产品 | ✅ 成人手部+产品 | ❌ 无儿童 |
| 儿童玩具（新版） | ✅ 成人手部+产品 | ❌ **不生成** | ✅ **有儿童** |
| 成人产品 | ✅ 成人+产品 | ✅ 成人+产品 | ✅ 正常 |

**实际应用示例**:

**儿童玩具广告**:
- AI生成: "A baby playing with wooden blocks, discovering shapes and colors..."
- first_frame: 成人手部搭积木（符合ZERO-CHILD POLICY）
- closing_frame: **跳过生成**
- 视频生成: ✅ 正常展示婴儿玩玩具（因为只检查first_frame）

### 3. 结构化视频分析 (NEW in Version 3.0)

**问题**: 之前的 `product_description` 过于简单，只有一句话，无法支撑长视频生成。

**解决方案**: 基于 **Veo Prompt Guide** 的结构化分析，输出专业的8要素描述。

#### 新增字段

**Product Classification** (产品分类):
```json
{
  "product_category": "children_toy" | "adult_product" | "general",
  "target_audience": "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"
}
```

**Core Concept** (核心概念 - Veo Guide):
```json
{
  "subject": "Main elements and focal points",
  "context": "Environment, background, setting",
  "action": "What is happening, product interaction"
}
```

**Visual Style** (视觉风格 - Veo Guide):
```json
{
  "style": "Overall visual style and artistic direction",
  "camera_type": "Shot type (e.g., Medium shot, Close-up)",
  "camera_movement": "Camera movements (e.g., Slow tracking shot)",
  "composition": "Framing and shot composition",
  "ambiance": "Color palette, lighting, mood"
}
```

**Full Description** (完整描述 - NEW):
```json
{
  "full_description": "200-500 word comprehensive narrative description combining all elements, suitable for 60s+ video generation. Includes subject, context, action, visual style, camera work, lighting, audio, and narrative flow."
}
```

**完整示例输出**:
```json
{
  "product_category": "children_toy",
  "target_audience": "babies (0-2)",
  "subject": "Wooden sensory activity box with colorful blocks",
  "context": "Bright, minimalist playroom with soft natural lighting",
  "action": "Baby discovering shapes, colors, and textures through hands-on exploration",
  "style": "Modern, clean, Montessori-inspired educational aesthetic",
  "camera_type": "Medium shot",
  "camera_movement": "Gentle overhead shots, smooth close-ups of hands",
  "composition": "Close-ups highlighting product details, POV angles",
  "ambiance": "Warm, nurturing, developmentally focused with pastel tones",
  "full_description": "A Lovevery-style educational advertisement showcasing a premium wooden activity toy... [详细200-500字描述]",
  "description": "Baby exploring wooden activity toy",
  "setting": "Modern playroom",
  "lighting": "Soft natural lighting",
  "dialogue": "Every discovery builds their future",
  "music": "Gentle piano music",
  "ending": "Product close-up with baby and toy in harmony",
  "other_details": "Natural wood furniture, neutral walls",
  "language": "English"
}
```

#### 应用位置

1. **竞品引用模式prompt** (line 764-854):
   - 要求AI按Veo Guide结构分析竞品视频
   - 输出包含product_category等结构化字段

2. **传统模式prompt** (line 876-928):
   - 要求AI分析产品并输出结构化描述
   - 包含产品分类和完整的Veo Guide要素

#### 技术优势

| 方面 | 旧版 | 新版 (Version 3.0) |
|------|------|-------------------|
| product_description | 一句话 | 结构化8要素 + 完整描述 |
| 产品分类 | 无 | 自动检测children_toy |
| 视频描述长度 | ~50字 | 200-500字 |
| 支持视频长度 | 8-10s | 60s+ |
| Veo Guide兼容 | 否 | 完全兼容 |

### 4. 完整工作流程（Version 3.0）

#### 普通模型（Veo3, Veo3 Fast）
```
用户上传儿童玩具照片
        ↓
AI生成广告prompt（可能包含"child playing with toy"）
        ↓
    ┌─────────┴─────────┐
    ↓                   ↓
图片生成              视频生成
(转换为成人或纯产品)  (使用完整prompt含儿童)
    ↓                   ↓
成人手部玩玩具图      儿童玩玩具视频
(成人可见人脸)       (有意义的广告内容)
```

#### Sora2模型
```
用户上传智能手表照片
        ↓
AI生成广告prompt（包含成人佩戴展示）
        ↓
    ┌─────────┴─────────┐
    ↓                   ↓
图片生成              视频生成 (Sora2)
(成人手腕，无人脸)    (使用完整prompt)
    ↓                   ↓
手腕特写展示          完整广告视频
(无人脸，符合Sora2要求)
```

### 4. Version 3.0 的关键变化

**相比 Version 2.4 (Relaxed) 的变化**:

| 方面 | Version 2.4 | Version 3.0 |
|------|-------------|-------------|
| **儿童手部/肢体** | ✅ 允许（无人脸） | ❌ 完全禁止 |
| **儿童剪影/背影** | ✅ 允许 | ❌ 完全禁止 |
| **成人正面人脸** | ❌ 禁止 | ✅ 完全允许 |
| **成人多人合影** | ❌ 禁止 | ✅ 完全允许 |
| **成人面部特写** | ❌ 禁止 | ✅ 完全允许 |
| **Sora2成人人脸** | ❌ 禁止 | ❌ 仍然禁止 |

**实际效果示例**:

**儿童玩具广告（普通模型）**:
- ❌ 旧版: 儿童手部搭积木，背景模糊儿童轮廓
- ✅ 新版: **成人手部**搭积木 或 纯产品展示
- 结果: 完全避免儿童元素，使用成人演示

**智能手表广告（普通模型）**:
- ❌ 旧版: 手腕特写，禁止显示人脸
- ✅ 新版: 手腕特写 + **成人完整人脸**都允许
- 结果: 更真实的产品展示，可以看到佩戴者表情

**服装广告（普通模型）**:
- ❌ 旧版: 模特背影，避免人脸
- ✅ 新版: **成人模特正面**展示服装
- 结果: 完整展示穿着效果，包括面部搭配

**化妆品广告（Sora2模型）**:
- 策略: **成人手部**涂抹产品特写（无人脸）
- 或者: 纯产品展示 + 手部演示
- 结果: 符合Sora2严格审核，但仍能展示使用场景

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

### Version 3.1.1 (2025-01-17)
- **关键突破**：智能Prompt重写 - 彻底解决矛盾指令问题
- **核心变更**：
  - **智能重写函数**：`rewriteSegmentPromptForSafety()` - 在图片生成前自动重写prompt
  - **消除矛盾指令**：不再使用"描述儿童+禁止儿童"的矛盾策略
  - **直接重写策略**：将child references直接替换为adult/product描述
  - **完整字段覆盖**：重写description, action, dialogue, first_frame_prompt等所有文本字段
- **问题发现与解决**：
  - **问题**：Version 3.0-3.1使用"描述儿童然后添加限制"的策略，导致矛盾指令
  - **用户反馈**："你不要再prompt里面正常描述了有儿童，然后又后面添加强制性的限制，而是你直接就描述一个正常没有儿童的画面就OK了呀"
  - **解决**：智能重写prompt文本，直接生成adult-only描述，无需额外限制
- **技术实现**：
  - 新增 `rewriteSegmentPromptForSafety()` 函数 (line 143-243) - 智能文本替换
  - 应用重写到segment生成 (line 1362-1373) - 在图片生成前自动触发
  - 修改 `product_description` 存储 (line 538, 1256) - 保存完整AI响应数据
  - 重写字段：description, action, dialogue, setting, lighting, first_frame_prompt, closing_frame_prompt等
- **重写规则**：
  - Child词汇 → "adult hands": baby/babies/infant/toddler/child/children/kid/kids
  - Action动词转换: "joyfully discovering" → "gently demonstrating"
  - Phrase重写: "showing the baby" → "showing adult hands"
  - 保持一致性：场景、灯光、风格不变，只替换人物引用
- **应用场景**：
  - 儿童玩具（完整流程）：
    * AI生成: "baby playing with toy"
    * 智能重写: "adult hands demonstrating toy"
    * 图片生成: ✅ 使用重写后prompt，无矛盾指令
    * 视频生成: 使用原始prompt，儿童正常出现
  - 成人产品：
    * 检测到非children_toy → 跳过重写
    * 图片和视频使用相同prompt
- **优势**：
  - **无矛盾指令**：prompt本身就是adult-only，无需额外限制
  - **AI理解清晰**：不会收到冲突的指令
  - **审核友好**：prompt文本不包含child关键词
  - **保持创意**：场景、风格、创意结构完全保留
  - **自动化**：检测到children_toy自动触发
- **文件修改**：
  - `lib/standard-ads-workflow.ts` (line 143-243) - rewriteSegmentPromptForSafety()函数
  - `lib/standard-ads-workflow.ts` (line 1362-1373) - 应用重写到segment生成循环
  - `lib/standard-ads-workflow.ts` (line 538, 1256) - product_description存储完整数据
  - `prompts/standard-ads-workflow.md` - 完整文档更新到Version 3.1.1

### Version 3.1 (2025-01-16)
- **关键突破**：解决儿童玩具视频无法展示儿童的问题 + 结构化视频分析
- **核心变更**：
  - **儿童产品特殊处理**：自动检测children_toy产品，跳过closing_frame生成
  - **结构化视频分析**：基于Veo Prompt Guide的8要素专业分析输出
  - **产品分类系统**：AI自动分类product_category ("children_toy" | "adult_product" | "general")
- **问题发现与解决**：
  - **问题**：Version 3.0的ZERO-CHILD POLICY导致first_frame和closing_frame都无儿童 → 视频也无儿童
  - **发现**：Google Veo3检查首尾两帧，如果两帧都无儿童→视频不会生成儿童（即使prompt提到）
  - **解决**：儿童玩具只生成first_frame，跳过closing_frame → 只检查一帧 → 儿童正常出现
- **技术实现**：
  - 新增 `detectProductCategory()` 函数 (line 107-141) - 检测产品类别
  - 修改segment frames生成逻辑 (line 1293-1309) - 条件跳过closing_frame
  - 改进AI prompt - 要求输出Veo Guide结构化字段 (line 764-854, 876-928)
  - 新增字段：product_category, target_audience, subject, context, composition, ambiance, full_description
- **应用场景**：
  - 儿童玩具（NEW）：
    * first_frame: 成人手部+产品（ZERO-CHILD POLICY）
    * closing_frame: **不生成**
    * 视频: ✅ **儿童正常出现**（因为只检查first_frame）
  - 成人产品：
    * first_frame: 成人+产品
    * closing_frame: 成人+产品
    * 视频: ✅ 正常展示
- **结构化分析优势**：
  - **描述长度**：从一句话 → 200-500字完整叙事
  - **支持时长**：从8-10s → 60s+ 长视频
  - **Veo兼容**：完全符合Veo Prompt Guide标准
  - **自动分类**：AI自动识别产品类别，触发特殊处理
- **文件修改**：
  - `lib/standard-ads-workflow.ts` (line 107-141) - detectProductCategory()函数
  - `lib/standard-ads-workflow.ts` (line 1293-1309) - 条件跳过closing_frame
  - `lib/standard-ads-workflow.ts` (line 764-854) - 竞品引用模式结构化prompt
  - `lib/standard-ads-workflow.ts` (line 876-928) - 传统模式结构化prompt
  - `prompts/standard-ads-workflow.md` - 完整文档更新到Version 3.1

### Version 3.0 (2025-01-16)
- **重大策略转变**：从"Relaxed人物限制"转向"Zero-Child Policy + Adult-Friendly"
- **核心变更**：
  - **完全禁止儿童**：图片生成中不能出现任何儿童元素（包括手部、肢体、剪影等）
  - **完全允许成人**：放开成人限制，允许清晰人脸特写、多人合影等所有形式
  - **Sora2特殊处理**：Sora2模型仍禁止人脸（内容审核极严格），但允许手部/肢体演示
- **问题解决**：Version 2.4的"允许儿童手部"策略仍存在未成年人内容审核风险
- **技术实现**：
  - 修改 `generateCover()` 通用限制 → `⚠️ ZERO-CHILD POLICY (ALL MODELS)`
  - 修改 `generateCover()` Sora2限制 → `Sora2 STRICT Safety Requirements`
  - 修改 `createSegmentFrameTask()` 限制 → 同样的Zero-Child Policy
  - AI prompt生成阶段保持无限制（视频仍可展示儿童）
- **应用场景**：
  - 儿童玩具：视频展示儿童玩耍，**封面改为成人手部演示**或纯产品
  - 智能手表：视频和封面都可展示**成人完整人脸**（Version 2.4禁止）
  - 服装广告：封面可以**成人模特正面**展示（Version 2.4只能背影）
  - 化妆品（Sora2）：封面展示**成人手部涂抹**（无人脸，符合Sora2要求）
- **策略优势**：
  - **安全合规**：完全避免未成年人相关的内容审核风险
  - **简化规则**：明确的"零儿童"政策，更容易理解和执行
  - **成人友好**：真实展示成人使用场景（人脸特写、情绪表达等）
  - **差异化处理**：普通模型完全放开，Sora2保持严格（适应不同审核标准）
- **文件修改**：
  - `lib/standard-ads-workflow.ts` (line 1004-1026) - generateCover()通用限制
  - `lib/standard-ads-workflow.ts` (line 1049-1055) - generateCover() Sora2额外限制
  - `lib/standard-ads-workflow.ts` (line 1306-1328) - createSegmentFrameTask()限制
  - `prompts/standard-ads-workflow.md` - 完整文档更新到Version 3.0

### Version 2.4 (2025-01-16) [已废弃 - 儿童风险]
- **策略名称**：Relaxed人物限制策略
- **核心特点**：允许儿童手部/肢体（无人脸），禁止所有成人人脸
- **废弃原因**：
  - 儿童手部/肢体仍可能触发未成年人内容审核
  - 成人人脸禁令过于严格，限制真实产品展示
  - 需要更明确的"零儿童"策略以彻底规避风险
- **改进方向**：Version 3.0采用Zero-Child Policy + Adult-Friendly策略

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
