import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, jsonSchema, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const model = openrouter.chat(process.env.OPENROUTER_MODEL || 'bytedance-seed/seed-1.6-flash');

const emptySchema = jsonSchema({ type: 'object', properties: {}, required: [] });

type SessionState = {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: 'collecting' | 'creating' | 'awaiting_review' | 'regenerating_image' | 'generating_videos' | 'completed';
  cloneReferenceVideo?: {
    id: string;
    name?: string | null;
    sourceType?: 'creator' | 'competitor_ad';
    sourceId?: string | null;
    videoUrl?: string | null;
    cdnUrl?: string | null;
    language?: string | null;
    analysisSummary?: string | null;
    keyShots?: string[] | null;
    detectedCharacter?: string | null;
    detectedProduct?: string | null;
  };
  cloneReplacementDraft?: {
    status: 'idle' | 'generating' | 'ready' | 'failed';
    error?: string | null;
    selectedAvatar?: { id: string; name: string; photoUrl?: string | null };
    selectedProduct?: { id: string; name: string; photoUrl?: string | null; brandName?: string | null };
    scenes: Array<{
      sceneIndex: number;
      imagePrompt: string;
      videoPrompt: {
        shots: Array<{
          id: number;
          time_range: string;
          subject: string;
          context_environment: string;
          action: string;
          style: string;
          camera_motion_positioning: string;
          composition: string;
          ambiance_colour_lighting: string;
          audio: string;
          dialogue: string;
          language?: string;
        }>;
      };
      sourceSummary?: string | null;
    }>;
  };
  cloneExecution?: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'merging' | 'completed' | 'failed';
    model?: 'veo3' | 'veo3_fast' | 'seedance_1_5_pro';
    duration?: string;
    creditsCost?: number;
    error?: string | null;
    segments?: Array<{
      segmentIndex: number;
      status: string;
      firstFrameUrl?: string | null;
      videoUrl?: string | null;
      errorMessage?: string | null;
    }>;
  } | null;
  avatar?: { id: string; name: string; photoUrl: string };
  brand?: { id: string; name: string };
  product?: { id: string; name: string; brandId?: string | null; brandName?: string | null };
  customDialogue?: string;
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  imageModel?: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro';
  videoModel?: 'veo3_fast';
  projectId?: string;
  generatedPrompts?: Record<string, unknown> | null;
  imagePrompt?: string | null;
  generatedImageUrl?: string | null;
  pendingUpdatedPrompts?: Record<string, unknown> | null;
};

const DEFAULT_STATE: SessionState = {
  intent: 'avatar_ads',
  step: 'collecting',
  language: 'en',
  videoDurationSeconds: 16,
  videoAspectRatio: '16:9',
  imageModel: 'nano_banana_pro',
  videoModel: 'veo3_fast'
};

type ProductWithBrand = {
  id: string;
  product_name: string;
  brand_id?: string | null;
  brand?: { brand_name?: string | null } | Array<{ brand_name?: string | null }> | null;
};

type AvatarOption = {
  id: string;
  avatar_name: string;
  photo_url: string | null;
};

const buildSystemPrompt = (state: SessionState) => {
  const avatarLabel = state.avatar ? `${state.avatar.name} (${state.avatar.id})` : 'not selected';
  const productLabel = state.product ? `${state.product.name} (${state.product.id})` : 'not selected';
  const brandLabel = state.brand ? `${state.brand.name} (${state.brand.id})` : 'not selected';
  const dialogueLabel = state.customDialogue?.trim() ? 'provided' : 'not provided';
  const referenceVideoLabel = state.cloneReferenceVideo
    ? `${state.cloneReferenceVideo.name || 'selected video'} (${state.cloneReferenceVideo.id})`
    : 'not selected';
  const referenceVideoSummary = state.cloneReferenceVideo?.analysisSummary || 'not available';
  const referenceVideoShots = Array.isArray(state.cloneReferenceVideo?.keyShots) && state.cloneReferenceVideo?.keyShots.length > 0
    ? state.cloneReferenceVideo?.keyShots.join(' | ')
    : 'not available';
  const cloneDraftStatus = state.cloneReplacementDraft?.status || 'idle';
  const cloneDraftSceneCount = Array.isArray(state.cloneReplacementDraft?.scenes) ? state.cloneReplacementDraft.scenes.length : 0;
  const cloneDraftSelection = [
    state.cloneReplacementDraft?.selectedAvatar?.name ? `avatar=${state.cloneReplacementDraft.selectedAvatar.name}` : null,
    state.cloneReplacementDraft?.selectedProduct?.name ? `product=${state.cloneReplacementDraft.selectedProduct.name}` : null
  ].filter(Boolean).join(', ') || 'none';
  const cloneExecutionPhase = state.cloneExecution?.phase || 'idle';
  const cloneExecutionProjectId = state.cloneExecution?.projectId || 'none';
  const cloneExecutionSegments = Array.isArray(state.cloneExecution?.segments) ? state.cloneExecution?.segments.length : 0;
  const projectLabel = state.projectId || 'none';

  return `You are Flowtra Project Agent. You orchestrate Flowtra video workflows through a conversational flow.

Supported workflows:
- avatar_ads (create spokesperson-style avatar videos)
- competitor_ugc_replication (primary use case: clone viral videos with your product)
- motion_swap (collect requirements, then hand off to existing workflow entrypoints)

Current configured required inputs for avatar_ads:
- Character (avatar)
- Either:
  - Product-based mode: brand + product
  - Talking-head mode: custom dialogue/script (product not required)
- Video duration (8-80s, multiple of 8)
- Aspect ratio (16:9 or 9:16)
- Language (default en)

Workflow rules:
- Always identify/confirm the target workflow intent first.
- If the user is just chatting (greeting, Q&A, small talk), answer naturally and do not force workflow steps.
- In small-talk turns, do NOT append workflow menus or call-to-action lists unless the user explicitly asks about capabilities or creating videos.
- Every turn must end with a natural-language assistant reply to the user (never stay silent).
- Collect missing required inputs before execution.
- Confirm collected inputs before project creation.
- For avatar_ads, use createAvatarAdsProject only after user confirmation.
- Use setCustomDialogue when user provides or updates a custom script.
- After project creation, wait for prompts/image to be ready (status awaiting_review) before edits.
- Use syncProjectStatus to fetch the latest project data.
- For image prompt edits, use regenerateImage with a new imagePrompt.
- For video prompt edits, use updatePromptEdits with a full updatedPrompts object.
- When the user confirms prompts, use confirmVideoGeneration.
- If the user picks competitor_ugc_replication, run the executable clone flow end-to-end in chat:
  - Step 1: choose reference video.
  - Step 2: choose replacement avatar and/or product.
  - Step 3: review replaced prompts and click Generate.
  - Step 4: review first frames per scene, regenerate frames if needed, then click Generate Final Video.
  - Keep replies progress-aware and concise at each phase.
- For competitor_ugc_replication, the sequence must follow the existing manual flow:
  1) First ask user to select ONE reference video.
  2) Do not ask for product before a reference video is selected.
  3) Do not ask for brand (brand step has been removed from clone flow).
  4) Ask for product only as a later step.
  5) In step 1 responses, never mention "brand" as a requirement.
  6) If Reference Video is already selected in current state, do not ask for reference video again; continue to the next required step.
  7) After Reference Video is selected, your first sentence must explicitly confirm you understood the video structure using the provided summary and key shots.
  8) In the same reply, naturally recommend replacement directions and ask user to choose replacement avatar/person and replacement product.
  9) Keep this as a normal conversational reply; do not rely on UI labels or step headers in the wording.
  10) If cloneReplacementDraft.status is "ready", reply naturally that replacement prompts are prepared from the reference structure, briefly summarize selected replacements, and ask the user to review/edit Scene and shot-level fields (subject, background, action, style, camera, composition, lighting, audio, dialogue) in Step 3.
  11) If cloneReplacementDraft.status is "generating", tell the user you are preparing prompt drafts now and to wait briefly.
  12) If cloneReplacementDraft.status is "failed", explain the failure briefly and ask whether to retry draft generation.
  13) If user asks to regenerate this step, acknowledge you are re-running the same replacement step with current selections and respond as a normal assistant turn (no technical wording like "draft schema").
- If the user picks motion_swap, collect requirements and guide to the existing workflow entrypoint.
- When user asks what workflows are available, always list ALL three:
  1) Avatar Ads
  2) Clone Viral Videos (Competitor UGC Replication)
  3) Motion Swap

Current state:
- Avatar: ${avatarLabel}
- Brand: ${brandLabel}
- Product: ${productLabel}
- Reference Video: ${referenceVideoLabel}
- Reference Summary: ${referenceVideoSummary}
- Reference Key Shots: ${referenceVideoShots}
- Clone Draft Status: ${cloneDraftStatus}
- Clone Draft Selections: ${cloneDraftSelection}
- Clone Draft Scenes: ${cloneDraftSceneCount}
- Clone Execution Project: ${cloneExecutionProjectId}
- Clone Execution Phase: ${cloneExecutionPhase}
- Clone Execution Segments: ${cloneExecutionSegments}
- Custom Dialogue: ${dialogueLabel}
- Duration: ${state.videoDurationSeconds ?? 'unset'}
- Aspect: ${state.videoAspectRatio ?? 'unset'}
- Language: ${state.language ?? 'unset'}
- Project ID: ${projectLabel}
- Step: ${state.step ?? 'unknown'}

Stay concise, ask one clarification at a time, and prefer explicit confirmations before running generation tools.
`;
};

const getOrigin = (request: Request) => new URL(request.url).origin;
const resolveSessionTable = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { error } = await supabase.from('project_agent_sessions').select('id').limit(1);
  if (!error) return 'project_agent_sessions';
  if (error.code === 'PGRST205') return 'avatar_ads_agent_sessions';
  throw error;
};

const mergeState = (state: SessionState, patch: Partial<SessionState>) => ({
  ...state,
  ...patch,
  avatar: patch.avatar ?? state.avatar,
  brand: patch.brand ?? state.brand,
  product: patch.product ?? state.product,
  customDialogue: patch.customDialogue ?? state.customDialogue,
  cloneReferenceVideo: patch.cloneReferenceVideo ?? state.cloneReferenceVideo,
  cloneReplacementDraft: patch.cloneReplacementDraft ?? state.cloneReplacementDraft,
  cloneExecution: patch.cloneExecution ?? state.cloneExecution,
  pendingUpdatedPrompts: patch.pendingUpdatedPrompts ?? state.pendingUpdatedPrompts
});

const normalizeUIMessage = (message: unknown, fallbackId: string): UIMessage => {
  const raw = (message ?? {}) as {
    id?: string;
    role?: UIMessage['role'];
    parts?: Array<{ type?: string; text?: string }>;
    content?: string;
  };

  const normalizedParts = Array.isArray(raw.parts)
    ? raw.parts
        .filter((part) => part?.type === 'text')
        .map((part) => ({ type: 'text' as const, text: part.text ?? '' }))
    : [];

  const parts = normalizedParts.length > 0
    ? normalizedParts
    : [{ type: 'text' as const, text: typeof raw.content === 'string' ? raw.content : '' }];

  return {
    id: (typeof raw.id === 'string' && raw.id.trim().length > 0) ? raw.id : fallbackId,
    role: raw.role ?? 'user',
    parts
  };
};

const messageText = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();

const dedupeMessages = (messages: UIMessage[]) => {
  // Keep latest payload per id so streamed final chunks are not lost.
  const byIdMap = new Map<string, UIMessage>();
  for (const message of messages) {
    byIdMap.set(message.id, message);
  }
  const byId = Array.from(byIdMap.values());

  const collapsed: UIMessage[] = [];
  for (const message of byId) {
    const previous = collapsed[collapsed.length - 1];
    if (!previous) {
      collapsed.push(message);
      continue;
    }

    if (previous.role === 'assistant' && message.role === 'assistant') {
      const prevText = messageText(previous);
      const nextText = messageText(message);
      if (prevText && prevText === nextText) {
        continue;
      }
    }

    collapsed.push(message);
  }

  return collapsed;
};

const mergeAvatarOptions = (userAvatars: AvatarOption[]) => {
  const merged: AvatarOption[] = [
    ...SYSTEM_AVATARS.map((avatar) => ({
      id: avatar.id,
      avatar_name: avatar.avatar_name,
      photo_url: avatar.photo_url
    })),
    ...userAvatars
  ];

  const seen = new Set<string>();
  return merged.filter((avatar) => {
    if (seen.has(avatar.id)) return false;
    seen.add(avatar.id);
    return true;
  });
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, sessionId, id } = body as {
      message?: UIMessage;
      sessionId?: string;
      id?: string;
    };
    const resolvedSessionId = (sessionId && sessionId.trim()) || (id && id.trim()) || '';

    if (!resolvedSessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sessionTable = await resolveSessionTable(supabase);

    // Schema verified via Supabase MCP (2026-01-13):
    // project_agent_sessions columns: id, user_id, project_id, intent, status, state, messages, created_at, updated_at
    const { data: existingSession, error: fetchError } = await supabase
      .from(sessionTable)
      .select('*')
      .eq('id', resolvedSessionId)
      .maybeSingle();

    if (fetchError) {
      console.error('[Project Agent] Failed to load session:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load session', details: fetchError.message },
        { status: 500 }
      );
    }

    if (existingSession && existingSession.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let sessionState: SessionState = {
      ...DEFAULT_STATE,
      ...(existingSession?.state as SessionState | undefined)
    };
    const storedMessagesRaw = Array.isArray(existingSession?.messages) ? existingSession.messages : [];
    const storedMessages = storedMessagesRaw.map((storedMessage: unknown, index: number) =>
      normalizeUIMessage(storedMessage, `stored-${index}`)
    );
    const normalizedIncomingMessage = normalizeUIMessage(message, `user-${Date.now()}`);
    const conversationMessages = dedupeMessages([
      ...storedMessages,
      ...(
        storedMessages.some((storedMessage: UIMessage) => storedMessage.id === normalizedIncomingMessage.id)
          ? []
          : [normalizedIncomingMessage]
      )
    ]);

    if (!existingSession) {
      const { error: insertError } = await supabase
        .from(sessionTable)
        .insert({
          id: resolvedSessionId,
          user_id: userId,
          intent: 'avatar_ads',
          state: sessionState,
          messages: conversationMessages,
          status: 'active',
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Project Agent] Failed to create session:', insertError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
    } else {
      const { error: updateError } = await supabase
        .from(sessionTable)
        .update({
          state: sessionState,
          messages: conversationMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedSessionId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[Project Agent] Failed to update session:', updateError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
    }

    const persistSession = async (patch: Partial<SessionState>) => {
      sessionState = mergeState(sessionState, patch);
      const { error: updateError } = await supabase
        .from(sessionTable)
        .update({
          state: sessionState,
          project_id: sessionState.projectId ?? null,
          intent: sessionState.intent ?? 'avatar_ads',
          messages: conversationMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedSessionId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[Project Agent] Failed to persist session:', updateError);
      }
    };

    const origin = getOrigin(request);

    const modelMessages = await convertToModelMessages(conversationMessages);

    const result = await streamText({
      model,
      system: buildSystemPrompt(sessionState),
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      tools: {
        listAvatars: tool({
          description: 'List available avatars for the user',
          inputSchema: emptySchema,
          execute: async () => {
            // Schema verified via Supabase MCP (2026-01-13):
            // user_avatars columns: id, user_id, photo_url, file_name, is_active, created_at, updated_at, avatar_name
            const { data, error } = await supabase
              .from('user_avatars')
              .select('id, avatar_name, photo_url')
              .eq('user_id', userId)
              .eq('is_active', true)
              .order('created_at', { ascending: false });

            if (error) {
              throw new Error('Failed to load avatars');
            }

            const userAvatars: AvatarOption[] = (data ?? []).map((avatar) => ({
              id: avatar.id,
              avatar_name: avatar.avatar_name || 'Unnamed Avatar',
              photo_url: avatar.photo_url
            }));
            const avatars = mergeAvatarOptions(userAvatars);

            return { avatars };
          }
        }),
        listBrandsAndProducts: tool({
          description: 'List brands and products for the user',
          inputSchema: emptySchema,
          execute: async () => {
            // Schema verified via Supabase MCP (2026-01-13):
            // user_brands columns: id, user_id, brand_name, brand_logo_url, created_at, updated_at
            const { data: brands, error: brandsError } = await supabase
              .from('user_brands')
              .select('id, brand_name')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (brandsError) {
              throw new Error('Failed to load brands');
            }

            // Schema verified via Supabase MCP (2026-01-13):
            // user_products columns: id, user_id, product_name, created_at, updated_at, brand_id
            const { data: products, error: productsError } = await supabase
              .from('user_products')
              .select('id, product_name, brand_id')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (productsError) {
              throw new Error('Failed to load products');
            }

            return { brands: brands ?? [], products: products ?? [] };
          }
        }),
        selectAvatar: tool({
          description: 'Select an avatar by name or id',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              avatarId: { type: 'string' },
              avatarName: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ avatarId, avatarName }) => {
            const { data: avatars, error } = await supabase
              .from('user_avatars')
              .select('id, avatar_name, photo_url')
              .eq('user_id', userId)
              .eq('is_active', true)
              .order('created_at', { ascending: false });

            if (error || !avatars) {
              throw new Error('Failed to load avatars');
            }

            const normalizedName = avatarName?.toLowerCase().trim();
            const mergedAvatars = mergeAvatarOptions((avatars ?? []).map((avatar) => ({
              id: avatar.id,
              avatar_name: avatar.avatar_name || 'Unnamed Avatar',
              photo_url: avatar.photo_url ?? null
            })));
            const match = mergedAvatars.find((avatar) => {
              if (avatarId) return avatar.id === avatarId;
              if (!normalizedName) return false;
              return avatar.avatar_name?.toLowerCase().includes(normalizedName);
            });

            if (!match) {
              return { success: false, message: 'No matching avatar found.' };
            }
            if (!match.photo_url) {
              return { success: false, message: 'Selected avatar is missing a photo URL.' };
            }

            await persistSession({
              avatar: {
                id: match.id,
                name: match.avatar_name || 'Unnamed Avatar',
                photoUrl: match.photo_url
              }
            });

            return { success: true, avatar: match };
          }
        }),
        selectProduct: tool({
          description: 'Select a product by name or id, optionally using brand name for disambiguation',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' },
              brandName: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ productId, productName, brandName }) => {
            const { data, error } = await supabase
              .from('user_products')
              .select('id, product_name, brand_id, brand:user_brands(brand_name)')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (error || !data) {
              throw new Error('Failed to load products');
            }

            const products = data as ProductWithBrand[];

            const normalizedProduct = productName?.toLowerCase().trim();
            const normalizedBrand = brandName?.toLowerCase().trim();
            const match = products.find((product) => {
              if (productId) return product.id === productId;
              if (!normalizedProduct) return false;
              const nameMatches = product.product_name?.toLowerCase().includes(normalizedProduct);
              if (!nameMatches) return false;
              if (!normalizedBrand) return true;
              const brandName = Array.isArray(product.brand)
                ? product.brand[0]?.brand_name
                : product.brand?.brand_name;
              return brandName?.toLowerCase().includes(normalizedBrand);
            });

            if (!match) {
              return { success: false, message: 'No matching product found.' };
            }

            const matchedBrandName = Array.isArray(match.brand)
              ? match.brand[0]?.brand_name
              : match.brand?.brand_name;

            await persistSession({
              product: {
                id: match.id,
                name: match.product_name,
                brandId: match.brand_id ?? null,
                brandName: matchedBrandName ?? null
              },
              brand: match.brand_id && matchedBrandName
                ? { id: match.brand_id, name: matchedBrandName }
                : sessionState.brand
            });

            return { success: true, product: match };
          }
        }),
        setPreferences: tool({
          description: 'Set language, duration, or aspect ratio',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              language: { type: 'string' },
              videoDurationSeconds: { type: 'integer' },
              videoAspectRatio: { type: 'string', enum: ['16:9', '9:16'] }
            },
            required: []
          }),
          execute: async ({ language, videoDurationSeconds, videoAspectRatio }) => {
            await persistSession({
              language: language ?? sessionState.language,
              videoDurationSeconds: videoDurationSeconds ?? sessionState.videoDurationSeconds,
              videoAspectRatio: videoAspectRatio ?? sessionState.videoAspectRatio
            });

            return { success: true };
          }
        }),
        setCustomDialogue: tool({
          description: 'Set or update custom dialogue/script for talking-head mode or guided ad script',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              customDialogue: { type: 'string' }
            },
            required: ['customDialogue']
          }),
          execute: async ({ customDialogue }) => {
            const trimmedDialogue = customDialogue.trim();
            await persistSession({
              customDialogue: trimmedDialogue
            });

            return { success: true, customDialogue: trimmedDialogue };
          }
        }),
        createAvatarAdsProject: tool({
          description: 'Create the avatar ads project once all inputs are confirmed',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              confirm: { type: 'boolean' }
            },
            required: ['confirm']
          }),
          execute: async ({ confirm }) => {
            if (!confirm) {
              return { success: false, message: 'Awaiting confirmation.' };
            }

            if (!sessionState.avatar) {
              return { success: false, message: 'Avatar is required before creation.' };
            }

            const hasProduct = Boolean(sessionState.product);
            const hasCustomDialogue = Boolean(sessionState.customDialogue?.trim());
            if (!hasProduct && !hasCustomDialogue) {
              return {
                success: false,
                message: 'Provide a product or a custom dialogue script before creation.'
              };
            }

            const duration = sessionState.videoDurationSeconds ?? 16;
            const aspect = sessionState.videoAspectRatio ?? '16:9';
            const imageSize = aspect === '9:16' ? 'portrait_16_9' : 'landscape_16_9';

            const formData = new FormData();
            formData.set('user_id', userId);
            formData.set('video_duration_seconds', duration.toString());
            formData.set('image_model', sessionState.imageModel ?? 'nano_banana_pro');
            formData.set('image_size', imageSize);
            formData.set('video_model', sessionState.videoModel ?? 'veo3_fast');
            formData.set('video_aspect_ratio', aspect);
            formData.set('selected_person_photo_url', sessionState.avatar.photoUrl);
            formData.set('language', sessionState.language ?? 'en');
            if (sessionState.product?.id) {
              formData.set('selected_product_id', sessionState.product.id);
            }
            if (sessionState.customDialogue?.trim()) {
              formData.set('custom_dialogue', sessionState.customDialogue.trim());
            }
            if (!hasProduct && hasCustomDialogue) {
              formData.set('talking_head_mode', 'true');
            }

            const response = await fetch(`${origin}/api/avatar-ads/create`, {
              method: 'POST',
              body: formData
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to create project.' };
            }

            await persistSession({
              projectId: payload.id,
              step: 'creating'
            });

            return { success: true, project: payload };
          }
        }),
        updatePromptEdits: tool({
          description: 'Store updated prompts JSON for video generation confirmation',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              updatedPrompts: { type: 'object' }
            },
            required: ['updatedPrompts']
          }),
          execute: async ({ updatedPrompts }) => {
            await persistSession({
              pendingUpdatedPrompts: updatedPrompts
            });

            return { success: true };
          }
        }),
        regenerateImage: tool({
          description: 'Regenerate cover image with an updated image prompt',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              imagePrompt: { type: 'string' }
            },
            required: ['imagePrompt']
          }),
          execute: async ({ imagePrompt }) => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/regenerate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imagePrompt })
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to regenerate image.' };
            }

            await persistSession({
              imagePrompt,
              step: 'regenerating_image'
            });

            return { success: true, project: payload.project };
          }
        }),
        confirmVideoGeneration: tool({
          description: 'Confirm prompts and start video generation',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              confirm: { type: 'boolean' }
            },
            required: ['confirm']
          }),
          execute: async ({ confirm }) => {
            if (!confirm) {
              return { success: false, message: 'Awaiting confirmation.' };
            }

            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }

            const updatedPrompts = sessionState.pendingUpdatedPrompts ?? sessionState.generatedPrompts ?? undefined;

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/confirm`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updatedPrompts })
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to start video generation.' };
            }

            await persistSession({
              step: 'generating_videos'
            });

            return { success: true, project: payload.project };
          }
        }),
        syncProjectStatus: tool({
          description: 'Fetch the latest project status and prompts for the current project',
          inputSchema: emptySchema,
          execute: async () => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/status`, {
              cache: 'no-store'
            });
            const payload = await response.json();

            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to fetch status.' };
            }

            await persistSession({
              step: payload.project.status === 'awaiting_review' ? 'awaiting_review' : sessionState.step,
              generatedPrompts: payload.project.generated_prompts ?? null,
              imagePrompt: payload.project.image_prompt ?? null,
              generatedImageUrl: payload.project.generated_image_url ?? null
            });

            return { success: true, project: payload.project };
          }
        })
      }
    });

    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finalMessages }) => {
        const normalizedFinalMessages = dedupeMessages(
          finalMessages.map((message, index) => normalizeUIMessage(message, `final-${index}`))
        );
        // Preserve existing timeline exactly as-is, and only append genuinely new
        // streamed messages. Never overwrite prior history by id.
        const existingIds = new Set(conversationMessages.map((message) => message.id));
        const messagesToPersist = [...conversationMessages];
        for (const message of normalizedFinalMessages) {
          if (existingIds.has(message.id)) {
            continue;
          }

          const previous = messagesToPersist[messagesToPersist.length - 1];
          const previousText = previous ? messageText(previous) : '';
          const nextText = messageText(message);
          if (previous && previous.role === message.role && previousText && previousText === nextText) {
            continue;
          }

          messagesToPersist.push(message);
          existingIds.add(message.id);
        }

        await supabase
          .from(sessionTable)
          .update({
            messages: messagesToPersist,
            updated_at: new Date().toISOString()
          })
          .eq('id', resolvedSessionId)
          .eq('user_id', userId);
      }
    });
  } catch (error) {
    console.error('[Project Agent] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
