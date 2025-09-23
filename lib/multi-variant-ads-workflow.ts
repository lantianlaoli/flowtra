import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export interface StartV2Request {
  imageUrl: string;
  userId: string;
  elementsData: Record<string, unknown>;
  elementsCount?: number;
  adCopy?: string;
  textWatermark?: string;
  textWatermarkLocation?: string;
  generateVideo?: boolean;
  videoModel: 'veo3' | 'veo3_fast';
  imageModel?: string;
  watermark?: {
    text: string;
    location: string;
  };
  imageSize?: string;
  photoOnly?: boolean;
}

interface V2Result {
  success: boolean;
  instanceId?: string;
  itemIds?: string[];
  error?: string;
  details?: string;
}

export async function startV2Items(request: StartV2Request): Promise<V2Result> {
  try {
    const supabase = getSupabaseAdmin();

    // Create project record in multi_variant_ads_projects table
    const { data: project, error: insertError } = await supabase
      .from('multi_variant_ads_projects')
      .insert({
        user_id: request.userId,
        original_image_url: request.imageUrl,
        elements_data: request.elementsData,
        video_model: request.videoModel,
        status: 'pending',
        current_step: 'waiting',
        progress_percentage: 0,
        credits_cost: request.photoOnly ? 5 : 10,
        watermark_text: request.watermark?.text,
        watermark_location: request.watermark?.location,
        cover_image_size: request.imageSize,
        photo_only: request.photoOnly || false,
        project_type: 'multi_variant'
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

    // Start the workflow
    try {
      await startMultiVariantWorkflow(project.id, request);
    } catch (workflowError) {
      console.error('Workflow start error:', workflowError);
      await supabase
        .from('multi_variant_ads_projects')
        .update({
          status: 'failed',
          error_message: workflowError instanceof Error ? workflowError.message : 'Workflow start failed'
        })
        .eq('id', project.id);

      return {
        success: false,
        error: 'Failed to start workflow',
        details: workflowError instanceof Error ? workflowError.message : 'Unknown error'
      };
    }

    return {
      success: true,
      instanceId: project.id,
      itemIds: [project.id]
    };

  } catch (error) {
    console.error('StartV2Items error:', error);
    return {
      success: false,
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function startMultiVariantWorkflow(projectId: string, request: StartV2Request): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // Start cover generation immediately for multi-variant
    console.log('🎨 Starting multi-variant cover generation...');
    const coverTaskId = await generateMultiVariantCover(request);

    // Update project with cover task ID
    await supabase
      .from('multi_variant_ads_projects')
      .update({
        cover_task_id: coverTaskId,
        status: 'generating_cover',
        current_step: 'generating_cover',
        progress_percentage: 30,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log('✅ Multi-variant workflow started successfully');

  } catch (error) {
    console.error('Multi-variant workflow error:', error);
    throw error;
  }
}

async function generateMultiVariantCover(request: StartV2Request): Promise<string> {
  const requestBody = {
    imageUrls: [request.imageUrl],
    elementsData: request.elementsData,
    watermarkText: request.watermark?.text || "",
    watermarkLocation: request.watermark?.location || "",
    size: request.imageSize || "1024x1024"
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/nanoBanana', {
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

export async function getV2ItemsStatus(ids: string[]): Promise<{success: boolean; items?: Record<string, unknown>[]; error?: string}> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: projects, error } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .in('id', ids);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      items: projects || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function generateVideoDesignFromCover(coverImageUrl: string, elementsData: Record<string, unknown>, projectId: string): Promise<{
  description: string;
  setting: string;
  camera_type: string;
  camera_movement: string;
  action: string;
  lighting: string;
  dialogue: string;
  music: string;
  ending: string;
  other_details: string;
}> {
  const supabase = getSupabaseAdmin();

  // Get project details
  const { data: project } = await supabase
    .from('multi_variant_ads_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error('Project not found');
  }

  // Generate creative video prompt using AI
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
          content: `Create a professional video advertisement prompt for this product based on the cover image and elements data: ${JSON.stringify(elementsData)}

Generate a structured creative prompt with these elements:
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
      description: "Professional product advertisement showcase",
      setting: "Modern studio environment",
      camera_type: "Close-up product shot",
      camera_movement: "Smooth circular pan",
      action: "Product demonstration and feature highlights",
      lighting: "Soft professional lighting with accent highlights",
      dialogue: "Compelling product benefits and call-to-action",
      music: "Upbeat commercial background music",
      ending: "Strong call-to-action with brand logo",
      other_details: "High-quality commercial production style"
    };
  }
}