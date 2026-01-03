/**
 * Test TikTok Video Analysis with bytedance-seed/seed-1.6-flash
 *
 * Purpose: Fetch a TikTok video URL and analyze it using OpenRouter's bytedance-seed/seed-1.6-flash model
 * to determine if the model supports video understanding/analysis capabilities.
 *
 * Usage: pnpm tsx scripts/test-tiktok-video-analysis.ts
 *
 * Environment Variables Required:
 * - RAPID_API_KEY: RapidAPI key for TikTok video downloads
 * - OPENROUTER_API_KEY: OpenRouter API key
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const TIKTOK_VIDEO_URL = 'https://www.tiktok.com/@taylorswift/video/7558098574555254046';

const RAPIDAPI_CONFIG = {
  baseUrl: 'https://tiktok-api23.p.rapidapi.com/api/download/video',
  headers: {
    'x-rapidapi-key': process.env.RAPID_API_KEY || '9cd8f50679mshfb82068c03dab30p1e59c1jsne0326ef0c992',
    'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
  }
};

const OPENROUTER_CONFIG = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'bytedance-seed/seed-1.6-flash', // Test model (video generation model)
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type StructuredContentChunk =
  | string
  | {
      type?: string;
      text?: unknown;
      content?: unknown;
    };

interface TikTokApiResponse {
  play?: string;
  play_watermark?: string;
  error?: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message: string;
    code?: string;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract text content from various response formats
 * Source: lib/competitor-ugc-replication-workflow.ts:1572-1585
 */
const getChunkText = (chunk: StructuredContentChunk): string => {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (chunk && typeof chunk === 'object') {
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    if (typeof chunk.content === 'string') {
      return chunk.content;
    }
  }
  return '';
};

/**
 * Extract structured content from API response
 * Source: lib/competitor-ugc-replication-workflow.ts:1546-1570
 */
const extractStructuredContent = (content: unknown): string | null => {
  if (!content) return null;
  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const combined = content
      .map(chunk => getChunkText(chunk))
      .filter(Boolean)
      .join('\n')
      .trim();

    return combined || null;
  }

  if (typeof content === 'object') {
    const maybeText = getChunkText(content as StructuredContentChunk);
    if (maybeText) {
      return maybeText;
    }
  }

  return null;
};

// =============================================================================
// TIKTOK API FUNCTIONS
// =============================================================================

/**
 * Fetch TikTok video download URL using RapidAPI
 */
async function fetchTikTokVideo(videoUrl: string): Promise<string> {
  console.log('\n📱 [TikTok API] Fetching video download URL...');
  console.log(`   Video URL: ${videoUrl}`);

  const apiUrl = `${RAPIDAPI_CONFIG.baseUrl}?url=${encodeURIComponent(videoUrl)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: RAPIDAPI_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as TikTokApiResponse;

    if (data.error) {
      throw new Error(`TikTok API returned error: ${data.error}`);
    }

    if (!data.play) {
      throw new Error('TikTok API did not return video URL (missing "play" field)');
    }

    console.log('✅ [TikTok API] Video URL fetched successfully');
    console.log(`   CDN URL: ${data.play.substring(0, 100)}...`);

    return data.play;
  } catch (error) {
    console.error('❌ [TikTok API] Failed to fetch video:', error);
    throw error;
  }
}

// =============================================================================
// OPENROUTER VIDEO ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Build JSON schema for competitor ad analysis
 * Same schema as analyzeCompetitorAdWithLanguage()
 */
function buildAnalysisSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "competitor_analysis_with_language_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A concise, descriptive name for this competitor ad (e.g., 'lovevery-playkits-delivery', 'nike-running-motivation'). Use lowercase with hyphens, keep it under 40 characters, make it searchable and memorable."
          },
          video_duration_seconds: {
            type: "number",
            description: "Total runtime of the analyzed advertisement in seconds"
          },
          shots: {
            type: "array",
            minItems: 1,
            description: "Ordered breakdown of every shot/scene with timestamps and creative cues",
            items: {
              type: "object",
              properties: {
                shot_id: {
                  type: "number",
                  description: "Sequential shot number starting at 1"
                },
                start_time: {
                  type: "string",
                  description: "Shot start timestamp formatted as MM:SS"
                },
                end_time: {
                  type: "string",
                  description: "Shot end timestamp formatted as MM:SS"
                },
                duration_seconds: {
                  type: "number",
                  description: "Shot duration in seconds (round to nearest second)"
                },
                first_frame_description: {
                  type: "string",
                  description: "Visual description of the opening frame for this shot"
                },
                subject: {
                  type: "string",
                  description: "People, products, or hero objects featured in the shot"
                },
                context_environment: {
                  type: "string",
                  description: "Location, environment, and background details"
                },
                action: {
                  type: "string",
                  description: "What happens during the shot"
                },
                style: {
                  type: "string",
                  description: "Visual style or mood for the shot"
                },
                camera_motion_positioning: {
                  type: "string",
                  description: "Camera movement and framing specifics for the shot"
                },
                composition: {
                  type: "string",
                  description: "Shot type/framing (close-up, medium, wide, etc.)"
                },
                ambiance_colour_lighting: {
                  type: "string",
                  description: "Lighting scheme, palette, and atmosphere"
                },
                audio: {
                  type: "string",
                  description: "Voiceover, dialogue, SFX, or music cues"
                },
                contains_brand: {
                  type: "boolean",
                  description: "Does this shot show brand logo, packaging, brand name, or brand signage?"
                },
                contains_product: {
                  type: "boolean",
                  description: "Does this shot show physical product(s) that would need to be replaced?"
                }
              },
              required: [
                "shot_id", "start_time", "end_time", "duration_seconds",
                "first_frame_description", "subject", "context_environment",
                "action", "style", "camera_motion_positioning", "composition",
                "ambiance_colour_lighting", "audio", "contains_brand", "contains_product"
              ],
              additionalProperties: false
            }
          },
          detected_language: {
            type: "string",
            description: "Primary language detected in the video (2-letter code: 'en', 'zh', 'es', etc.)",
            enum: ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "no", "da", "fi", "pl", "ru", "el", "tr", "cs", "ro", "zh", "ur", "pa"]
          }
        },
        required: ["name", "video_duration_seconds", "shots", "detected_language"],
        additionalProperties: false
      }
    }
  };
}

/**
 * Build prompt for video analysis
 * Same prompt as analyzeCompetitorAdWithLanguage()
 */
function buildAnalysisPrompt(): string {
  return `📺 COMPETITOR AD MULTI-SHOT ANALYSIS

You are analyzing a competitor advertisement video.

TASK: Break down this ad into a structured shot-by-shot timeline with language detection. This is a PURE ANALYSIS - do not consider any other product or make recommendations.

OUTPUT REQUIREMENTS:

1. **name** (广告名称): Generate a concise, descriptive name for this ad
   - Format: lowercase-with-hyphens (e.g., "lovevery-playkits-delivery", "nike-running-motivation")
   - Keep it under 40 characters
   - Make it searchable and memorable
   - Include brand/product keywords if visible

2. **video_duration_seconds** (广告总时长): Return the precise total runtime in seconds
   - Use the video's metadata or calculate from timestamps
   - Round to nearest second

3. **shots** (多镜头拆解): Break down the ad into sequential shots/scenes
   - Each shot represents a distinct visual beat or narrative moment
   - Typical shot duration: 6-11 seconds
   - Cover the ENTIRE runtime with NO gaps

   For EACH shot, provide:
   - \`shot_id\` - Sequential number starting at 1
   - \`start_time\` - Format: MM:SS (e.g., "00:06")
   - \`end_time\` - Format: MM:SS
   - \`duration_seconds\` - Shot duration (round to nearest second)
   - \`first_frame_description\` - Hyper-detailed 3-4 sentence description (minimum 45 words) of the opening frame, covering foreground, midground, background, lighting cues, and focal hierarchy. Mention left/center/right placement, props, wardrobe, and depth cues so another artist could recreate it perfectly.
   - \`subject\` - People, products, or hero objects featured
   - \`context_environment\` - Location, environment, and background details
   - \`action\` - What happens during the shot
   - \`style\` - Visual style or mood
   - \`camera_motion_positioning\` - Camera movement and framing
   - \`composition\` - Shot type/framing (close-up, medium, wide, etc.)
   - \`ambiance_colour_lighting\` - Lighting scheme, palette, and atmosphere
   - \`audio\` - Voiceover, dialogue, SFX, or music cues
   - \`contains_brand\` - Boolean: Does this shot show brand logo, packaging, brand name, or brand signage?
   - \`contains_product\` - Boolean: Does this shot show physical product(s) that would need to be replaced?

   Shot requirements:
   - Timestamps must be strictly increasing (no gaps, no overlaps)
   - Durations must sum to total video duration
   - Be extremely detailed and specific
   - Think like you're creating a storyboard for recreation

   **BRAND/PRODUCT DETECTION RULES:**
   - \`contains_brand: true\` if the shot shows:
     * Brand logo or wordmark
     * Product packaging with brand name
     * Brand signage or storefront
     * Any visual brand identifier
   - \`contains_product: true\` if the shot shows:
     * Physical product(s) that are the focus or subject
     * Product being used, demonstrated, or displayed
     * Product in hand, on table, or in scene
   - Both can be true simultaneously (e.g., branded product packaging)
   - Both can be false (e.g., pure lifestyle/environment shots)

4. **detected_language** (检测语言): Detect the PRIMARY language
   - Check text overlays, subtitles, captions
   - Listen to voiceover, dialogue, or narration
   - Consider cultural and regional context
   - Return ONLY the short code: 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa'
   - Default to "en" if unclear or mostly visual

EXAMPLE OUTPUT STRUCTURE:
{
  "name": "lovevery-playkits-delivery",
  "video_duration_seconds": 47,
  "shots": [
    {
      "shot_id": 1,
      "start_time": "00:00",
      "end_time": "00:06",
      "duration_seconds": 6,
      "first_frame_description": "Exterior of a modern apartment building with a package on the doorstep",
      "subject": "Young woman",
      "context_environment": "Urban street entrance, brick building with glass door",
      "action": "Opens door, picks up package, walks inside",
      "style": "Realism, candid lifestyle",
      "camera_motion_positioning": "Static wide shot",
      "composition": "Full body shot",
      "ambiance_colour_lighting": "Natural daylight, soft shadows",
      "audio": "Upbeat acoustic music starts",
      "contains_brand": true,
      "contains_product": true
    }
  ],
  "detected_language": "en"
}`;
}

/**
 * Analyze video using OpenRouter's bytedance-seed/seed-1.6-flash model
 */
async function analyzeVideoWithBytedanceSeed(videoUrl: string): Promise<void> {
  console.log('\n🤖 [OpenRouter] Sending video to bytedance-seed/seed-1.6-flash...');
  console.log(`   Model: ${OPENROUTER_CONFIG.model}`);
  console.log(`   Video URL: ${videoUrl.substring(0, 100)}...`);

  const analysisPrompt = buildAnalysisPrompt();

  // Simplified request - remove strict JSON schema due to model limitations
  const requestBody = {
    model: OPENROUTER_CONFIG.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: analysisPrompt
          },
          {
            type: 'video_url' as const,
            video_url: {
              url: videoUrl
            }
          }
        ]
      }
    ]
  };

  console.log('\n📤 Request body preview:');
  console.log(JSON.stringify({
    model: requestBody.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: analysisPrompt.substring(0, 100) + '...' },
          { type: 'video_url', video_url: { url: videoUrl.substring(0, 80) + '...' } }
        ]
      }
    ]
  }, null, 2));

  try {
    const startTime = Date.now();
    const response = await fetch(OPENROUTER_CONFIG.apiUrl, {
      method: 'POST',
      headers: OPENROUTER_CONFIG.headers,
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  API call completed in ${duration}ms`);

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ [OpenRouter] API error (${response.status})`);
      console.error(`   Response: ${responseText.substring(0, 500)}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    // Parse response
    let data: OpenRouterResponse;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error('❌ [OpenRouter] Failed to parse JSON response');
      console.error(`   Raw response: ${responseText.substring(0, 500)}...`);
      throw new Error('Invalid JSON response from OpenRouter');
    }

    // Check for API-level errors
    if (data.error) {
      console.error('❌ [OpenRouter] API returned error');
      console.error(`   Error: ${data.error.message}`);
      console.error(`   Code: ${data.error.code || 'N/A'}`);
      console.error(`   Full error response:`);
      console.error(JSON.stringify(data.error, null, 2));
      throw new Error(`OpenRouter error: ${data.error.message}`);
    }

    // Extract content
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      console.error('❌ [OpenRouter] Response missing content field');
      console.error(`   Full response: ${JSON.stringify(data, null, 2)}`);
      throw new Error('OpenRouter response missing content');
    }

    const normalizedContent = extractStructuredContent(rawContent);
    if (!normalizedContent) {
      console.error('❌ [OpenRouter] Could not extract structured content');
      console.error(`   Raw content: ${JSON.stringify(rawContent, null, 2)}`);
      throw new Error('Failed to extract structured content from response');
    }

    // Parse analysis result
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(normalizedContent) as Record<string, unknown>;
    } catch (error) {
      console.error('❌ [OpenRouter] Failed to parse analysis JSON');
      console.error(`   Normalized content: ${normalizedContent.substring(0, 500)}...`);
      throw new Error('Invalid analysis JSON format');
    }

    // Success! Display results
    console.log('\n✅ [SUCCESS] Video analysis completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 ANALYSIS RESULT:\n');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate expected fields
    const hasName = typeof analysis.name === 'string';
    const hasDuration = typeof analysis.video_duration_seconds === 'number';
    const hasShots = Array.isArray(analysis.shots);
    const hasLanguage = typeof analysis.detected_language === 'string';

    console.log('\n✨ SCHEMA VALIDATION:');
    console.log(`   ✓ name: ${hasName ? '✅' : '❌'}`);
    console.log(`   ✓ video_duration_seconds: ${hasDuration ? '✅' : '❌'}`);
    console.log(`   ✓ shots: ${hasShots ? `✅ (${(analysis.shots as unknown[]).length} shots)` : '❌'}`);
    console.log(`   ✓ detected_language: ${hasLanguage ? `✅ (${analysis.detected_language})` : '❌'}`);

    const allValid = hasName && hasDuration && hasShots && hasLanguage;
    if (allValid) {
      console.log('\n🎉 CONCLUSION: bytedance-seed/seed-1.6-flash SUPPORTS video analysis!');
      console.log('   The model successfully analyzed the video and returned structured data.');
    } else {
      console.log('\n⚠️  CONCLUSION: Partial support or unexpected response format.');
      console.log('   Some expected fields are missing or have incorrect types.');
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ [ERROR] ${error.message}`);

      // Check for common error patterns
      if (error.message.includes('Unsupported') || error.message.includes('not supported')) {
        console.log('\n🔍 CONCLUSION: bytedance-seed/seed-1.6-flash does NOT support video analysis.');
        console.log('   This model is likely video-generation-only (text-to-video).');
      } else if (error.message.includes('model not found') || error.message.includes('404')) {
        console.log('\n🔍 CONCLUSION: Model identifier may be incorrect or unavailable via OpenRouter.');
        console.log('   Verify the correct model ID at https://openrouter.ai/models');
      }
    }
    throw error;
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  TEST: TikTok Video Analysis with bytedance-seed/seed-1.6-flash  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('⚠️  NOTE: bytedance-seed/seed-1.6-flash is a VIDEO GENERATION model.');
  console.log('   This test will determine if it also supports video ANALYSIS.');
  console.log('');

  try {
    // Step 1: Fetch TikTok video URL
    const videoUrl = await fetchTikTokVideo(TIKTOK_VIDEO_URL);

    // Step 2: Analyze video directly with OpenRouter (no base64 conversion needed)
    await analyzeVideoWithBytedanceSeed(videoUrl);

    console.log('\n✅ TEST COMPLETED SUCCESSFULLY\n');
    process.exit(0);

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║                         TEST FAILED                            ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n');
    process.exit(1);
  }
}

// Run the test
main();
