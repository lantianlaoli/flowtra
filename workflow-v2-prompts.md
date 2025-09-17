# Workflow V2 Prompt Reference

## Overview
Workflow V2 produces multiple advertising variants from a single uploaded product image. The pipeline sanitizes optional user watermark inputs, keeps a shared product description, and reuses structured creative data across cover and video generation. Each stage below details the expected inputs, the exact prompt payload sent to the model or service, the structured output, and how that output drives the next node.

## Flow Summary
1. **Image Analysis** → generates a structured description that is reused by the cover- and video-prompt stages.
2. **Creative Element Sets** → creates diverse ad element bundles; every bundle carries the sanitized watermark data.
3. **Cover Prompt Synthesis** → merges the shared description with a specific element bundle to craft the final image prompt.
4. **Cover Rendering (Nano-Banana)** → renders the cover image with the prompt and original reference photo.
5. **Video Prompt Design** → uses the rendered cover, shared description, and selected element bundle to form a cinematic video brief that is then passed to the video generator.

## Stage 1 – Image Analysis
### Inputs
- `image_url`: direct URL of the uploaded product image.

### Prompt Payload
```json
{
  "model": "openai/gpt-4.1-mini",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analyze the given image and determine if it primarily depicts a product or a character, or BOTH. Return the analysis in the specified JSON format."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "<image_url>"
          }
        }
      ]
    }
  ],
  "max_tokens": 500,
  "temperature": 0.7,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "image_analysis",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["product", "character", "both"] },
          "brand_name": { "type": "string" },
          "color_scheme": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "hex": { "type": "string" },
                "name": { "type": "string" }
              },
              "required": ["hex", "name"]
            }
          },
          "font_style": { "type": "string" },
          "visual_description": { "type": "string" },
          "outfit_style": { "type": "string" }
        },
        "required": ["type", "visual_description"],
        "additionalProperties": false
      }
    }
  }
}
```

### Output
A JSON object containing `type`, `brand_name`, `color_scheme`, `font_style`, `visual_description`, and (when applicable) `outfit_style`.

### Downstream Connections
- The serialized JSON is stored as the shared product description and passed to Stage 3 and Stage 5.

## Stage 2 – Creative Element Sets
### Inputs
- `image_url`: same image analyzed in Stage 1.
- `count`: number of variants requested by the user.
- `text_watermark` (optional): trimmed; empty strings become `null`.
- `text_watermark_location` (optional): trimmed; defaults to `"bottom left"` whenever a watermark text is present.

### Prompt Payload
```json
{
  "model": "openai/gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "### A - Ask:\nCreate exactly <count> different sets of ELEMENTS for the uploaded ad image.\nEach set must include **all required fields** and differ in tone, mood, or creative angle.\n\n### G - Guidance:\n**role:** Creative ad concept generator\n**output_count:** <count> sets\n**constraints:**\n- Every set must have:\n  - product\n  - character\n  - ad_copy\n  - visual_guide\n  - Primary color, Secondary color, Tertiary color\n- Ensure creative DIVERSITY between the <count> sets:\n  - One can be minimal/clean, the other bold/energetic (or premium/elegant vs. playful/dynamic).\n- Characters must be living subjects or humans interacting with the product, not flat packaging graphics. If the packaging already shows a mascot, invent a different real-world subject (for pet food, use a breed that differs from the packaging artwork) who is actively engaging with the product experience.\n- Describe characters and visual guides from the perspective of the target customer using cues from the product, and avoid copying or tracing printed illustrations on the pack.\n- When the product packaging features a dog, assume the mascot is a medium-sized brown hunting dog. You must choose a clearly different breed (e.g., corgi, dachshund, shiba inu, french bulldog, poodle, golden retriever, husky). Explicitly name that breed in the character field and describe how it interacts with the product. Never reuse or paraphrase the breed seen on the packaging.\n- If user does not specify details, apply smart defaults:\n  - ad_copy → short, catchy slogan\n  - visual_guide → describe placement, size, activity of character, product angle, background mood\n  - colors → decide based on the ad image\n- IMPORTANT: Do NOT generate text_watermark field - this will be provided separately by the user\n\n### E - Examples:\n**good_examples:**\n- **Set 1:** minimal, clean, muted tones, straightforward CTA.\n- **Set 2:** bold, colorful, dynamic composition, playful character usage.\n\n### N - Notation:\n**format:** structured JSON with <count> sets clearly separated."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Your task: Based on the ad image I uploaded, create exactly <count> different sets of ELEMENTS."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "<image_url>"
          }
        }
      ]
    }
  ],
  "max_tokens": 1500,
  "temperature": 0.8,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "elements_sets",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "elements": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "product": { "type": "string" },
                "character": { "type": "string" },
                "ad_copy": { "type": "string" },
                "visual_guide": { "type": "string" },
                "primary_color": { "type": "string" },
                "secondary_color": { "type": "string" },
                "tertiary_color": { "type": "string" }
              },
              "required": ["product", "character", "ad_copy", "visual_guide", "primary_color", "secondary_color", "tertiary_color"]
            }
          }
        },
        "required": ["elements"]
      }
    }
  }
}
```

### Output
An object with `elements`, where each array item is enriched post-response to include:
- `product`, `character`, `ad_copy`, `visual_guide`, `primary_color`, `secondary_color`, `tertiary_color`.
- `text_watermark`: sanitized user watermark text or empty string when none is provided.
- `text_watermark_location`: sanitized location or the default `"bottom left"` when a watermark text exists.

### Downstream Connections
- Each element bundle is persisted together with the sanitized watermark fields.
- Every inserted `user_history_v2` record receives the same description from Stage 1 and a unique element bundle from this stage.
- The selected bundle for a record is forwarded to Stage 3 and Stage 5 for prompt construction.

## Stage 3 – Cover Prompt Synthesis
### Inputs
- `product_description`: JSON string returned by Stage 1.
- `elements`: one bundle from Stage 2.
- `text_watermark` / `text_watermark_location`: inherited from the bundle.

### Prompt Payload
```json
{
  "model": "openai/gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent\n\n### A - Ask:\nCreate exactly 1 structured image ad prompt with all required fields filled.\n\nThe final prompt should be written like this:\n\n\"\"\"\nMake an image ad for this product with the following elements. The product looks exactly like what's in the reference image.\n\nproduct:\ncharacter:\nad_copy:\nvisual_guide:\ntext_watermark:\ntext_watermark_location:\nPrimary color of ad:\nSecondary color of ad:\nTertiary color of ad:\n\"\"\"\n\n### G - Guidance:\nrole: Creative ad prompt engineer\noutput_count: 1\nconstraints:\n- Always include all required fields.\n- Integrate the user's special request as faithfully as you can in the final image prompt.\n- If user input is missing, apply smart defaults:\n  - text_watermark_location → \"bottom left of screen\"\n  - primary_color → decide based on the image provided\n  - secondary_color → decide based on the image provided\n  - tertiary_color → decide based on the image provided\n  - font_style → decide based on the image provided\n  - ad_copy → keep short, punchy, action-oriented.\n  - visual_guide → If the request involves a human character, define camera angle/camera used. If no visual guide is given, describe placement/size of character, what they're doing with the product, style of the ad, main background color and text color.\n- CRITICAL: The product must look exactly like what's in the reference image. Do not redraw or alter logos, text, proportions, materials, or exact colors.\n- When the character description names a dog breed, restate that exact breed in the final prompt text and remind the model that it differs from the brown hunting dog shown on the packaging. Keep the new breed visibly interacting with the product in the pose defined by visual_guide.\n\n### E - Examples:\ngood_examples:\n- character: as defined by the user\n- ad_copy: as defined by the user, or decide if not provided\n- visual_guide: as defined by the user. If detailed, expand to accommodate while respecting the color palette.\n- text_watermark: as defined by the user, leave blank if none provided\n- text_watermark_location: as defined by the user, or bottom left if none provided\n\n### N - Notation:\nformat: text string nested within an \"image_prompt\" parameter. Avoid using double-quotes or raw newlines.\nexample_output: |\n{\n  \"image_prompt\": \"final prompt here\"\n}"
    },
    {
      "role": "user",
      "content": "Your task: Create 1 image prompt as guided by your system guidelines.\n\nDescription of the reference image: <product_description>\n\nELEMENTS FOR THIS IMAGE:\n\nproduct: <product>\ncharacter: <character>\nad_copy: <ad_copy>\nvisual_guide: <visual_guide>\ntext_watermark: <text_watermark>\ntext_watermark_location: <text_watermark_location>\n\nPrimary color: <primary_color>\nSecondary color: <secondary_color>\nTertiary color: <tertiary_color>"
    }
  ],
  "max_tokens": 800,
  "temperature": 0.7,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "final_cover_prompt",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "image_prompt": { "type": "string" }
        },
        "required": ["image_prompt"],
        "additionalProperties": false
      }
    }
  }
}
```

### Output
A JSON object containing `image_prompt`.

### Downstream Connections
- The `image_prompt` feeds Stage 4 together with the original reference image and desired output size.
- The prompt copy is also stored in the workflow record for auditing.

## Stage 4 – Cover Rendering (Nano-Banana)
### Inputs
- `image_prompt`: output of Stage 3.
- `original_image_url`: user-uploaded reference image.
- `image_size`: user-selected or default value (`auto`).

### Request Payload
```json
{
  "model": "google/nano-banana-edit",
  "input": {
    "prompt": "<image_prompt>",
    "image_urls": ["<original_image_url>"],
    "output_format": "png",
    "image_size": "<image_size>"
  },
  "callBackUrl": "<optional_webhook_url>"
}
```

### Output
- Response code `200` and a `taskId`. The callback delivers the rendered cover image URL when the task finishes.

### Downstream Connections
- The cover image URL received via webhook updates the workflow record and becomes the visual anchor for Stage 5.
- Once the cover is stored, the system immediately triggers Stage 5 to prepare the video brief and schedules the video generation task with that brief.

## Stage 5 – Video Prompt Design
### Inputs
- `cover_image_url`: the rendered cover from Stage 4.
- `elements`: the same bundle used in Stage 3.
- `product_description`: shared description from Stage 1.

### Prompt Payload
```json
{
  "model": "openai/gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "Video Prompt Generator for Product Creatives\nRole\nYou are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned video content for product marketing.\n\nTask\nGenerate a video prompt and return ONLY the JSON object inside video_prompt.\n\nGuidance\nAlways use the product description and creative brief as provided by the user. Include these essential details in every prompt: description, setting, camera_type, camera_movement, action, lighting, other_details, dialogue, music, ending. Scenes must be visually rich and avoid generic or vague descriptions. Adhere strictly to the brand identity and ensure the final output feels polished, cinematic, and aligned with the marketing intent.\n\nConstraints\nRespond ONLY with the JSON object of video_prompt. Do NOT include any image URLs or references to image links in the JSON."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Context:\nproduct_description: <product_description>\nelements: <elements_json>\n\nUse the attached image input to ground the design. Return ONLY the JSON object for video_prompt."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "<cover_image_url>"
          }
        }
      ]
    }
  ],
  "max_tokens": 1200,
  "temperature": 0.7,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "video_prompt",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "setting": { "type": "string" },
          "camera_type": { "type": "string" },
          "camera_movement": { "type": "string" },
          "action": { "type": "string" },
          "lighting": { "type": "string" },
          "other_details": { "type": "string" },
          "dialogue": { "type": "string" },
          "music": { "type": "string" },
          "ending": { "type": "string" }
        },
        "required": ["description", "setting", "camera_type", "camera_movement", "action", "lighting", "other_details", "dialogue", "music", "ending"]
      }
    }
  }
}
```

### Output
A JSON object named `video_prompt` containing structured fields (`description`, `setting`, `camera_type`, `camera_movement`, `action`, `lighting`, `other_details`, `dialogue`, `music`, `ending`).

### Downstream Connections
- The video prompt is immediately supplied to the video generation service together with the cover image URL and selected model.
- Completion of the video task updates the workflow record and unlocks downloads, which trigger credit deductions only when a video file is fetched.

## Watermark Handling
- User-supplied watermark text and location are trimmed before any prompts run.
- When only text is provided, the default location `"bottom left"` is injected.
- Sanitized values are stored on every `user_history_v2` row and merged into the prompt payloads for Stages 2 and 3, ensuring consistency between the stored metadata, the cover render, and the final video brief.

## Node Dependencies Recap
- **Stage 1 → Stage 3 & 5:** The shared product description anchors both the final cover prompt and the video prompt.
- **Stage 2 → Stage 3 & 5:** Each individual element bundle (including watermark data) drives the creative brief for both cover and video outputs.
- **Stage 3 → Stage 4:** The synthesized `image_prompt` is required to kick off cover rendering.
- **Stage 4 → Stage 5:** The final cover URL becomes the visual context for the video prompt and the downstream video generator.
- **Stage 5 → Video Generation:** The completed video prompt launches the video task whose outcome is tracked alongside the cover assets.

## Generation Characteristics
- Supports 1–3 parallel variants per user request.
- Maintains strong creative diversity across variants through Stage 2 constraints.
- Rendering and video generation are free to preview; credit deductions occur only on video download.
- Each workflow record stores progress timestamps to enable monitoring and retries.
