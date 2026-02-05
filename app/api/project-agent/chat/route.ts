import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, jsonSchema, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const model = openrouter.chat('google/gemini-3-pro-preview');

const emptySchema = jsonSchema({ type: 'object', properties: {}, required: [] });

type SessionState = {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: 'collecting' | 'creating' | 'awaiting_review' | 'regenerating_image' | 'generating_videos' | 'completed';
  avatar?: { id: string; name: string; photoUrl: string };
  brand?: { id: string; name: string };
  product?: { id: string; name: string; brandId?: string | null; brandName?: string | null };
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

const buildSystemPrompt = (state: SessionState) => {
  const avatarLabel = state.avatar ? `${state.avatar.name} (${state.avatar.id})` : 'not selected';
  const productLabel = state.product ? `${state.product.name} (${state.product.id})` : 'not selected';
  const brandLabel = state.brand ? `${state.brand.name} (${state.brand.id})` : 'not selected';
  const projectLabel = state.projectId || 'none';

  return `You are Flowtra Project Agent. You orchestrate Flowtra video workflows through a conversational flow.

Supported workflows:
- avatar_ads (create spokesperson-style avatar videos)
- competitor_ugc_replication (primary use case: clone viral videos with your product/brand)
- motion_swap (collect requirements, then hand off to existing workflow entrypoints)

Current configured required inputs for avatar_ads:
- Character (avatar)
- Brand + product (product is mandatory for this flow)
- Video duration (8-80s, multiple of 8)
- Aspect ratio (16:9 or 9:16)
- Language (default en)

Workflow rules:
- Always identify/confirm the target workflow intent first.
- Collect missing required inputs before execution.
- Confirm collected inputs before project creation.
- For avatar_ads, use createAvatarAdsProject only after user confirmation.
- After project creation, wait for prompts/image to be ready (status awaiting_review) before edits.
- Use syncProjectStatus to fetch the latest project data.
- For image prompt edits, use regenerateImage with a new imagePrompt.
- For video prompt edits, use updatePromptEdits with a full updatedPrompts object.
- When the user confirms prompts, use confirmVideoGeneration.
- If the user picks competitor_ugc_replication, collect requirements and explain the implementation is staged if execution tools are not available yet.
- If the user picks motion_swap, collect requirements and explain the implementation is staged if execution tools are not available yet.
- When user asks what workflows are available, always list ALL three:
  1) Avatar Ads
  2) Clone Viral Videos (Competitor UGC Replication)
  3) Motion Swap

Current state:
- Avatar: ${avatarLabel}
- Brand: ${brandLabel}
- Product: ${productLabel}
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
    id: raw.id ?? fallbackId,
    role: raw.role ?? 'user',
    parts
  };
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
    const conversationMessages = [
      ...storedMessages,
      ...(
        storedMessages.some((storedMessage: UIMessage) => storedMessage.id === normalizedIncomingMessage.id)
          ? []
          : [normalizedIncomingMessage]
      )
    ];

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

            return { avatars: data ?? [] };
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
            const match = avatars.find((avatar) => {
              if (avatarId) return avatar.id === avatarId;
              if (!normalizedName) return false;
              return avatar.avatar_name?.toLowerCase().includes(normalizedName);
            });

            if (!match) {
              return { success: false, message: 'No matching avatar found.' };
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

            if (!sessionState.avatar || !sessionState.product) {
              return { success: false, message: 'Avatar and product are required before creation.' };
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
            formData.set('selected_product_id', sessionState.product.id);
            formData.set('language', sessionState.language ?? 'en');

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
      originalMessages: conversationMessages,
      onFinish: async ({ messages: finalMessages }) => {
        const hasAssistantText = finalMessages.some((message) => {
          if (message.role !== 'assistant') return false;
          return message.parts.some((part: { type: string; text?: string }) => part.type === 'text' && (part.text ?? '').trim().length > 0);
        });

        const messagesToPersist = hasAssistantText
          ? finalMessages
          : [
              ...finalMessages,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant' as const,
                parts: [{
                  type: 'text' as const,
                  text: 'I can help with Avatar Ads, Clone Viral Videos, and Motion Swap. Which workflow do you want to start?'
                }]
              }
            ];

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
