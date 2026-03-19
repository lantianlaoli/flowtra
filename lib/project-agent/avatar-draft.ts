import { extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';

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
  const sceneCount = Math.max(1, Math.ceil(input.durationSeconds / 8));
  const languageCode = (input.language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode) || 'English';
  const promptContext = input.userIntentText?.trim() || '';

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        `Avatar name: ${input.avatar.name}`,
        `Duration: ${input.durationSeconds}s split into ${sceneCount} scenes of 8s.`,
        `Language: ${languageName}.`,
        `Aspect ratio: ${input.aspectRatio}.`,
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

  const response = await sendOpenRouterChat({
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
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
          `scenes must contain exactly ${sceneCount} items.`,
          'Each scene item must contain scene_index and prompt.',
          'prompt must be an object with keys: subject, context_environment, action, style, camera_motion_positioning, composition, ambiance_color_lighting, audio, dialog.',
          'Keep the visual direction grounded in the uploaded avatar and product photos.',
          'dialog must feel spoken, concise, and conversion-oriented.',
          'image_prompt must describe a single strong cover frame matching the script and visuals.'
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

  const text = extractOpenRouterTextContent(response.choices?.[0]?.message?.content) || '';
  const parsed = parseJsonObject(text);

  const scenesRaw = Array.isArray(parsed?.scenes) ? parsed.scenes as Array<Record<string, unknown>> : [];
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const source = scenesRaw[index] || {};
    const prompt = (source.prompt && typeof source.prompt === 'object')
      ? source.prompt as Record<string, unknown>
      : fallbackScenePrompt('');
    const dialog = typeof prompt.dialog === 'string'
      ? prompt.dialog.trim()
      : '';

    return {
      sceneIndex: index + 1,
      prompt: {
        ...fallbackScenePrompt(dialog),
        ...prompt
      }
    };
  });

  const scriptSource = typeof parsed?.script_source === 'string' && parsed.script_source.trim()
    ? parsed.script_source.trim()
    : scenes
        .map((scene) => typeof scene.prompt.dialog === 'string' ? scene.prompt.dialog.trim() : '')
        .filter(Boolean)
        .join(' ');

  const imagePrompt = typeof parsed?.image_prompt === 'string' && parsed.image_prompt.trim()
    ? parsed.image_prompt.trim()
    : `Confident avatar spokesperson cover for ${input.product?.name || 'a talking-head ad'}, ${input.aspectRatio}, clean creator composition, scroll-stopping expression.`;

  return {
    scriptSource,
    imagePrompt,
    scenes
  };
}
