import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS } from '@/lib/constants';

export interface StartWorkflowRequest {
  imageUrl: string;
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast';
  imageModel?: 'auto' | 'nano_banana' | 'seedream';
  watermark?: {
    text: string;
    location: string;
  };
  watermarkLocation?: string;
  imageSize?: string;
  elementsCount?: number;
  photoOnly?: boolean;
}

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  error?: string;
  details?: string;
}

export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Convert 'auto' videoModel to a specific model
    const actualVideoModel: 'veo3' | 'veo3_fast' = request.videoModel === 'auto' ? 'veo3_fast' : request.videoModel;

    // Create project record in standard_ads_projects table
    const { data: project, error: insertError } = await supabase
      .from('standard_ads_projects')
      .insert({
        user_id: request.userId,
        original_image_url: request.imageUrl,
        video_model: actualVideoModel,
        status: 'processing',
        current_step: 'describing',
        progress_percentage: 10,
        credits_cost: request.photoOnly ? 5 : 10, // 5 for photo-only, 10 for video
        watermark_text: request.watermark?.text,
        watermark_location: request.watermark?.location || request.watermarkLocation,
        cover_image_size: request.imageSize,
        photo_only: request.photoOnly || false,
        project_type: 'single_video'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        success: false,
        error: 'Failed to create project record',
        details: insertError.message
      };
    }

    // Start the AI workflow by calling image description
    try {
      await startAIWorkflow(project.id, request);
    } catch (workflowError) {
      console.error('Workflow start error:', workflowError);
      // Update project status to failed
      await supabase
        .from('standard_ads_projects')
        .update({
          status: 'failed',
          error_message: workflowError instanceof Error ? workflowError.message : 'Workflow start failed'
        })
        .eq('id', project.id);

      return {
        success: false,
        error: 'Failed to start AI workflow',
        details: workflowError instanceof Error ? workflowError.message : 'Unknown error'
      };
    }

    return {
      success: true,
      projectId: project.id
    };

  } catch (error) {
    console.error('StartWorkflowProcess error:', error);
    return {
      success: false,
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function startAIWorkflow(projectId: string, request: StartWorkflowRequest): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Describe the image
    console.log('🔍 Starting image description...');
    const description = await describeImage(request.imageUrl);

    // Step 2: Generate creative prompts
    console.log('✨ Generating creative prompts...');
    const prompts = await generateCreativePrompts(description);

    // Step 3: Start cover generation
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request);

    // Update project with cover task ID and prompts
    await supabase
      .from('standard_ads_projects')
      .update({
        cover_task_id: coverTaskId,
        video_prompts: prompts,
        product_description: { description },
        current_step: 'generating_cover',
        progress_percentage: 30,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log('✅ AI workflow started successfully');

  } catch (error) {
    console.error('AI workflow error:', error);
    throw error;
  }
}

async function describeImage(imageUrl: string): Promise<string> {
  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this product image in detail for advertising purposes. Focus on key features, benefits, and selling points that would appeal to potential customers.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Image description failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateCreativePrompts(description: string): Promise<Record<string, unknown>> {
  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: `Based on this product description: "${description}"

Generate a creative video advertisement prompt with these elements:
- description: Main scene description
- setting: Location/environment
- camera_type: Type of camera shot
- camera_movement: Camera movement style
- action: What happens in the scene
- lighting: Lighting setup
- dialogue: Spoken content/voiceover
- music: Music style
- ending: How the ad concludes
- other_details: Additional creative elements

Return as JSON format.`
        }
      ]
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Prompt generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch {
    // If JSON parsing fails, create a structured response
    return {
      description: content,
      setting: "Professional studio",
      camera_type: "Close-up",
      camera_movement: "Smooth pan",
      action: "Product showcase",
      lighting: "Soft professional lighting",
      dialogue: "Highlighting key benefits",
      music: "Upbeat commercial music",
      ending: "Call to action",
      other_details: "High-quality commercial style"
    };
  }
}

async function generateCover(imageUrl: string, prompts: Record<string, unknown>, request: StartWorkflowRequest): Promise<string> {
  // Get the actual image model to use
  const actualImageModel = getActualImageModel(request.imageModel || 'auto');
  const kieModelName = IMAGE_MODELS[actualImageModel];

  const requestBody = {
    model: kieModelName,
    callBackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/webhooks/standard-ads`,
    input: {
      prompt: prompts.description || "Professional product advertisement image",
      image_urls: [imageUrl],
      output_format: "png",
      image_size: request.imageSize === 'auto' ? 'auto' : (request.imageSize || 'auto')
    }
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Cover generation failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate cover');
  }

  return data.data.taskId;
}