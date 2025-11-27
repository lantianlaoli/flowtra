## Simplified Standard Ads Replica Flow

This proposal replaces the current multi-layer prompt orchestration with a three-step pipeline that mirrors the competitor analysis output and keeps the runtime predictable.

---

### 1. Inputs

1. **Competitor analysis JSON** – already produced by `analyzeCompetitorAdWithLanguage`.  
   Structure (kept as-is):
   ```json
   {
     "name": "lovevery-playkits-porch-launch",
     "video_duration_seconds": 97,
     "language": "en",
     "shots": [
       {
          "audio": "Upbeat instrumental music begins",
      "style": "Lifestyle realism, bright and welcoming",
      "action": "A woman in casual clothing opens the glass door, smiles, bends down to pick up the package labeled 'LOVEVERY', and walks back inside",
      "shot_id": 1,
      "subject": "Woman, branded shipping box",
      "end_time": "00:05",
      "start_time": "00:00",
      "composition": "Wide shot",
      "contains_brand": true,
      "contains_product": true,
      "duration_seconds": 5,
      "context_environment": "City street storefront or apartment entrance, daylight",
      "first_frame_description": "Wide shot of a modern urban glass door entrance with a branded cardboard box sitting on the sidewalk",    
      "ambiance_colour_lighting": "Natural outdoor lighting, neutral tones with brick texture",
      "camera_motion_positioning": "Static wide shot capturing full body and entrance"  
       },
       { "... shot 2 ..." }
     ]
   }
   ```
2. **Brand + Product context** – merged record from `user_brands` + `user_products` (name, slogan, hero photos, benefit bullets).

---

### 2. Step-by-step Pipeline

#### Step 1 – Brand-aware prompt rewrite (Gemini)

*Goal:* produce a *minimal* JSON mirroring the competitor schema but with brand/product substitutions.  
*Method:* send the competitor JSON + brand/product context as the single prompt to Gemini 1.5, requesting:

```jsonc
{
  "segments": [
    {
      "audio": "Upbeat instrumental music begins",
      "style": "Lifestyle realism, bright and welcoming",
      "action": "A woman in casual clothing opens the glass door, smiles, bends down to pick up the package labeled 'LOVEVERY', and walks back inside",
      "subject": "Woman, branded shipping box",
      "composition": "Wide shot",
      "context_environment": "City street storefront or apartment entrance, daylight",
      "first_frame_description": "Wide shot of a modern urban glass door entrance with a branded cardboard box sitting on the sidewalk",
      "ambiance_colour_lighting": "Natural outdoor lighting, neutral tones with brick texture",
      "camera_motion_positioning": "Static wide shot capturing full body and entrance",
      "dialogue": "Every glow has a ritual…", 
      "language": "en"
    },
    {
      "audio": "Upbeat instrumental music begins",
      "style": "Lifestyle realism, bright and welcoming",
      "action": "A woman in casual clothing opens the glass door, smiles, bends down to pick up the package labeled 'LOVEVERY', and walks back inside",
      "subject": "Woman, branded shipping box",
      "composition": "W ide shot",
      "context_environment": "City street storefront or apartment entrance, daylight",
      "first_frame_description": "Wide shot of a modern urban glass door entrance with a branded cardboard box sitting on the sidewalk",
      "ambiance_colour_lighting": "Natural outdoor lighting, neutral tones with brick texture",
      "camera_motion_positioning": "Static wide shot capturing full body and entrance",
      "dialogue": "Every glow has a ritual…",
      "language": "en"
    }  
  ]
} 
```

## 错误的

```
{
  "music": "Upbeat ukulele/acoustic music, transitioning to soft lullaby music.",
  "action": "Mother and baby play with the lieveda toy, transition to diaper change, reading, and feeding before final blackout.",
  "ending": "The baby is rocked to sleep in a dimly lit nursery.",
  "setting": "Bright, modern living room transitioning to a cozy, dark nursery.",
  "dialogue": "Female voiceover explaining the steps of the routine, with focus on the importance of pre-sleep play.",
  "language": "English",
  "lighting": "Natural lighting in early shots, transitioning to soft, artificial, low light in later shots.",
  "segments": [
    {
      "music": "Upbeat music begins.",
      "action": "Mother smiles, kneeling next to the 8-month-old who is sitting and engaged with the lieveda activity center toy (wooden base, colors, rollers).",
      "ending": "Flows into close-up of toy interaction.",
      "setting": "Bright living room/play area.",
      "dialogue": "REALISTIC 8 MONTH OLD NIGHT ROUTINE. We focus on play to wind down for an 8 PM bedtime.",
      "lighting": "Bright natural lighting, warm tones.",
      "voice_tone": "Informative, lighthearted.",
      "voice_type": "Female, friendly, clear.",
      "camera_type": "Static wide shot, slightly high angle.",
      "description": "Introduction to the 'realistic' routine with the mother and baby playing with the lieveda toy.",
      "segment_goal": "Establish the setting, character, and introduce the lieveda product visually.",
      "other_details": "Text overlay reinforces the topic.",
      "segment_title": "Routine Introduction & Product Placement",
      "camera_movement": "None.",
      "first_frame_prompt": "A young brunette woman kneeling on a carpeted floor, smiling down at baby sitting in front of her. The baby engages with the lieveda wooden activity center. Text overlay: 'REALISTIC 8 MONTH OLD NIGHT ROUTINE 😴🍼📚'"
    },
```



*Notes:*
- Drop timing fields (`start_time`, `duration_seconds`) – they’re not needed downstream.
- Do not invent new keys; keep 1:1 with competitor fields for predictability.
- Each `first_frame_description` should reflect the brand/product but keep the competitor staging.

#### Step 2 – Generate first frames (nano banana)

*Goal:* build a visual storyboard.  
*Method:* for each `segments[i]`, call nano_banana (or nano_banana_pro if `contains_brand`) with `segments[i].first_frame_description` as the *only* prompt.  
No closing frames, no extra prompts. Save the resulting URLs back to `standard_ads_segments.first_frame_url`.

#### Step 3 – Generate videos (veo3 / model selected)

*Goal:* create per-segment clips.  
*Method:* pass the entire `segments[i]` object (style, composition, action, music, etc.) as the JSON prompt to the video API (veo3, grok, etc.).  
Because the structure mirrors the competitor analysis, we can reuse the same serializer for every shot.

---

### 3. Data Model Adjustments

1. `standard_ads_projects.segment_plan` ⇒ rename to `{ segments: Array<ShotPrompt> }` where `ShotPrompt` matches the simplified schema above.  
2. `standard_ads_segments.prompt` ⇒ store the same `ShotPrompt`. No extra fields or derived values.
3. Remove closing-frame logic entirely; only store `first_frame_url`.

---
