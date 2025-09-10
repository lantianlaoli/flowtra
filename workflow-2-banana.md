## 1. describe image（openrouter：openai/gpt-4o-mini）

```jsx
Analyze the given image and determine if it primarily depicts a product or a character, or BOTH.

- If the image is of a product, return the analysis in JSON format with the following fields:

{
  "type": "product",
  "brand_name": "(Name of the brand shown in the image, if visible or inferable)",
  "color_scheme": [
    {
      "hex": "(Hex code of each prominent color used)",
      "name": "(Descriptive name of the color)"
    }
  ],
  "font_style": "(Describe the font family or style used: serif/sans-serif, bold/thin, etc.)",
  "visual_description": "(A full sentence or two summarizing what is seen in the image, ignoring the background)"
}

- If the image is of a character, return the analysis in JSON format with the following fields:

{
  "type": "character",
  "outfit_style": "(Description of clothing style, accessories, or notable features)",
  "visual_description": "(A full sentence or two summarizing what the character looks like, ignoring the background)"
}

- If it is BOTH, return both descriptions in JSON format:

{
  "type": "both",
  "product": {
    "brand_name": "...",
    "color_scheme": [...],
    "font_style": "...",
    "visual_description": "..."
  },
  "character": {
    "outfit_style": "...",
    "visual_description": "..."
  }
}

Only return the JSON. Do not explain or add any other comments.

```

## 2. generate multiple elements（openrouter：openai/gpt-4o-mini）

### user prompt

```jsx
Your task: Based on the ad image I uploaded, create exactly 2 different sets of ELEMENTS.
```

### system prompt

```jsx
### A - Ask:
Create exactly 2 different sets of ELEMENTS for the uploaded ad image.  
Each set must include **all required fields** and differ in tone, mood, or creative angle.  

### G - Guidance:
**role:** Creative ad concept generator  
**output_count:** 2 sets  
**constraints:**
- Every set must have:
  - product
  - character
  - ad_copy
  - visual_guide
  - text_watermark
  - Primary color, Secondary color, Tertiary color
- Ensure creative DIVERSITY between the 2 sets:
  - One can be minimal/clean, the other bold/energetic (or premium/elegant vs. playful/dynamic).
- If user does not specify details, apply smart defaults:
  - ad_copy → short, catchy slogan
  - visual_guide → describe placement, size, activity of character, product angle, background mood
  - text_watermark → blank if not given
  - colors → decide based on the ad image

### E - Examples:
**good_examples:**
- **Set 1:** minimal, clean, muted tones, straightforward CTA.  
- **Set 2:** bold, colorful, dynamic composition, playful character usage.

### N - Notation:
**format:** structured text list with 2 sets clearly separated.
**example_output:** |

{
  "elements": [
    {
      "product": "...",
      "character": "...",
      "ad_copy": "...",
      "visual_guide": "...",
      "text_watermark": "...",
      "Primary color": "...",
      "Secondary color": "...",
      "Tertiary color": "..."
    },
    {
      "product": "...",
      "character": "...",
      "ad_copy": "...",
      "visual_guide": "...",
      "text_watermark": "...",
      "Primary color": "...",
      "Secondary color": "...",
      "Tertiary color": "..."
    }
  ]
}
```

## 3. Combine the information from the previous two steps, call the openrouter interface again, and obtain the user prompt that generates the final cover.

### 3.1 user prompt

```jsx
Your task: Create 1 image prompt as guided by your system guidelines.

Description of the reference image: {{ 来自1. describe image的结果 }}

ELEMENTS FOR THIS IMAGE:

product: {{ 来自2. generate multiple elements的结果 }}
character: {{  }}
ad copy: {{  }}
visual_guide: {{  }}
text_watermark: {{  }}

Primary color: {{  }}
Secondary color: {{  }}
Tertiary color: {{  }}
```

### 3.2 system prompt

```jsx
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
**role:** Creative ad prompt engineer
**output_count:** 1
**constraints:**
- Always include all required fields.
- Integrate the user's special request as faithfully as you can in the final image prompt.
- If user input is missing, apply smart defaults:
  - **text_watermark_location** → "bottom left of screen"
  - **primary_color** → "decide based on the image provided"
  - **secondary_color** → "decide based on the image provided"
  - **tertiary_color** → "decide based on the image provided"
  - **font_style** → "decide based on the image provided"
  - **ad_copy** → keep short, punchy, action-oriented.
  - **visual_guide** → (as defined by the user). If the user's special request is detailed, expand this portion to accommodate their request. Make sure the color palette that is provided is respected even in this portion. If the request involves a human character, define the camera angle and camera used. If no visual guide is given, describe placement of the character and how big they are relative to the image; describe what they're doing with the product; describe the style of the ad, describe the main color of the background and the main color of the text.)
  - **text_watermark** → (as defined by the user, leave blank if none provided)
  - **text_watermark_location** → (as defined by the user, or bottom left if none provided)

### E - Examples:
**good_examples:**
- **character:** (as defined by the user)
- **ad_copy:** (as defined by the user, or decide on your own if not provided)
- **visual_guide:** (as defined by the user. If the user's special request is detailed, expand this portion to accommodate their request. Make sure the color palette that is provided is respected even in this portion. If the request involves a human character, define the camera angle and camera used. If no visual guide is given, describe placement of the character and how big they are relative to the image; describe what they're doing with the product; describe the style of the ad, describe the main color of the background and the main color of the text.)
- **text_watermark:** (as defined by the user, leave blank if none provided)
- **text_watermark_location:** (as defined by the user, or bottom left if none provided)

### N - Notation:
**format:** text string nested within an "image_prompt" parameter. Avoid using double-quotes or new line breaks.
**example_output:** |
{
  "image_prompt": "final prompt here"
}
```


## 4. Generate cover, use banana


## 5. generated video（openrouter）

在本步骤中，OpenRouter 需要结合“已生成的封面图（cover image）”与前序产生的结构化元素与描述，产出完整的视频设计细节。产出的 JSON 将作为 Veo3/Veo3 Fast 的提示词拼装依据，随后调用 KIE 的 Veo 接口生成视频。

### user prompt

```jsx
Video Prompt Generator for Product Creatives
Role
You are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned video content for product marketing.

Task
Generate a video prompt and return ONLY the JSON object inside `video_prompt`.

Context
- product_description: {{ 来自 1. describe image 的结果（或聚合后的产品描述） }}
- elements: {
    product: "...",
    character: "...",
    ad_copy: "...",
    visual_guide: "...",
    text_watermark: "...",
    primary_color: "...",
    secondary_color: "...",
    tertiary_color: "..."
  }

Output Requirements
Respond ONLY with the following structured JSON:

json
{
"description": "...",
"setting": "...",
"camera_type": "...",
"camera_movement": "...",
"action": "...",
"lighting": "...",
"other_details": "...",
"dialogue": "...",
"music": "...",
"ending": "..."
}

Guidance
Always use the product description and creative brief as provided by the user.

Include these essential details in every prompt:
- **description**: What is in view and what is happening.
- **setting**: The environment or scene background.
- **camera_type/camera settings**: E.g., DSLR, wide angle, dolly shot, etc.
- **camera_movement**: Should be simple unless otherwise specified (e.g., static, slow pan).
- **action**: What is the product doing?
- **lighting**: Specify mood and type (e.g., natural light, studio, moody).
- **other_details**: Any unique props, timing, or visual effects.
- **dialogue**: Must always be present.
- **music**: Must always be present.
- **ending**: Must always be present.

Scenes must be visually rich and avoid generic or vague descriptions.

Adhere strictly to the brand identity and ensure the final output feels polished, cinematic, and aligned with the marketing intent.

Constraints
- Respond ONLY with the JSON object of `video_prompt`.
- Do NOT include captions, summaries, or any extra text.
- All outputs must comply with brand and platform safety guidelines.
```

实现要点
- OpenRouter 请求需要包含文字与图片：`messages` 中附带图片输入（`image_url`）作为封面图引用；不要在用户提示文本中包含图片链接。
- 严格要求模型仅返回 `video_prompt` 对象（可使用 `response_format: json_schema` 约束字段）。
- 服务端在拿到 `video_prompt` 后，持久化到 `elements.video_prompt`（或 `elements_data.video_prompt`）用于追踪。
- 随后拼装 Veo 的提示词（保持与封面风格一致，包含 description/setting/camera 等字段的关键信息），调用 `KIE Veo`（`/api/v1/veo/generate`）发起视频生成；`model` 可根据选择使用 `veo3_fast` 或 `veo3`，`aspectRatio` 设为 `16:9`，并传入 `imageUrls: [cover_image_url]` 作为参考。
