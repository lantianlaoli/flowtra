import { extractAIGatewayTextContent, sendAIGatewayChat } from '@/lib/ai-gateway';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import {
  buildAvatarGeneratedPrompts,
  normalizeAvatarPromptDuration
} from '@/lib/project-agent/avatar-script-planning';

type AvatarSelection = {
  id: string;
  name: string;
  photoUrl: string;
};

type ProductSelection = {
  id: string;
  name: string;
  photoUrls: string[];
};

type AvatarPromptScene = {
  sceneIndex: number;
  prompt: Record<string, unknown>;
};

export type ProjectAgentAvatarDraftResult = {
  scriptSource: string;
  imagePrompt: string;
  scenes: AvatarPromptScene[];
  totalDurationSeconds: number;
};

const fallbackScenePrompt = (dialog: string) => ({
  subject: 'Confident spokesperson from the selected avatar',
  context_environment: 'Clean creator-style setup that feels native to short-form ads',
  action: 'Speak directly to camera with precise hand gestures and strong product conviction',
  style: 'Polished UGC ad with direct response energy',
  camera_motion_positioning: 'Stable medium shot with gentle handheld realism',
  composition: 'Avatar centered with strong face visibility and clear focal separation',
  ambiance_color_lighting: 'Bright commercial lighting with crisp contrast',
  audio: 'Natural room tone under clean spoken dialogue',
  dialog
});

const parseJsonObject = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

export async function draftProjectAgentAvatarPrompts(input: {
  avatar: AvatarSelection;
  product?: ProductSelection | null;
  userIntentText?: string | null;
  durationSeconds: number;
  language?: string | null;
  aspectRatio: '16:9' | '9:16';
}): Promise<ProjectAgentAvatarDraftResult> {
  const languageCode = (input.language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode) || 'English';
  const promptContext = input.userIntentText?.trim() || '';

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        `Avatar name: ${input.avatar.name}`,
        `Preferred total runtime: about ${input.durationSeconds}s.`,
        `Language: ${languageName}.`,
        'Output is already portrait by default, so do not mention aspect ratio in the image prompt.',
        input.product
          ? `Product name: ${input.product.name}.`
          : 'No product is selected. Keep this as a talking-head spokesperson script.',
        promptContext
          ? `User guidance or selling points: ${promptContext}`
          : 'No explicit script provided. Write the script yourself.'
      ].join('\n')
    },
    {
      type: 'image_url',
      image_url: { url: input.avatar.photoUrl }
    }
  ];

  (input.product?.photoUrls || []).slice(0, 4).forEach((photoUrl) => {
    userContent.push({
      type: 'image_url',
      image_url: { url: photoUrl }
    });
  });

  const response = await sendAIGatewayChat({
    model: process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
    temperature: 0.4,
    max_tokens: 2200,
    response_format: {
      type: 'json_object'
    },
    messages: [
      {
        role: 'system',
        content: [
          'You are writing an avatar ad draft for Flowtra.',
          `Write in ${languageName}.`,
          'Return strict JSON with keys: script_source, image_prompt, scenes.',
          'Each scene item must contain scene_index, duration_seconds, and prompt.',
          'prompt must be an object with keys: subject, context_environment, action, style, camera_motion_positioning, composition, ambiance_color_lighting, audio, dialog, duration_seconds.',
          'Keep the visual direction grounded in the uploaded avatar and product photos.',
          'dialog must feel spoken, concise, and conversion-oriented.',
          'For Kling 3.0, split the spoken script into natural segments between 3 and 15 seconds each.',
          'Choose as many segments as needed so the spoken pacing feels natural.',
          'image_prompt must describe a single spoken-to-camera talking-head cover frame matching the script and selected assets.',
          'Do not mention aspect ratio, resolution, or camera spec boilerplate in image_prompt.',
          'Prefer direct-response creator language like speaking to camera, talking-head setup, natural light, clean background, product in hand when applicable.'
        ].join(' ')
      },
      {
        role: 'user',
        content: userContent
      }
    ]
  }, {
    timeoutMs: 60000,
    maxRetries: 3,
    httpReferer: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    xTitle: 'Flowtra'
  });

  const text = extractAIGatewayTextContent(response.choices?.[0]?.message?.content) || '';
  const parsed = parseJsonObject(text);

  const scenesRaw = Array.isArray(parsed?.scenes) ? parsed.scenes as Array<Record<string, unknown>> : [];
  const parsedScenes = scenesRaw.map((source, index) => {
    const promptRecord: Record<string, unknown> = (source.prompt && typeof source.prompt === 'object')
      ? source.prompt as Record<string, unknown>
      : { ...fallbackScenePrompt('') };
    const dialog = typeof promptRecord.dialog === 'string'
      ? promptRecord.dialog.trim()
      : '';
    const promptDurationSeconds = promptRecord.duration_seconds;

    return {
      sceneIndex: index + 1,
      prompt: {
        ...fallbackScenePrompt(dialog),
        ...promptRecord,
        duration_seconds: normalizeAvatarPromptDuration(
          source.duration_seconds ?? promptDurationSeconds
        )
      }
    };
  });

  const scriptSource = typeof parsed?.script_source === 'string' && parsed.script_source.trim()
    ? parsed.script_source.trim()
    : parsedScenes
        .map((scene) => typeof scene.prompt.dialog === 'string' ? scene.prompt.dialog.trim() : '')
        .filter(Boolean)
        .join(' ');

  const imagePrompt = typeof parsed?.image_prompt === 'string' && parsed.image_prompt.trim()
    ? parsed.image_prompt.trim()
    : input.product
      ? `${input.avatar.name} speaking directly to camera in a creator-style talking-head setup, naturally holding ${input.product.name}, clean lifestyle background, natural light.`
      : `${input.avatar.name} speaking directly to camera in a creator-style talking-head setup, clean background, natural light.`;

  const normalizedDraft = buildAvatarGeneratedPrompts({
    imagePrompt,
    scriptSource,
    existingScenes: parsedScenes,
    language: input.language,
    avatarName: input.avatar.name,
    productName: input.product?.name
  });

  return {
    scriptSource,
    imagePrompt: normalizedDraft.generatedPrompts.image_prompt,
    scenes: normalizedDraft.scenes,
    totalDurationSeconds: normalizedDraft.totalDurationSeconds
  };
}
