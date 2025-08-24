import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { httpRequestWithRetry } from '@/lib/httpRequest';

const SYSTEM_MESSAGE = `You are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned image and video content for product marketing.

Task
Generate an image prompt and a video prompt (return both as part of a structured JSON output).

Provide a concise caption.

Produce a clear creative summary based on the user's reference and intent.

All video prompts must be a JSON object containing all required fields (see below). Optional fields should be included if provided by the user.

Output Requirements
Respond ONLY with the following structured JSON:

{
  "image_prompt": "...",
  "video_prompt": {
    "description": "...",
    "setting": "...",
    "camera_type": "...",
    "camera_movement": "...",
    "action": "...",
    "lighting": "...",
    "dialogue": "...",    
    "music": "...",       
    "ending": "...",
    "other_details": "..."
  },
  "caption": "...",
  "creative_summary": "...",
  "aspect_ratio": "...",
  "video_model": "..."
}

Guidance
Always use the product description and creative brief as provided by the user.

Reference any attached images for style, color, and composition cues.

Include these essential details in every prompt:

Product type, brand, required style (e.g. energetic, minimal), mood, and key messaging.

For videos, always start with the product already in the frame and detail the following:

description: What is in view and what is happening.

setting: The environment or scene background.

camera_type/camera settings: E.g., DSLR, wide angle, dolly shot, etc.

camera_movement: Should be simple unless otherwise specified (e.g., static, slow pan).

action: What is the product doing?

lighting: Specify mood and type (e.g., natural light, studio, moody).

other_details: Any unique props, timing, or visual effects.

dialogue: Always include a spoken narration script in this field that describes the product benefits in a friendly, engaging tone, as if a person is explaining it on camera. Keep it natural and under 80 words.
music: Suggest a background music style that matches the mood.
ending: Include a clear call-to-action or closing scene description.

Make sure scenes are visually rich and avoid generic or vague descriptions.

Integrate dynamic backgrounds and contextual elements where appropriate (e.g., lively city, cozy home, vibrant outdoors).

Adhere strictly to the described brand identity and target visual appeal.

If the user requests revisions (e.g. aspect ratio, visual model, specifics about mood or action), always adapt the new prompt accordingly.

Constraints
The caption must be clear, impactful, and under 30 words.

Do NOT include personal opinions, extra metadata, or unrelated commentary—respond with structured JSON only.

All outputs must comply with brand, safety, and appropriateness guidelines of the platform.`;

export async function POST(request: NextRequest) {
  try {
    const { productDescription } = await request.json();

    if (!productDescription) {
      return NextResponse.json({ error: 'Product description is required' }, { status: 400 });
    }

    const prompt = `This is the initial creative brief:
Create an advertisement

Description of the product:
${productDescription}

Use the Think tool to double check your output`;

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    const textModel = process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o';

    const requestBody = JSON.stringify({
      model: textModel,
      messages: [
        {
          role: 'system',
          content: SYSTEM_MESSAGE
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'creative_brief',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              image_prompt: {
                type: 'string',
                description: 'Detailed description for the cover image generation'
              },
              video_prompt: {
                type: 'object',
                properties: {
                  description: {
                    type: 'string',
                    description: 'What is in view and what is happening'
                  },
                  setting: {
                    type: 'string',
                    description: 'The environment or scene background'
                  },
                  camera_type: {
                    type: 'string',
                    description: 'Camera settings (e.g., DSLR, wide angle, dolly shot)'
                  },
                  camera_movement: {
                    type: 'string',
                    description: 'Camera movement (e.g., static, slow pan)'
                  },
                  action: {
                    type: 'string',
                    description: 'What is the product doing'
                  },
                  lighting: {
                    type: 'string',
                    description: 'Lighting mood and type (e.g., natural light, studio, moody)'
                  },
                  dialogue: {
                    type: 'string',
                    description: 'Spoken narration script describing product benefits (under 80 words)'
                  },
                  music: {
                    type: 'string',
                    description: 'Background music style that matches the mood'
                  },
                  ending: {
                    type: 'string',
                    description: 'Call-to-action or closing scene description'
                  },
                  other_details: {
                    type: 'string',
                    description: 'Any unique props, timing, or visual effects'
                  }
                },
                required: ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'dialogue', 'music', 'ending', 'other_details'],
                additionalProperties: false
              },
              caption: {
                type: 'string',
                description: 'Clear, impactful caption under 30 words'
              },
              creative_summary: {
                type: 'string',
                description: 'Clear creative summary based on the user reference and intent'
              },
              aspect_ratio: {
                type: 'string',
                description: 'Recommended aspect ratio for the content'
              },
              video_model: {
                type: 'string',
                description: 'Recommended video generation model'
              }
            },
            required: ['image_prompt', 'video_prompt', 'caption', 'creative_summary', 'aspect_ratio', 'video_model'],
            additionalProperties: false
          }
        }
      }
    });

    let response: Response;
    let data: { choices: Array<{ message: { content: string } }> };

    try {
      // Try fetch first
      response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Flowtra',
          'User-Agent': 'Flowtra/1.0'
        },
        body: requestBody
      }, 2, 10000); // 2 retries, 10 second timeout

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenRouter API error:', response.status, errorData);
        return NextResponse.json(
          { error: 'Failed to generate prompts', details: errorData },
          { status: response.status }
        );
      }

      data = await response.json();
    } catch (fetchError) {
      console.warn('Fetch failed, trying native HTTPS:', fetchError);
      
      // Fallback to native HTTPS
      try {
        const result = await httpRequestWithRetry('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'Flowtra',
            'User-Agent': 'Flowtra/1.0'
          },
          body: requestBody
        }, 2);

        if (result.status !== 200) {
          console.error('OpenRouter API error (native):', result.status, result.data);
          return NextResponse.json(
            { error: 'Failed to generate prompts', details: result.data },
            { status: result.status }
          );
        }

        data = JSON.parse(result.data);
      } catch (nativeError) {
        console.error('Both fetch and native HTTPS failed:', nativeError);
        throw fetchError; // Throw original error for consistent handling
      }
    }

    const content = data.choices[0]?.message?.content || '';

    try {
      // With JSON Schema, the content should already be valid JSON
      const parsedContent = JSON.parse(content);
      return NextResponse.json({
        success: true,
        prompts: parsedContent
      });
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Raw content:', content);
      return NextResponse.json(
        { error: 'Failed to parse generated prompts', details: content },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Prompt generation error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}