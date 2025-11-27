## Standard Ads – Competitor Replica Workflow

This document explains how Flowtra turns a competitor video into a tailored `standard_ads_projects` entry. It traces the full pipeline from running `analyzeCompetitorAdWithLanguage` to the segment prompts persisted in Supabase, and walks through a concrete example.

---

### 1. Input Sources

| Input | Description |
| --- | --- |
| **Competitor asset** | Video or image uploaded to `/api/competitor-ads`. Stored in `competitor_ads` along with the AI analysis result. |
| **Brand/Product context** | Selected `user_brand` + `user_product`. Provides official product details, slogans, logo, photos. |
| **User options** | Workflow form choices: model, aspect ratio, language, replica mode, optional ad copy. |

---

### 2. AI Analysis (Competitor Shot Map)

`lib/standard-ads-workflow.ts` → `analyzeCompetitorAdWithLanguage`:

1. Converts the competitor media to base64 (if video) and posts to OpenRouter with a strict JSON schema.
2. Returns:
   - `name`, `video_duration_seconds`
   - `shots[]` array (each with `shot_id`, `start_time`, `end_time`, `duration_seconds`, `first_frame_description`, `subject`, `context_environment`, `action`, `style`, `camera_motion_positioning`, `composition`, `ambiance_colour_lighting`, `audio`, `contains_brand`, `contains_product`)
   - `detected_language`
3. Result is persisted on the `competitor_ads` row only. `standard_ads_projects` does **not** duplicate it anymore.

Example `shots[0]` snippet:

```json
{
  "shot_id": 1,
  "start_time": "00:00",
  "end_time": "00:08",
  "duration_seconds": 8,
  "first_frame_description": "Wide shot in a sunlit kitchen... (45+ words)",
  "subject": "Young parent and smart blender",
  "context_environment": "Modern kitchen island with plants",
  "action": "Parent pours smoothie while toddler watches",
  "style": "Lively lifestyle commercial",
  "camera_motion_positioning": "Slow push-in on medium-wide frame",
  "composition": "Rule-of-thirds hero focus",
  "ambiance_colour_lighting": "Warm natural daylight",
  "audio": "Light acoustic guitar + VO",
  "contains_brand": true,
  "contains_product": true
}
```

---

### 3. Replica Prompt Construction

When the user chooses “Replica mode” the workflow builds a brand-ready prompt:

1. **Base prompt** (AI response) – contains Veo guide breakdown (`description`, `setting`, `camera`, `lighting`, `dialogue`, `music`, `ending`, `other_details`, `language`).
2. **Segment overrides** – `normalizeSegmentPrompts()` iterates for each requested segment:
   - Takes AI-provided `segments[]` if present, else repeats the base prompt.
   - Applies `buildSegmentOverridesFromShot()` to inject competitor shot details (title, goal, first frame description, contains_brand/product flags).
   - Adds voice settings (`voice_type`, `voice_tone`) shared across the ad.
3. **Brand/Product context** – `buildReplicaPrompt()` merges product details (name, slogan, bullet points) and optional user ad copy.
4. `video_prompts` field on `standard_ads_projects` becomes this final JSON (no extra columns needed).

---

### 4. Inserting `standard_ads_segments`

`startSegmentedWorkflow()` handles multi-beat ads:

1. Inserts rows into `standard_ads_segments` with `prompt` = the normalized segment object.
2. Saves `segment_plan = { segments: [...] }`. No `closing_frame_prompt` is stored; closing cues derive from `ending`/`segment_goal`.
3. Persists `segment_status` snapshot (per-segment state machine).

Single-shot (non-segmented) projects skip this and rely solely on `video_prompts`.

---

### 5. Frame Generation

Both `createFrameFromText` and `createFrameFromImage` now call `resolveFrameDescription(segmentPrompt, frameType)`:

```text
first frame → segment.first_frame_prompt (hyper-detailed 45+ words)
closing frame → segment.ending OR segment_goal OR description
```

Those descriptions drive KIE cover/keyframe requests. The `contains_brand`/`contains_product` flags decide whether to route through brand-logo smart frames or product-reference frames.

---

### 6. Example Flow (Replica Mode, 3 Segments)

1. **User input**: selects “GlowCo Vitamin Serum” product, uploads competitor ad “Lumi Skin”.
2. **Analysis result**: 3 shots detected. Stored only on `competitor_ads`.
3. **Prompt building**:
   - Base summary describes a morning routine in a modern bathroom.
   - Segment overrides inherit timing/style from the competitor.
   - Brand context swaps “Lumi Skin” references with “GlowCo” details.
   - Resulting `video_prompts` snippet:

```json
{
  "product_category": "general",
  "target_audience": "adults (18+)",
  "voice_type": "Warm American female narrator",
  "voice_tone": "Confident and calm",
  "segments": [
    {
      "segment_title": "Shot 1 (00:00–00:08)",
      "segment_goal": "Hook with self-care ritual",
      "description": "Mirror shot capturing the GlowCo serum routine...",
      "setting": "Marble vanity lit by morning sun",
      "camera_type": "Medium-wide tracking",
      "camera_movement": "Slow push-in",
      "action": "Talent applies serum and smiles to camera",
      "lighting": "Soft cool daylight",
      "dialogue": "“Every glow has a ritual…”",
      "music": "Gentle synth pads",
      "ending": "Finish on confident smile with product close-up",
      "first_frame_prompt": "Extremely detailed 4-sentence description covering foreground/midground/background...",
      "contains_brand": true,
      "contains_product": true
    },
    { "... segment 2 ..." },
    { "... segment 3 ..." }
  ]
}
```

4. **Segments table**: `standard_ads_segments.prompt` for indices 0–2 stores these entries, enabling frame generation and video tasks to pull consistent instructions.

---

### 7. Key Takeaways

- All competitor analytics now live in `competitor_ads.analysis_result`. `standard_ads_projects` references them via `competitor_ad_id`.
- `video_prompts` is the single source of truth for the ad script, composed of AI base data + competitor overrides + brand context.
- `segment_plan` mirrors the shot structure, so downstream services (monitor-tasks, status API, UI) don’t have to inspect nested music/action fields at the project root.
- `closing_frame_prompt` was removed; closing visuals derive from `ending`/`segment_goal`, keeping the schema lean and more closely aligned with the competitor shot description.

This flow ensures that every replica project faithfully matches the competitor pacing while remaining on-brand for the customer.
