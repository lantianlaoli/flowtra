import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { VideoModel } from '@/lib/constants';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import {
  getPrimaryCloneSelection,
  normalizeCloneSelections,
  normalizeSelectedIds
} from '@/lib/project-agent/clone-selection';
import {
  buildCartesianSceneAssignments,
  normalizeSceneAssignments,
  type ClonePlanStatus,
  type CloneSceneAssignment
} from '@/lib/project-agent/clone-replacement-plan';
import { REPLACEMENT_CONFIRMATION_TOKEN } from '@/lib/project-agent/clone-workflow-control';
import {
  buildProjectAgentCloneDraftSeeds,
  type ProjectAgentDraftSeedScene,
} from '@/lib/project-agent/clone-draft-planning';
import {
  buildProjectAgentLegacyAudioField,
  normalizeProjectAgentCloneShot,
  type ProjectAgentCloneShot,
} from '@/lib/project-agent/clone-prompt-schema';
import { injectMentionsInline, stripMentionTokens } from '@/lib/project-agent/clone-prompt-mentions';
import { extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';

type ShotPrompt = ProjectAgentCloneShot;

type ScenePrompt = {
  sceneIndex: number;
  imagePrompt: string;
  isContinuation?: boolean;
  videoPrompt: {
    shots: ShotPrompt[];
  };
  sourceSummary?: string | null;
};

type CloneReplacementDraft = {
  status: 'idle' | 'generating' | 'ready' | 'awaiting_confirmation' | 'failed';
  planStatus?: ClonePlanStatus;
  confirmation?: {
    requiredToken: string;
    confirmedAt?: string | null;
    confirmedByMessageId?: string | null;
  } | null;
  sceneAssignments?: CloneSceneAssignment[];
  error?: string | null;
  selectedAvatars?: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
  }>;
  selectedAvatar?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  selectedProducts?: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
  }>;
  selectedProduct?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  scenes: ScenePrompt[];
};

type SessionState = {
  videoModel?: VideoModel;
  language?: string;
  cloneReferenceVideo?: {
    id: string;
    name?: string | null;
    sourceType?: 'creator' | 'competitor_ad';
    sourceId?: string | null;
    analysisSummary?: string | null;
    keyShots?: string[] | null;
    language?: string | null;
    videoUrl?: string | null;
    cdnUrl?: string | null;
  };
  cloneReplacementDraft?: CloneReplacementDraft;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AVATAR_HINT_REGEX = /\b(man|male|woman|female|person|character|subject|mother|father|guy|girl|boy|lady|he|she|him|his|her)\b/i;
const PRODUCT_HINT_REGEX = /\b(product|item|object|toy|book)\b/i;

const hasExplicitMentionSignal = (
  text: string,
  selectedName?: string | null
) => {
  const normalized = text.trim();
  if (!normalized) return false;
  if (!selectedName?.trim()) return false;
  const nameRegex = new RegExp(`\\b${escapeRegExp(selectedName.trim())}\\b`, 'i');
  return nameRegex.test(normalized);
};

const transformShotFieldInline = (
  text: string,
  input: {
    avatarToken?: string | null;
    productToken?: string | null;
    avatarName?: string | null;
    productName?: string | null;
  },
  options?: {
    forceAvatar?: boolean;
    forceProduct?: boolean;
  }
) => {
  const base = stripMentionTokens(text || '').trim();
  if (!base) return '';

  const hasAvatarSignal = Boolean(
    AVATAR_HINT_REGEX.test(base) ||
    hasExplicitMentionSignal(base, input.avatarName) ||
    (input.avatarToken && base.includes(input.avatarToken))
  );
  const hasProductSignal = Boolean(
    PRODUCT_HINT_REGEX.test(base) ||
    hasExplicitMentionSignal(base, input.productName) ||
    (input.productToken && base.includes(input.productToken))
  );

  const avatarToken = (hasAvatarSignal || options?.forceAvatar) ? (input.avatarToken || null) : null;
  const productToken = (hasProductSignal || options?.forceProduct) ? (input.productToken || null) : null;

  if (!avatarToken && !productToken) {
    return base;
  }

  return injectMentionsInline({
    imagePrompt: base,
    fallbackSummary: base,
    avatarToken,
    productToken,
    avatarName: input.avatarName,
    productName: input.productName
  });
};

const buildShotSubject = (input: {
  subject?: string | null;
  sourceSummary?: string | null;
  avatarToken?: string | null;
  productToken?: string | null;
  avatarName?: string | null;
  productName?: string | null;
}) => {
  const mentionContext = {
    avatarToken: input.avatarToken,
    productToken: input.productToken,
    avatarName: input.avatarName,
    productName: input.productName
  };

  const direct = transformShotFieldInline(input.subject || '', mentionContext, {
    forceAvatar: Boolean(input.avatarToken),
    forceProduct: Boolean(input.productToken)
  }).trim();
  if (direct) return direct;

  const summaryFallback = transformShotFieldInline(input.sourceSummary || '', mentionContext, {
    forceAvatar: Boolean(input.avatarToken),
    forceProduct: Boolean(input.productToken)
  }).trim();
  if (summaryFallback) return summaryFallback;

  return [input.avatarToken, input.productToken].filter(Boolean).join(' ').trim();
};

const parseModelScenes = (raw: unknown): ScenePrompt[] => {
  const parsed = raw as {
    scenes?: Array<{
      sceneIndex: number;
      imagePrompt: string;
      sourceSummary: string;
      videoPrompt?: {
        shots?: Array<Partial<ShotPrompt>>;
      };
    }>;
  };

  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

  return scenes.map((scene, index) => ({
    sceneIndex: Number.isFinite(scene.sceneIndex) && scene.sceneIndex > 0 ? scene.sceneIndex : index + 1,
    imagePrompt: typeof scene.imagePrompt === 'string' ? scene.imagePrompt : '',
    isContinuation: index > 0,
    sourceSummary: typeof scene.sourceSummary === 'string' ? scene.sourceSummary : null,
    videoPrompt: {
      shots: Array.isArray(scene.videoPrompt?.shots)
        ? scene.videoPrompt!.shots.map((shot, shotIndex) => normalizeProjectAgentCloneShot({
            id: Number.isFinite(Number(shot.id)) ? Number(shot.id) : shotIndex + 1,
            time_range: typeof shot.time_range === 'string' ? shot.time_range : undefined,
            subject: typeof shot.subject === 'string' ? shot.subject : '',
            context_environment: typeof shot.context_environment === 'string' ? shot.context_environment : '',
            action: typeof shot.action === 'string' ? shot.action : '',
            style: typeof shot.style === 'string' ? shot.style : '',
            camera_motion_positioning: typeof shot.camera_motion_positioning === 'string' ? shot.camera_motion_positioning : '',
            composition: typeof shot.composition === 'string' ? shot.composition : '',
            ambiance_colour_lighting: typeof shot.ambiance_colour_lighting === 'string' ? shot.ambiance_colour_lighting : '',
            audio: typeof shot.audio === 'string' ? shot.audio : '',
            sfx: typeof shot.sfx === 'string' ? shot.sfx : '',
            ambient: typeof shot.ambient === 'string' ? shot.ambient : '',
            dialogue: typeof shot.dialogue === 'string' ? shot.dialogue : '',
            language: typeof shot.language === 'string' ? shot.language : undefined
          }, shotIndex, 'en'))
        : []
    }
  }));
};

const generateReplacementDraft = async (input: {
  scenes: ProjectAgentDraftSeedScene[];
  referenceSummary: string;
  avatarName?: string;
  productName?: string;
}) => {
  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-preview';

  const avatarToken = input.avatarName ? `@character(${input.avatarName})` : null;
  const productToken = input.productName ? `@product(${input.productName})` : null;
  const mentionContext = {
    avatarToken,
    productToken,
    avatarName: input.avatarName,
    productName: input.productName
  };

  const payload = await sendOpenRouterChat({
    model: modelName,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'clone_replacement_draft',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            scenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sceneIndex: { type: 'integer' },
                  imagePrompt: { type: 'string' },
                  sourceSummary: { type: 'string' },
                  videoPrompt: {
                    type: 'object',
                    properties: {
                      shots: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            time_range: { type: 'string' },
                            subject: { type: 'string' },
                            context_environment: { type: 'string' },
                            action: { type: 'string' },
                            style: { type: 'string' },
                            camera_motion_positioning: { type: 'string' },
                            composition: { type: 'string' },
                            ambiance_colour_lighting: { type: 'string' },
                            audio: { type: 'string' },
                            sfx: { type: 'string' },
                            ambient: { type: 'string' },
                            dialogue: { type: 'string' },
                            language: { type: 'string' }
                          },
                          required: [
                            'id',
                            'time_range',
                            'subject',
                            'context_environment',
                            'action',
                            'style',
                            'camera_motion_positioning',
                            'composition',
                            'ambiance_colour_lighting',
                            'audio',
                            'sfx',
                            'ambient',
                            'dialogue'
                          ],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ['shots'],
                    additionalProperties: false
                  }
                },
                required: ['sceneIndex', 'imagePrompt', 'videoPrompt', 'sourceSummary'],
                additionalProperties: false
              }
            }
          },
          required: ['scenes'],
          additionalProperties: false
        }
      }
    },
    messages: [
      {
        role: 'system',
        content: [
          'You are rewriting clone prompts while preserving original Kling scene structure.',
          'Output must preserve scene order, shot count per scene, and the exact time_range of every shot.',
          avatarToken
            ? `Character replacement must explicitly use token in imagePrompt and shot fields: ${avatarToken}.`
            : 'Do not use any @character(...) token.',
          productToken
            ? `Product replacement must explicitly use token in imagePrompt and shot fields: ${productToken}.`
            : 'Do not use any @product(...) token.',
          'For each scene output imagePrompt and videoPrompt.shots.',
          'imagePrompt must stay scene-specific (subject + environment + action) and must not repeat the same boilerplate sentence across scenes.',
          'Do not use trailing templates like ", featuring @character(...) interacting with @product(...)".',
          'Write a normal fluent prompt first, then embed mention tokens only at the noun phrase positions.',
          'Do not invent extra shots, do not merge scenes, and do not change any provided time_range.',
          'Each shot must include: subject, context_environment, action, style, camera_motion_positioning, composition, ambiance_colour_lighting, audio, sfx, ambient, dialogue, time_range.',
          'Apply avatar/product replacement inside video shot fields too. Do not leave original role words (e.g. woman/man) when replacement is selected.',
          'Keep fields concise but specific.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          referenceSummary: input.referenceSummary,
          scenes: input.scenes,
          replacement: {
            avatarToken,
            productToken
          }
        })
      }
    ]
  }, {
    timeoutMs: 45000,
    maxRetries: 3
  }) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  const content = extractOpenRouterTextContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('Model returned empty draft content.');
  }

  const parsedContent = parseModelScenes(JSON.parse(content));
  if (parsedContent.length === 0) {
    throw new Error('Model returned empty scene draft list.');
  }

  return input.scenes.map((seedScene, index) => {
    const scene = parsedContent[index] || {
      sceneIndex: seedScene.sceneIndex,
      imagePrompt: seedScene.imagePrompt,
      isContinuation: seedScene.isContinuation,
      sourceSummary: seedScene.sourceSummary || '',
      videoPrompt: {
        shots: seedScene.videoPrompt.shots,
      },
    };
    const seedShots = seedScene.videoPrompt.shots || [];
    const aiShots = scene.videoPrompt.shots || [];
    let imagePrompt = scene.imagePrompt || seedScene.imagePrompt || '';
    imagePrompt = injectMentionsInline({
      imagePrompt,
      fallbackSummary: scene.sourceSummary || seedScene.sourceSummary || seedScene.imagePrompt || '',
      avatarToken,
      productToken,
      avatarName: input.avatarName,
      productName: input.productName
    });

    const shotCount = Math.max(1, seedShots.length || aiShots.length || 1);
    const shots = Array.from({ length: shotCount }, (_, shotIndex) => {
      const seedShot = seedShots[shotIndex] || seedShots[seedShots.length - 1];
      const aiShot = aiShots[shotIndex] || aiShots[aiShots.length - 1] || seedShot;
      const sourceSummary = scene.sourceSummary || seedScene.sourceSummary || seedScene.imagePrompt || '';
      const sfx = transformShotFieldInline(aiShot?.sfx || seedShot?.sfx || '', mentionContext);
      const ambient = transformShotFieldInline(aiShot?.ambient || seedShot?.ambient || '', mentionContext);
      const normalizedShot = normalizeProjectAgentCloneShot({
        ...seedShot,
        ...aiShot,
        id: shotIndex + 1,
        time_range: seedShot?.time_range || aiShot?.time_range,
        subject: buildShotSubject({
          subject: aiShot?.subject || seedShot?.subject || '',
          sourceSummary,
          avatarToken,
          productToken,
          avatarName: input.avatarName,
          productName: input.productName
        }),
        context_environment: transformShotFieldInline(aiShot?.context_environment || seedShot?.context_environment || '', mentionContext),
        action: transformShotFieldInline(aiShot?.action || seedShot?.action || '', mentionContext, {
          forceAvatar: Boolean(input.avatarName),
          forceProduct: Boolean(input.productName)
        }),
        style: transformShotFieldInline(aiShot?.style || seedShot?.style || '', mentionContext),
        camera_motion_positioning: transformShotFieldInline(aiShot?.camera_motion_positioning || seedShot?.camera_motion_positioning || '', mentionContext),
        composition: transformShotFieldInline(aiShot?.composition || seedShot?.composition || '', mentionContext),
        ambiance_colour_lighting: transformShotFieldInline(aiShot?.ambiance_colour_lighting || seedShot?.ambiance_colour_lighting || '', mentionContext),
        sfx,
        ambient,
        audio: buildProjectAgentLegacyAudioField({ sfx, ambient }),
        dialogue: transformShotFieldInline(aiShot?.dialogue || seedShot?.dialogue || '', mentionContext),
        language: aiShot?.language || seedShot?.language || 'en',
      }, shotIndex, seedShot?.language || aiShot?.language || 'en');
      return {
        ...normalizedShot,
        audio: buildProjectAgentLegacyAudioField(normalizedShot),
      };
    });

    return {
      sceneIndex: seedScene.sceneIndex,
      imagePrompt,
      isContinuation: typeof seedScene.isContinuation === 'boolean' ? seedScene.isContinuation : index > 0,
      videoPrompt: { shots },
      sourceSummary: scene.sourceSummary || seedScene.sourceSummary || null
    } satisfies ScenePrompt;
  });
};

const applySceneAssignmentsToGeneratedScenes = (input: {
  scenes: ScenePrompt[];
  sceneAssignments: CloneSceneAssignment[];
  avatarById: Map<string, { name: string }>;
  productById: Map<string, { name: string }>;
}) => {
  return input.scenes.map((scene, index) => {
    const assignment = input.sceneAssignments.find((item) => item.sceneIndex === scene.sceneIndex) ?? input.sceneAssignments[index];
    if (!assignment) return scene;
    const avatarName = assignment.avatarId ? (input.avatarById.get(assignment.avatarId)?.name || null) : null;
    const productName = input.productById.get(assignment.productId)?.name || null;
    const avatarToken = avatarName ? `@character(${avatarName})` : null;
    const productToken = productName ? `@product(${productName})` : null;

    const mentionContext = {
      avatarToken,
      productToken,
      avatarName,
      productName
    };

    const imagePrompt = injectMentionsInline({
      imagePrompt: scene.imagePrompt || '',
      fallbackSummary: scene.sourceSummary || scene.imagePrompt || '',
      avatarToken,
      productToken,
      avatarName: avatarName || undefined,
      productName: productName || undefined
    });

    const shots = (scene.videoPrompt?.shots || []).map((shot, shotIndex) => {
      const normalizedShot = normalizeProjectAgentCloneShot(shot, shotIndex, shot.language || 'en');
      const sfx = transformShotFieldInline(normalizedShot.sfx || '', mentionContext);
      const ambient = transformShotFieldInline(normalizedShot.ambient || '', mentionContext);
      return {
      ...normalizedShot,
      subject: buildShotSubject({
        subject: normalizedShot.subject || '',
        sourceSummary: scene.sourceSummary || scene.imagePrompt || '',
        avatarToken,
        productToken,
        avatarName,
        productName
      }),
      context_environment: transformShotFieldInline(normalizedShot.context_environment || '', mentionContext),
      action: transformShotFieldInline(normalizedShot.action || '', mentionContext, {
        forceAvatar: Boolean(avatarToken),
        forceProduct: Boolean(productToken)
      }),
      style: transformShotFieldInline(normalizedShot.style || '', mentionContext),
      camera_motion_positioning: transformShotFieldInline(normalizedShot.camera_motion_positioning || '', mentionContext),
      composition: transformShotFieldInline(normalizedShot.composition || '', mentionContext),
      ambiance_colour_lighting: transformShotFieldInline(normalizedShot.ambiance_colour_lighting || '', mentionContext),
      sfx,
      ambient,
      dialogue: transformShotFieldInline(normalizedShot.dialogue || '', mentionContext),
      audio: buildProjectAgentLegacyAudioField({
        sfx,
        ambient,
      })
    };
    });

    return {
      ...scene,
      imagePrompt,
      videoPrompt: { shots }
    };
  });
};

export async function POST(request: NextRequest) {
  try {
    const isInternalRequest = request.headers.get('x-project-agent-internal') === '1';
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const { userId: clerkUserId } = isInternalRequest ? { userId: null } : await auth();
    const userId = internalUserId || clerkUserId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await request.json() as {
      sessionId?: string;
      avatarId?: string;
      productId?: string;
      avatarIds?: string[];
      productIds?: string[];
      sceneAssignments?: CloneSceneAssignment[];
    };

    const sessionId = body.sessionId?.trim();
    const avatarIds = normalizeSelectedIds(body.avatarId?.trim(), body.avatarIds, 8);
    const productIds = normalizeSelectedIds(body.productId?.trim(), body.productIds, 8);
    const incomingAssignments = normalizeSceneAssignments(body.sceneAssignments, 8);

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (avatarIds.length === 0 && productIds.length === 0) {
      return NextResponse.json({ error: 'At least one avatar or product selection is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Schema verified via Supabase MCP (2026-02-11): project_agent_sessions
    const { data: session, error: sessionError } = await supabase
      .from('project_agent_sessions')
      .select('id,user_id,state')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const state = (session.state as SessionState | null) || {};
    const reference = state.cloneReferenceVideo;
    const existingSelectedAvatars = normalizeCloneSelections(
      state.cloneReplacementDraft?.selectedAvatars,
      state.cloneReplacementDraft?.selectedAvatar
    );
    const existingSelectedProducts = normalizeCloneSelections(
      state.cloneReplacementDraft?.selectedProducts,
      state.cloneReplacementDraft?.selectedProduct
    );
    const existingSceneAssignments = normalizeSceneAssignments(
      state.cloneReplacementDraft?.sceneAssignments,
      8
    );

    if (!reference?.id) {
      return NextResponse.json({ error: 'Reference video is not selected yet.' }, { status: 400 });
    }

    const generatingState: SessionState = {
      ...state,
      cloneReplacementDraft: {
        status: 'generating',
        planStatus: state.cloneReplacementDraft?.planStatus || 'awaiting_confirmation',
        confirmation: state.cloneReplacementDraft?.confirmation ?? {
          requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
          confirmedAt: null,
          confirmedByMessageId: null
        },
        error: null,
        selectedAvatars: existingSelectedAvatars,
        selectedAvatar: getPrimaryCloneSelection(existingSelectedAvatars),
        selectedProducts: existingSelectedProducts,
        selectedProduct: getPrimaryCloneSelection(existingSelectedProducts),
        sceneAssignments: incomingAssignments.length > 0 ? incomingAssignments : existingSceneAssignments,
        scenes: []
      }
    };

    await supabase
      .from('project_agent_sessions')
      .update({
        state: generatingState,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    const avatarSelections: NonNullable<CloneReplacementDraft['selectedAvatars']> = [];
    if (avatarIds.length > 0) {
      const systemAvatarMap = new Map(
        SYSTEM_AVATARS
          .filter((item) => avatarIds.includes(item.id))
          .map((item) => [item.id, item] as const)
      );
      const customAvatarIds = avatarIds.filter((id) => !systemAvatarMap.has(id));
      const customAvatarMap = new Map<string, { id: string; avatar_name: string | null; photo_url: string | null }>();

      if (customAvatarIds.length > 0) {
        // Schema verified via Supabase MCP (2026-02-11): user_avatars includes id,user_id,avatar_name,photo_url.
        const { data: avatars } = await supabase
          .from('user_avatars')
          .select('id,avatar_name,photo_url')
          .in('id', customAvatarIds)
          .eq('user_id', userId);

        (avatars ?? []).forEach((avatar) => {
          customAvatarMap.set(avatar.id, avatar);
        });
      }

      for (const avatarId of avatarIds) {
        const systemAvatar = systemAvatarMap.get(avatarId);
        if (systemAvatar) {
          avatarSelections.push({
            id: systemAvatar.id,
            name: systemAvatar.avatar_name,
            photoUrl: systemAvatar.photo_url
          });
          continue;
        }

        const avatar = customAvatarMap.get(avatarId);
        if (!avatar) {
          return NextResponse.json({ error: 'One of the selected avatars was not found.' }, { status: 404 });
        }

        avatarSelections.push({
          id: avatar.id,
          name: avatar.avatar_name || 'Unnamed Avatar',
          photoUrl: avatar.photo_url || null
        });
      }
    }

    const productSelections: NonNullable<CloneReplacementDraft['selectedProducts']> = [];
    if (productIds.length > 0) {
      // Schema verified via Supabase MCP (2026-02-11): user_products includes id,user_id,product_name.
      const { data: products } = await supabase
        .from('user_products')
        .select('id,product_name,user_product_photos(photo_url,is_primary)')
        .in('id', productIds)
        .eq('user_id', userId);

      const productMap = new Map(
        (products ?? []).map((product) => [product.id, product] as const)
      );

      for (const productId of productIds) {
        const product = productMap.get(productId);
        if (!product) {
          return NextResponse.json({ error: 'One of the selected products was not found.' }, { status: 404 });
        }

        const photos = Array.isArray(product.user_product_photos)
          ? product.user_product_photos as Array<{ photo_url?: string; is_primary?: boolean }>
          : [];
        const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];

        productSelections.push({
          id: product.id,
          name: product.product_name || 'Unnamed Product',
          photoUrl: primaryPhoto?.photo_url || null
        });
      }
    }

    const avatarSelection = getPrimaryCloneSelection(avatarSelections);
    const productSelection = getPrimaryCloneSelection(productSelections);
    const avatarById = new Map(avatarSelections.map((avatar) => [avatar.id, { name: avatar.name }] as const));
    const productById = new Map(productSelections.map((product) => [product.id, { name: product.name }] as const));

    const referenceSourceType = reference.sourceType || 'creator';
    const referenceSourceId = reference.sourceId || reference.id;
    const referenceVideoId = reference.id || reference.sourceId;

    let analysisResult: Record<string, unknown> | null = null;
    let referenceDurationSeconds: number | null = null;

    if (referenceSourceType === 'competitor_ad') {
      // Schema verified via Supabase MCP (2026-02-11): competitor_ads includes id,user_id,analysis_result.
      const { data: competitorAd } = await supabase
        .from('competitor_ads')
        .select('id,analysis_result,video_duration_seconds')
        .eq('id', referenceSourceId)
        .eq('user_id', userId)
        .maybeSingle();
      analysisResult = (competitorAd?.analysis_result as Record<string, unknown> | null) || null;
      referenceDurationSeconds = Number(competitorAd?.video_duration_seconds || 0) || null;
    } else {
      // Schema verified via Supabase MCP (2026-02-11): creator_source_videos includes id,user_id,source_id,analysis_result.
      let creatorVideo: { id: string; analysis_result: unknown; duration_seconds?: number | null } | null = null;
      if (referenceVideoId) {
        const { data } = await supabase
          .from('creator_source_videos')
          .select('id,analysis_result,duration_seconds')
          .eq('id', referenceVideoId)
          .eq('user_id', userId)
          .maybeSingle();
        creatorVideo = data as { id: string; analysis_result: unknown; duration_seconds?: number | null } | null;
      }

      // Backward compatibility for sessions that mistakenly persisted source_id.
      if (!creatorVideo && referenceSourceId) {
        const { data } = await supabase
          .from('creator_source_videos')
          .select('id,analysis_result,duration_seconds')
          .eq('source_id', referenceSourceId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        creatorVideo = data as { id: string; analysis_result: unknown; duration_seconds?: number | null } | null;
      }

      analysisResult = (creatorVideo?.analysis_result as Record<string, unknown> | null) || null;
      referenceDurationSeconds = Number(creatorVideo?.duration_seconds || 0) || null;
    }

    const seedPlan = buildProjectAgentCloneDraftSeeds({
      analysisResult,
      fallbackSummary: reference.analysisSummary,
      fallbackShots: reference.keyShots,
      referenceDurationSeconds,
      language: state.language || reference.language || 'en'
    });
    const scenes = seedPlan.scenes;
    const sceneCount = Math.max(scenes.length, 1);
    const sceneAssignments = (
      incomingAssignments.length > 0
        ? incomingAssignments
        : buildCartesianSceneAssignments({
            sceneCount,
            avatarIds: avatarSelections.map((avatar) => avatar.id),
            productIds: productSelections.map((product) => product.id),
            existingAssignments: existingSceneAssignments
          })
    );

    const generatedScenes = await generateReplacementDraft({
      scenes,
      referenceSummary: reference.analysisSummary || 'Reference structure selected.',
      avatarName: avatarSelection?.name,
      productName: productSelection?.name
    });
    const assignedScenes = applySceneAssignmentsToGeneratedScenes({
      scenes: generatedScenes,
      sceneAssignments,
      avatarById,
      productById
    });

    const wasConfirmed = Boolean(
      state.cloneReplacementDraft?.planStatus === 'confirmed' &&
      state.cloneReplacementDraft?.confirmation?.confirmedAt
    );
    const cloneReplacementDraft: CloneReplacementDraft = {
      status: wasConfirmed ? 'ready' : 'awaiting_confirmation',
      planStatus: wasConfirmed ? 'confirmed' : 'awaiting_confirmation',
      confirmation: state.cloneReplacementDraft?.confirmation ?? {
        requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
        confirmedAt: null,
        confirmedByMessageId: null
      },
      error: null,
      selectedAvatars: avatarSelections,
      selectedAvatar: avatarSelection,
      selectedProducts: productSelections,
      selectedProduct: productSelection,
      sceneAssignments,
      scenes: assignedScenes
    };

    const nextState: SessionState = {
      ...state,
      videoModel: 'kling_3',
      cloneReplacementDraft
    };

    const { error: updateError } = await supabase
      .from('project_agent_sessions')
      .update({
        state: nextState,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      draft: cloneReplacementDraft
    });
  } catch (error) {
    console.error('[Project Agent] clone-replacement-draft error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = /up to 60 seconds|required|not found/i.test(message) ? 400 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
