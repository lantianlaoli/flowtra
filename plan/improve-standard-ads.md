# Standard Ads Competitor Insights Upgrade Plan

## Objectives
- Keep the UI simple: the Assets dashboard just needs to display the enhanced AI report that already mirrors the multi-shot template (duration per shot + timestamps). No new interaction controls are required.
- Standard Ads should automatically interpret the competitor report as “replicate the entire ad” and simply adapt its prompts/segment metadata so generated clips follow the competitor structure without extra toggles or per-shot selection UX.
- Veo3 Fast (and other segmented models) must align their internal 8s (or 6s for Grok) segments with the competitor shots while keeping existing user experiences untouched.

## Workstreams

### 1. Analysis Template Upgrade
- Update `analyzeCompetitorAdWithLanguage` schema to always output `video_duration_seconds` and a `shots[]` collection that matches the example below (start/end timestamps, duration, narrative goal, etc.).
- Persist the new fields on `competitor_ads` (migration adding `video_duration_seconds` column + storing the `shots` array inside `analysis_result`). Existing records should continue to work, but reanalyzing them upgrades the data.
- Ensure the `/api/competitor-ads` routes, Supabase helpers, and type definitions expose the enriched analysis payload so front-end consumers don’t need ad-hoc parsing.

### 2. Assets Dashboard Display (Minimal)
- Reuse the existing competitor cards but add a lightweight “AI analysis” section that renders the structured shots stack (similar to this plan’s example). This is purely informational — no new buttons or selection logic.
- Handle pending/failed analysis states with the current reanalyze button; once the report is available, show total video duration + each shot’s duration so users can understand the competitor flow.

### 3. Standard Ads Workflow Alignment
- When a competitor video is selected, treat the `analysis_result.shots` array as the authoritative segment plan. Standard Ads should continue to behave as “replicate the full ad” — we just feed the multi-shot data into prompt generation.
- Adjust the segmented generation path (`normalizeSegmentPrompts`, `segment_duration_seconds`, and downstream task orchestration) to map competitor shot durations onto the supported segment lengths (8s for Veo3 / Veo3 Fast, 6s for Grok, etc.) without exposing any new UI options.
- If the competitor video duration doesn’t align perfectly with supported buckets, implement internal rounding/merging logic while keeping the user configuration untouched. Log any large mismatches for debugging.

### 4. Verification
- QA flow: upload a competitor video, wait for the refreshed multi-shot report, and confirm Assets shows the timeline summary; then run Standard Ads with Veo3 Fast to verify the backend uses the same shot cadence autonomously.
- Unit-test the helper that maps competitor shot durations to the actual segment structure to ensure we don’t regress Veo3 Fast’s 8s expectations.
- Before delivery, run `pnpm lint && pnpm type-check` and sanity-check a Standard Ads run (Veo3 Fast baseline) to confirm no UI breakage.

## Reference Shot Layout (used across UI + workflow)

```json
{
  "name": "lovevery-example",
  "video_duration_seconds": 47,
  "shots": [
    {
      "audio": "Upbeat acoustic intro music starts.",
      "style": "Realism, candid lifestyle.",
      "action": "Woman opens the door, steps out barefoot/in socks, smiles, picks up the branded box, and walks back inside.",
      "shot_id": 1,
      "subject": "Young woman",
      "end_time": "00:06",
      "start_time": "00:00",
      "composition": "Full body shot framing the door and sidewalk.",
      "narrative_goal": "Establish the arrival of the product and the excitement of receiving it.",
      "duration_seconds": 6,
      "context_environment": "Urban street entrance, brick building with glass door.",
      "generation_guidance": "Show a static shot of a doorstep with a package; a person opens the door to retrieve it enthusiastically.",
      "first_frame_description": "Exterior of a modern apartment building with a package sitting on the doorstep.",
      "ambiance_colour_lighting": "Natural outdoor daylight, soft shadows.",
      "camera_motion_positioning": "Static wide shot."
    },
    {
      "audio": "Music continues, child laughter.",
      "style": "Playful, bright.",
      "action": "Transitions between text and toddlers: one stacking green pegs, another playing with a tissue box toy with mom.",
      "shot_id": 2,
      "subject": "Toddlers playing",
      "end_time": "00:12",
      "start_time": "00:06",
      "composition": "Center-framed subjects focusing on hands and toys.",
      "narrative_goal": "Announce availability and show initial product engagement.",
      "duration_seconds": 6,
      "context_environment": "Indoor living room with wooden furniture.",
      "generation_guidance": "Alternate between text motion graphics and scenes of toddlers interacting with wooden dexterity toys.",
      "first_frame_description": "Text overlay 'The wait is over...' on a white/teal watercolor background.",
      "ambiance_colour_lighting": "Warm indoor lighting, cozy atmosphere.",
      "camera_motion_positioning": "Medium close-ups at child's eye level."
    },
    {
      "audio": "Music building, soft ambient noise.",
      "style": "Bonding, educational.",
      "action": "Father reads; text '14 unique Play Kits' appears; cut to baby doing tummy time tracking a rolling wooden toy.",
      "shot_id": 3,
      "subject": "Father, toddler, baby",
      "end_time": "00:20",
      "start_time": "00:12",
      "composition": "Two-shot on couch; low angle floor shot.",
      "narrative_goal": "Show variety of kits and age appropriateness.",
      "duration_seconds": 8,
      "context_environment": "Living room with sofa; floor mat area.",
      "generation_guidance": "Depict parent-child bonding moment with a book, followed by an infant floor play scene.",
      "first_frame_description": "Father reading a book to a toddler on a grey couch.",
      "ambiance_colour_lighting": "Soft diffuse window light.",
      "camera_motion_positioning": "Static medium shot then low angle for tummy time."
    },
    {
      "audio": "Sound of water splashing mix with music.",
      "style": "Montessori practical life, active play.",
      "action": "Text overlay; girl pumps water in toy sink and washes a cup; joyful expression.",
      "shot_id": 4,
      "subject": "Little girl",
      "end_time": "00:28",
      "start_time": "00:20",
      "composition": "Medium shot focusing on the sink toy.",
      "narrative_goal": "Highlight specific popular product features (functional water sink).",
      "duration_seconds": 8,
      "context_environment": "Kitchen or dining area.",
      "generation_guidance": "Show a child playing with a water-based toy, focusing on the running water action.",
      "first_frame_description": "Text 'Ages 0-3' followed by a girl playing at a toy sink.",
      "ambiance_colour_lighting": "Bright, clean, white and pastel tones.",
      "camera_motion_positioning": "Close-up tracking the water pouring."
    },
    {
      "audio": "Music, clacking wood sounds.",
      "style": "Informative, product-focused.",
      "action": "Toddler pats shape sorter; text 'Now shipping to 25+ countries in Europe'; baby pulls yellow tissue from wooden box.",
      "shot_id": 5,
      "subject": "Toddlers",
      "end_time": "00:36",
      "start_time": "00:28",
      "composition": "Tight framing on toys and hands.",
      "narrative_goal": "Inform about shipping expansion and show more product variety.",
      "duration_seconds": 8,
      "context_environment": "Playroom floor.",
      "generation_guidance": "Close-up montage of hands interacting with wooden geometric toys interspersed with text.",
      "first_frame_description": "Close up of toddler hands on a wooden shape sorter box.",
      "ambiance_colour_lighting": "Natural light, shallow depth of field.",
      "camera_motion_positioning": "Close-up action shots."
    },
    {
      "audio": "Music resolves/fades out.",
      "style": "Warm, concluding.",
      "action": "They play the game together; boy puts token in; cut to Lovevery ending logo and URLs.",
      "shot_id": 6,
      "subject": "Mother and son",
      "end_time": "00:47",
      "start_time": "00:36",
      "composition": "Profile view of parent and child.",
      "narrative_goal": "Final emotional hook of shared play and call to action.",
      "duration_seconds": 11,
      "context_environment": "Sunlit living room with large plants.",
      "generation_guidance": "Scene of parent and child playing a board game on the floor in a sun-drenched room, fading to logo.",
      "first_frame_description": "Mother and son sitting on a white rug playing a Connect-4 style game.",
      "ambiance_colour_lighting": "Sunny, backlit with lens flare vibes.",
      "camera_motion_positioning": "Side angle medium shot."
    }
  ]
}
```
