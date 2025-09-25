import { getSupabaseAdmin } from '@/lib/supabase';
import { IMAGE_MODELS } from '@/lib/constants';

interface CharacterAdsProject {
  id: string;
  user_id: string;
  person_image_urls: string[];
  product_image_urls: string[];
  video_duration_seconds: number;
  image_model: string;
  video_model: string;
  status: string;
  current_step: string;
  progress_percentage: number;
  image_analysis_result?: Record<string, unknown>;
  generated_prompts?: Record<string, unknown>;
  generated_image_url?: string;
  generated_video_urls?: string[];
  merged_video_url?: string;
  kie_image_task_id?: string;
  kie_video_task_ids?: string[];
  fal_merge_task_id?: string;
  error_message?: string;
}

interface ProcessResult {
  project: CharacterAdsProject;
  message: string;
  nextStep?: string;
}

// Analyze both person and product images for Character Ads workflow
async function analyzeImages(personImageUrls: string[], productImageUrls: string[]): Promise<Record<string, unknown>> {
  // Use the first person image and first product image for analysis
  const personImageUrl = personImageUrls[0];
  const productImageUrl = productImageUrls[0];

  const systemText = `You will be provided with TWO images for analysis:
1. The FIRST image shows a person/character
2. The SECOND image shows a product

Analyze BOTH images separately and return a combined analysis in the following JSON format:

{
  "type": "character",
  "character": {
    "outfit_style": "(Description of the person's clothing style, accessories, or notable features from the first image)",
    "visual_description": "(A full sentence or two summarizing what the character/person looks like, ignoring the background)"
  },
  "product": {
    "brand_name": "(Name of the brand shown in the product image, if visible or inferable)",
    "color_scheme": [
      {
        "hex": "(Hex code of each prominent color used in the product)",
        "name": "(Descriptive name of the color)"
      }
    ],
    "font_style": "(Describe any font family or style used on the product: serif/sans-serif, bold/thin, etc. Use 'N/A' if no text visible)",
    "visual_description": "(A full sentence or two summarizing what is seen in the product image, ignoring the background)"
  }
}

Important:
- Always analyze the character from the FIRST image and the product from the SECOND image
- Always use "type": "character" since this is for character spokesperson ads
- Provide detailed descriptions that will help generate realistic video prompts featuring the character with the product`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemText },
          { type: 'image_url', image_url: { url: personImageUrl } },
          { type: 'image_url', image_url: { url: productImageUrl } }
        ]
      }
    ],
    max_tokens: 700,
    temperature: 0.2,
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: requestBody
  });

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    // Clean up markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('Cleaned content for parsing:', cleanedContent);
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Failed to parse analysis result:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse image analysis result');
  }
}

// Generate prompts based on analysis and long_ads.md specifications
async function generatePrompts(analysisResult: Record<string, unknown>, videoDurationSeconds: number): Promise<Record<string, unknown>> {
  const videoScenes = videoDurationSeconds / 8; // Each scene is 8 seconds

  // Extract character information to determine appropriate voice type
  const characterInfo = (analysisResult as { character?: { visual_description?: string } })?.character?.visual_description || '';
  const isCharacterMale = characterInfo.toLowerCase().includes('man') || 
                         characterInfo.toLowerCase().includes('male') || 
                         characterInfo.toLowerCase().includes('boy') ||
                         characterInfo.toLowerCase().includes('guy');
  
  const voiceType = isCharacterMale ? 
    'Australian accent, deep male voice' : 
    'Australian accent, deep female voice';

  const systemPrompt = `
UGC Image + Video Prompt Generator 🎥🖼️
Have Scene 0 as the image prompt and Scenes 1 onward are the video prompts

Your task: Create 1 image prompt and ${videoScenes} video prompts as guided by your system guidelines. Scene 0 will be the image prompt, and Scenes 1 onward will be the video prompts.

Use **UGC - style casual realism** principles:
- Everyday realism with authentic, relatable environments
- Amateur iPhone photo/video style
- Slightly imperfect framing and natural lighting
- Candid poses, genuine expressions

For Scene 0 (image prompt):
- At the beginning, use this prefix: "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible"
- Use casual, amateur iPhone selfie style
- UGC, unfiltered, realistic
- IMPORTANT: Keep the character consistent with the reference image analysis

For Scene 1+ (video prompts):
- Each scene is 8 seconds long
- Include dialogue with casual, spontaneous tone (under 150 characters)
- Describe accent and voice style consistently
- Prefix video prompts with: "dialogue, the character in the video says:"
- Use ${voiceType}
- Camera movement: fixed
- Avoid mentioning copyrighted characters
- Don't refer back to previous scenes
- CRITICAL: Maintain character consistency - the same person from the reference image should appear in all scenes
- CRITICAL: Maintain product consistency - focus on the same product throughout all scenes

Return in JSON format:
{
  "scenes": [
    {
      "scene": 0,
      "prompt": {
        "action": "character holds product casually",
        "character": "inferred from image",
        "product": "the product in the reference image",
        "setting": "casual everyday environment",
        "camera": "amateur iPhone selfie, slightly uneven framing, casual vibe",
        "style": "UGC, unfiltered, realistic"
      }
    },
    {
      "scene": 1,
      "prompt": {
        "video_prompt": "dialogue, the character in the video says: [casual dialogue]",
        "voice_type": "Australian accent, deep female voice",
        "emotion": "chill, upbeat",
        "setting": "[casual environment]",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    }
    // ... additional video scenes based on duration
  ]
}`;

  const userPrompt = `Description of the reference images are given below:
${JSON.stringify(analysisResult, null, 2)}

Generate prompts for ${videoScenes} video scenes (8 seconds each) plus 1 image scene.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: requestBody
  });

  if (!response.ok) {
    throw new Error(`Prompt generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    // Clean up markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('Cleaned prompts content for parsing:', cleanedContent);
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Failed to parse prompts result:', content);
    console.error('Prompts parse error:', error);
    throw new Error('Failed to parse generated prompts');
  }
}

// Helper function to get correct parameters for different image models
function getImageModelParameters(model: string): Record<string, unknown> {
  if (model === IMAGE_MODELS.nano_banana) {
    // Nano Banana parameters (google/nano-banana-edit)
    return {
      image_size: "1:1",  // Square format, equivalent to square_hd
      output_format: "png"
    };
  } else if (model === IMAGE_MODELS.seedream) {
    // Seedream V4 parameters (bytedance/seedream-v4-edit)
    return {
      image_size: "square_hd",
      image_resolution: "1K",
      max_images: 1
    };
  } else {
    // Default to Nano Banana format for unknown models
    return {
      image_size: "1:1",
      output_format: "png"
    };
  }
}

// KIE Platform API integration
async function generateImageWithKIE(
  prompt: Record<string, unknown>,
  imageModel: string,
  referenceImages: string[]
): Promise<{ taskId: string }> {
  // Get the correct parameters for this model
  const modelParams = getImageModelParameters(imageModel);

  const payload = {
    model: imageModel,
    input: {
      prompt: JSON.stringify(prompt),
      image_urls: referenceImages,
      ...modelParams  // Spread the model-specific parameters
    },
    // Add callback URL if configured for faster webhook notifications
    ...(process.env.KIE_CHARACTER_ADS_CALLBACK_URL && {
      callBackUrl: process.env.KIE_CHARACTER_ADS_CALLBACK_URL
    })
  };

  console.log('KIE API request payload:', JSON.stringify(payload, null, 2));

  const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  console.log('KIE API response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('KIE API error response:', errorText);
    throw new Error(`KIE image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('KIE API response data:', JSON.stringify(data, null, 2));

  if (data.code !== 200) {
    console.error('KIE API returned error code:', data.code, 'message:', data.msg);
    throw new Error(`KIE image generation failed: ${data.msg}`);
  }

  return { taskId: data.data.taskId };
}

async function generateVideoWithKIE(
  prompt: Record<string, unknown>,
  videoModel: string,
  referenceImageUrl: string
): Promise<{ taskId: string }> {
  // VEO API uses a different structure
  const requestBody = {
    model: videoModel, // e.g., 'veo3_fast' or 'veo3'
    prompt: JSON.stringify(prompt),
    referenceImage: referenceImageUrl,
    durationSeconds: 8,
    audioEnabled: false,
    includeDialogue: false
  };

  const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`KIE video generation failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE video generation failed: ${data.message || 'Unknown error'}`);
  }

  return { taskId: data.data.taskId };
}

async function checkKIEImageTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    }
  });

  if (!response.ok) {
    throw new Error(`KIE image task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE image task status check failed: ${data.msg}`);
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'processing' };
  }

  // Normalize state flags and extract URL robustly (same logic as other features)
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

  let resultJson: Record<string, unknown> = {};
  try {
    resultJson = JSON.parse(taskData.resultJson || '{}');
  } catch {
    resultJson = {};
  }

  const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
    ? (resultJson as { resultUrls?: string[] }).resultUrls
    : undefined;
  const responseUrls = Array.isArray(taskData.response?.resultUrls)
    ? (taskData.response.resultUrls as string[])
    : undefined;
  const flatUrls = Array.isArray(taskData.resultUrls)
    ? (taskData.resultUrls as string[])
    : undefined;
  const result_url = (directUrls || responseUrls || flatUrls)?.[0];

  const isSuccess = (state && state.toLowerCase() === 'success') || successFlag === 1 || (!!result_url && (state === undefined));
  const isFailed = (state && state.toLowerCase() === 'failed') || successFlag === 2 || successFlag === 3;

  if (isSuccess) {
    return { 
      status: 'completed', 
      result_url,
      error: undefined
    };
  }
  if (isFailed) {
    return { 
      status: 'failed', 
      result_url: undefined,
      error: taskData.failMsg || taskData.errorMessage || 'Image generation failed'
    };
  }

  // Still processing
  return { status: 'processing' };
}

async function checkKIEVideoTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    }
  });

  if (!response.ok) {
    throw new Error(`KIE video task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE video task status check failed: ${data.msg || 'Unknown error'}`);
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'processing' };
  }

  // Use the same robust logic as other features - prioritize successFlag
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;

  // Extract video URL from multiple possible locations
  let result_url: string | undefined;
  if (taskData.outputUrl) {
    result_url = taskData.outputUrl;
  } else if (taskData.response?.resultUrls?.[0]) {
    result_url = taskData.response.resultUrls[0];
  }

  if (successFlag === 1) {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (successFlag === 2 || successFlag === 3) {
    return {
      status: 'failed',
      result_url: undefined,
      error: taskData.errorMessage || taskData.failureReason || 'Video generation failed'
    };
  } else if (state === 'success') {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (state === 'failed') {
    return {
      status: 'failed',
      result_url: undefined,
      error: taskData.errorMessage || taskData.failureReason || 'Video generation failed'
    };
  } else {
    // Still processing (waiting, running, or other states)
    return { status: 'processing' };
  }
}

// fal.ai video merging integration
async function mergeVideosWithFal(videoUrls: string[]): Promise<{ taskId: string }> {
  const { fal } = await import("@fal-ai/client");

  // Configure fal client
  fal.config({
    credentials: process.env.FAL_KEY
  });

  try {
    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: {
        video_urls: videoUrls,
        target_fps: 30,
        resolution: "landscape_16_9" // HD landscape resolution for better quality
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`Merge queue update: ${update.status}`);
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      }
    });

    return {
      taskId: result.requestId
    };
  } catch (error) {
    console.error('fal.ai merge videos error:', error);
    throw new Error(`Video merging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check fal.ai task status
async function checkFalTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const { fal } = await import("@fal-ai/client");

  fal.config({
    credentials: process.env.FAL_KEY
  });

  try {
    const result = await fal.queue.status("fal-ai/ffmpeg-api/merge-videos", {
      requestId: taskId
    });

    if (result.status === 'COMPLETED') {
      return {
        status: result.status,
        result_url: ((result as unknown as Record<string, unknown>).data as Record<string, { url?: string }>)?.video?.url
      };
    } else {
      return {
        status: result.status,
        error: (result as unknown as Record<string, unknown>).error as string
      };
    }
  } catch (error) {
    console.error('fal.ai status check error:', error);
    throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function processCharacterAdsProject(
  project: CharacterAdsProject,
  step: string
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin();

  try {
    switch (step) {
      case 'analyze_images': {
        // Step 1: Analyze uploaded images
        console.log('Starting image analysis for project:', project.id);

        // Analyze person and product images separately
        const analysisResult = await analyzeImages(project.person_image_urls, project.product_image_urls);

        // Update project with analysis results
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            image_analysis_result: analysisResult,
            status: 'generating_prompts',
            current_step: 'generating_prompts',
            progress_percentage: 20,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        return {
          project: updatedProject,
          message: 'Image analysis completed successfully',
          nextStep: 'generate_prompts'
        };
      }

      case 'generate_prompts': {
        // Step 2: Generate prompts for all scenes
        console.log('Generating prompts for project:', project.id);

        if (!project.image_analysis_result) {
          throw new Error('Image analysis result not found');
        }

        const prompts = await generatePrompts(
          project.image_analysis_result,
          project.video_duration_seconds
        );

        // Create scene records
        const videoScenes = project.video_duration_seconds / 8;
        const sceneRecords = [];

        // Scene 0 - Image
        sceneRecords.push({
          project_id: project.id,
          scene_number: 0,
          scene_type: 'image',
          scene_prompt: (prompts.scenes as Array<{prompt: unknown}>)[0].prompt,
          status: 'pending'
        });

        // Scene 1+ - Videos
        for (let i = 1; i <= videoScenes; i++) {
          sceneRecords.push({
            project_id: project.id,
            scene_number: i,
            scene_type: 'video',
            scene_prompt: (prompts.scenes as Array<{prompt: unknown}>)[i].prompt,
            status: 'pending'
          });
        }

        // Insert scene records
        const { error: sceneError } = await supabase
          .from('character_ads_scenes')
          .insert(sceneRecords);

        if (sceneError) throw sceneError;

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            generated_prompts: prompts,
            status: 'generating_image',
            current_step: 'generating_image',
            progress_percentage: 40,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        return {
          project: updatedProject,
          message: 'Prompts generated successfully',
          nextStep: 'generate_image'
        };
      }

      case 'generate_image': {
        // Step 3: Generate Scene 0 image using KIE
        console.log('Generating image for project:', project.id);

        if (!project.generated_prompts) {
          throw new Error('Generated prompts not found');
        }

        const imagePrompt = (project.generated_prompts?.scenes as Array<{prompt: unknown}>)?.[0]?.prompt;
        const referenceImages = [...project.person_image_urls, ...project.product_image_urls];

        // Map short model name to full KIE model name
        const fullModelName = IMAGE_MODELS[project.image_model as keyof typeof IMAGE_MODELS] || project.image_model;

        const { taskId } = await generateImageWithKIE(
          imagePrompt as Record<string, unknown>,
          fullModelName,
          referenceImages
        );

        // Update project and scene
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            kie_image_task_id: taskId,
            status: 'generating_image',
            progress_percentage: 50,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // Update scene 0
        await supabase
          .from('character_ads_scenes')
          .update({
            kie_task_id: taskId,
            status: 'generating'
          })
          .eq('project_id', project.id)
          .eq('scene_number', 0);

        return {
          project: updatedProject,
          message: 'Image generation started',
          nextStep: 'check_image_status'
        };
      }

      case 'check_image_status': {
        // Check KIE image generation status
        if (!project.kie_image_task_id) {
          throw new Error('Image task ID not found');
        }

        const status = await checkKIEImageTaskStatus(project.kie_image_task_id);

        if (status.status === 'completed' && status.result_url) {
          // Image generation completed
          const { data: updatedProject, error } = await supabase
            .from('character_ads_projects')
            .update({
              generated_image_url: status.result_url,
              status: 'generating_videos',
              current_step: 'generating_videos',
              progress_percentage: 60,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (error) throw error;

          // Update scene 0
          await supabase
            .from('character_ads_scenes')
            .update({
              generated_url: status.result_url,
              status: 'completed'
            })
            .eq('project_id', project.id)
            .eq('scene_number', 0);

          return {
            project: updatedProject,
            message: 'Image generation completed',
            nextStep: 'generate_videos'
          };
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Image generation failed');
        }

        // Still processing
        return {
          project,
          message: 'Image generation in progress'
        };
      }

      case 'generate_videos': {
        // Step 4: Generate video scenes using KIE
        console.log('Generating videos for project:', project.id);

        if (!project.generated_image_url) {
          throw new Error('Generated image not found - required for video generation');
        }

        const videoScenes = project.video_duration_seconds / 8;
        const videoTaskIds = [];

        // Start video generation for each scene
        for (let i = 1; i <= videoScenes; i++) {
          const videoPrompt = (project.generated_prompts?.scenes as Array<{prompt: unknown}>)?.[i]?.prompt;

          const { taskId } = await generateVideoWithKIE(
            videoPrompt as Record<string, unknown>,
            project.video_model,
            project.generated_image_url // Use generated image as reference
          );

          videoTaskIds.push(taskId);

          // Update scene status
          await supabase
            .from('character_ads_scenes')
            .update({
              kie_task_id: taskId,
              status: 'generating'
            })
            .eq('project_id', project.id)
            .eq('scene_number', i);
        }

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            kie_video_task_ids: videoTaskIds,
            status: 'generating_videos',
            progress_percentage: 70,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        return {
          project: updatedProject,
          message: 'Video generation started for all scenes',
          nextStep: 'check_videos_status'
        };
      }

      case 'check_videos_status': {
        // Check all video generation status
        if (!project.kie_video_task_ids || project.kie_video_task_ids.length === 0) {
          throw new Error('Video task IDs not found');
        }

        const videoUrls = [];
        let allCompleted = true;

        for (let i = 0; i < project.kie_video_task_ids.length; i++) {
          const taskId = project.kie_video_task_ids[i];
          const status = await checkKIEVideoTaskStatus(taskId);

          if (status.status === 'completed' && status.result_url) {
            videoUrls.push(status.result_url);

            // Update scene status
            await supabase
              .from('character_ads_scenes')
              .update({
                generated_url: status.result_url,
                status: 'completed'
              })
              .eq('project_id', project.id)
              .eq('scene_number', i + 1);

          } else if (status.status === 'failed') {
            throw new Error(`Video ${i + 1} generation failed: ${status.error}`);
          } else {
            allCompleted = false;
          }
        }

        if (allCompleted) {
          // Check if we need to merge videos (only for duration > 8 seconds)
          if (project.video_duration_seconds === 8) {
            // For 8-second videos, use the single generated video directly
            const { data: updatedProject, error } = await supabase
              .from('character_ads_projects')
              .update({
                generated_video_urls: videoUrls,
                merged_video_url: videoUrls[0], // Use the single video directly
                status: 'completed',
                current_step: 'completed',
                progress_percentage: 100,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            return {
              project: updatedProject,
              message: 'Video generation completed (no merge needed for 8s)'
            };
          } else {
            // For longer videos, proceed with merging
            const { data: updatedProject, error } = await supabase
              .from('character_ads_projects')
              .update({
                generated_video_urls: videoUrls,
                status: 'merging_videos',
                current_step: 'merging_videos',
                progress_percentage: 85,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            return {
              project: updatedProject,
              message: 'All videos generated, starting merge',
              nextStep: 'merge_videos'
            };
          }
        }

        // Still processing
        return {
          project,
          message: 'Video generation in progress'
        };
      }

      case 'merge_videos': {
        // Step 5: Merge videos using fal.ai
        console.log('Merging videos for project:', project.id);

        if (!project.generated_video_urls || project.generated_video_urls.length === 0) {
          throw new Error('Generated videos not found');
        }

        const { taskId } = await mergeVideosWithFal(project.generated_video_urls);

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            fal_merge_task_id: taskId,
            status: 'merging_videos',
            progress_percentage: 90,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        return {
          project: updatedProject,
          message: 'Video merging started',
          nextStep: 'check_merge_status'
        };
      }

      case 'check_merge_status': {
        // Check fal.ai video merge status
        if (!project.fal_merge_task_id) {
          throw new Error('fal.ai merge task ID not found');
        }

        console.log('Checking fal.ai merge status for project:', project.id);

        const status = await checkFalTaskStatus(project.fal_merge_task_id);

        if (status.status === 'COMPLETED' && status.result_url) {
          // Merge completed successfully
          const { data: updatedProject, error } = await supabase
            .from('character_ads_projects')
            .update({
              merged_video_url: status.result_url,
              status: 'completed',
              current_step: 'completed',
              progress_percentage: 100,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (error) throw error;

          return {
            project: updatedProject,
            message: 'Video merging completed successfully'
          };
        } else if (status.status === 'FAILED' || status.error) {
          throw new Error(status.error || 'Video merging failed');
        }

        // Still processing
        return {
          project,
          message: 'Video merging in progress'
        };
      }

      default: {
        throw new Error(`Unknown step: ${step}`);
      }
    }

  } catch (error) {
    console.error(`Error processing step ${step}:`, error);

    // Update project with error
    await supabase
      .from('character_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id);

    throw error;
  }
}