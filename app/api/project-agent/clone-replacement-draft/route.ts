import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';

type ShotPrompt = {
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
};

type ScenePrompt = {
  sceneIndex: number;
  imagePrompt: string;
  videoPrompt: {
    shots: ShotPrompt[];
  };
  sourceSummary?: string | null;
};

type CloneReplacementDraft = {
  status: 'idle' | 'generating' | 'ready' | 'failed';
  error?: string | null;
  selectedAvatar?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  selectedProduct?: {
    id: string;
    name: string;
    photoUrl?: string | null;
    brandName?: string | null;
  };
  scenes: ScenePrompt[];
};

type SessionState = {
  cloneReferenceVideo?: {
    id: string;
    name?: string | null;
    sourceType?: 'creator' | 'competitor_ad';
    sourceId?: string | null;
    analysisSummary?: string | null;
    keyShots?: string[] | null;
  };
  cloneReplacementDraft?: CloneReplacementDraft;
};

type ReferenceScene = {
  sceneIndex: number;
  sourceSummary: string;
  sourceShots: ShotPrompt[];
};

const resolveSessionTable = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { error } = await supabase.from('project_agent_sessions').select('id').limit(1);
  if (!error) return 'project_agent_sessions';
  if (error.code === 'PGRST205') return 'avatar_ads_agent_sessions';
  throw error;
};

const emptyShot = (subject: string, id = 1): ShotPrompt => ({
  id,
  time_range: '00:00 - 00:02',
  subject,
  context_environment: '',
  action: '',
  style: '',
  camera_motion_positioning: '',
  composition: '',
  ambiance_colour_lighting: '',
  audio: '',
  dialogue: '',
  language: 'en'
});

const extractScenesFromAnalysis = (
  analysisResult: Record<string, unknown> | null | undefined,
  fallbackSummary?: string | null,
  fallbackShots?: string[] | null
): ReferenceScene[] => {
  if (analysisResult && typeof analysisResult === 'object') {
    const shotsRaw = Array.isArray((analysisResult as { shots?: unknown }).shots)
      ? ((analysisResult as { shots?: Array<Record<string, unknown>> }).shots ?? [])
      : [];

    const fromShots = shotsRaw
      .map((shot, index) => {
        const summary =
          (typeof shot.shot_description === 'string' && shot.shot_description.trim()) ||
          (typeof shot.description === 'string' && shot.description.trim()) ||
          (typeof shot.action === 'string' && shot.action.trim()) ||
          (typeof shot.subject === 'string' && shot.subject.trim()) ||
          '';

        if (!summary) return null;

        const sourceShot: ShotPrompt = {
          id: Number.isFinite(Number(shot.id)) ? Number(shot.id) : 1,
          time_range: typeof shot.time_range === 'string' ? shot.time_range : '00:00 - 00:02',
          subject: typeof shot.subject === 'string' ? shot.subject : summary,
          context_environment: typeof shot.context_environment === 'string' ? shot.context_environment : '',
          action: typeof shot.action === 'string' ? shot.action : '',
          style: typeof shot.style === 'string' ? shot.style : '',
          camera_motion_positioning: typeof shot.camera_motion_positioning === 'string' ? shot.camera_motion_positioning : '',
          composition: typeof shot.composition === 'string' ? shot.composition : '',
          ambiance_colour_lighting: typeof shot.ambiance_colour_lighting === 'string' ? shot.ambiance_colour_lighting : '',
          audio: typeof shot.audio === 'string' ? shot.audio : '',
          dialogue: typeof shot.dialogue === 'string' ? shot.dialogue : '',
          language: typeof shot.language === 'string' ? shot.language : undefined
        };

        return {
          sceneIndex: index + 1,
          sourceSummary: summary,
          sourceShots: [sourceShot]
        } satisfies ReferenceScene;
      })
      .filter((scene): scene is ReferenceScene => Boolean(scene));

    if (fromShots.length > 0) {
      return fromShots.slice(0, 8);
    }
  }

  const fromFallbackShots = Array.isArray(fallbackShots)
    ? fallbackShots
        .map((shot, index) => {
          if (!shot || !shot.trim()) return null;
          return {
            sceneIndex: index + 1,
            sourceSummary: shot.trim(),
            sourceShots: [emptyShot(shot.trim())]
          } satisfies ReferenceScene;
        })
        .filter((scene): scene is ReferenceScene => Boolean(scene))
    : [];

  if (fromFallbackShots.length > 0) {
    return fromFallbackShots.slice(0, 8);
  }

  return [{
    sceneIndex: 1,
    sourceSummary: fallbackSummary?.trim() || 'Keep the original reference structure and pacing.',
    sourceShots: [emptyShot(fallbackSummary?.trim() || 'Main subject in frame.')]
  }];
};

const enforceMentionToken = (prompt: string, token: string): string => {
  const trimmed = prompt.trim();
  if (!trimmed) return `${token} in frame.`;
  if (trimmed.includes(token)) return trimmed;
  return `${token} ${trimmed}`;
};

const enforceTokenInShot = (
  shot: ShotPrompt,
  token: string,
  fields: Array<keyof Pick<ShotPrompt, 'subject' | 'action' | 'dialogue' | 'context_environment'>>
) => {
  const next = { ...shot };
  fields.forEach((field) => {
    next[field] = enforceMentionToken(next[field] || '', token);
  });
  return next;
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
    sourceSummary: typeof scene.sourceSummary === 'string' ? scene.sourceSummary : null,
    videoPrompt: {
      shots: Array.isArray(scene.videoPrompt?.shots)
        ? scene.videoPrompt!.shots.map((shot, shotIndex) => ({
            id: Number.isFinite(Number(shot.id)) ? Number(shot.id) : shotIndex + 1,
            time_range: typeof shot.time_range === 'string' ? shot.time_range : '00:00 - 00:02',
            subject: typeof shot.subject === 'string' ? shot.subject : '',
            context_environment: typeof shot.context_environment === 'string' ? shot.context_environment : '',
            action: typeof shot.action === 'string' ? shot.action : '',
            style: typeof shot.style === 'string' ? shot.style : '',
            camera_motion_positioning: typeof shot.camera_motion_positioning === 'string' ? shot.camera_motion_positioning : '',
            composition: typeof shot.composition === 'string' ? shot.composition : '',
            ambiance_colour_lighting: typeof shot.ambiance_colour_lighting === 'string' ? shot.ambiance_colour_lighting : '',
            audio: typeof shot.audio === 'string' ? shot.audio : '',
            dialogue: typeof shot.dialogue === 'string' ? shot.dialogue : '',
            language: typeof shot.language === 'string' ? shot.language : undefined
          }))
        : []
    }
  }));
};

const generateReplacementDraft = async (input: {
  scenes: ReferenceScene[];
  referenceSummary: string;
  avatarName?: string;
  productName?: string;
}) => {
  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-preview';

  const avatarToken = input.avatarName ? `@character(${input.avatarName})` : null;
  const productToken = input.productName ? `@product(${input.productName})` : null;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
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
            'You are rewriting clone prompts while preserving original shot structure.',
            'Output must preserve scene order and source intent.',
            avatarToken ? `Character replacement must explicitly use token: ${avatarToken}.` : 'Character remains original; do not force character replacement.',
            productToken ? `Product replacement must explicitly use token: ${productToken}.` : 'Product remains original; do not force product replacement.',
            'For each scene output imagePrompt and videoPrompt.shots.',
            'Each shot must include: subject, context_environment, action, style, camera_motion_positioning, composition, ambiance_colour_lighting, audio, dialogue, time_range.',
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
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Draft generation failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Model returned empty draft content.');
  }

  const parsedContent = parseModelScenes(JSON.parse(content));
  if (parsedContent.length === 0) {
    throw new Error('Model returned empty scene draft list.');
  }

  return parsedContent.map((scene, index) => {
    let imagePrompt = scene.imagePrompt || '';
    let shots = scene.videoPrompt.shots.length > 0
      ? scene.videoPrompt.shots
      : (input.scenes[index]?.sourceShots ?? []);

    if (avatarToken) {
      imagePrompt = enforceMentionToken(imagePrompt, avatarToken);
      shots = shots.map((shot) => enforceTokenInShot(shot, avatarToken, ['subject', 'action', 'dialogue']));
    }

    if (productToken) {
      imagePrompt = enforceMentionToken(imagePrompt, productToken);
      shots = shots.map((shot) => enforceTokenInShot(shot, productToken, ['subject', 'action', 'context_environment', 'dialogue']));
    }

    return {
      sceneIndex: scene.sceneIndex,
      imagePrompt,
      videoPrompt: { shots },
      sourceSummary: scene.sourceSummary || input.scenes[index]?.sourceSummary || null
    } satisfies ScenePrompt;
  });
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
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
    };

    const sessionId = body.sessionId?.trim();
    const avatarId = body.avatarId?.trim();
    const productId = body.productId?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!avatarId && !productId) {
      return NextResponse.json({ error: 'At least one of avatarId or productId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sessionTable = await resolveSessionTable(supabase);

    // Schema verified via Supabase MCP (2026-02-11): project_agent_sessions/ avatar_ads_agent_sessions
    const { data: session, error: sessionError } = await supabase
      .from(sessionTable)
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

    if (!reference?.id) {
      return NextResponse.json({ error: 'Reference video is not selected yet.' }, { status: 400 });
    }

    const generatingState: SessionState = {
      ...state,
      cloneReplacementDraft: {
        status: 'generating',
        error: null,
        scenes: []
      }
    };

    await supabase
      .from(sessionTable)
      .update({
        state: generatingState,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    let avatarSelection: CloneReplacementDraft['selectedAvatar'];
    if (avatarId) {
      const systemAvatar = SYSTEM_AVATARS.find((item) => item.id === avatarId);
      if (systemAvatar) {
        avatarSelection = {
          id: systemAvatar.id,
          name: systemAvatar.avatar_name,
          photoUrl: systemAvatar.photo_url
        };
      } else {
        // Schema verified via Supabase MCP (2026-02-11): user_avatars includes id,user_id,avatar_name,photo_url.
        const { data: avatar } = await supabase
          .from('user_avatars')
          .select('id,avatar_name,photo_url')
          .eq('id', avatarId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!avatar) {
          return NextResponse.json({ error: 'Selected avatar not found.' }, { status: 404 });
        }

        avatarSelection = {
          id: avatar.id,
          name: avatar.avatar_name || 'Unnamed Avatar',
          photoUrl: avatar.photo_url || null
        };
      }
    }

    let productSelection: CloneReplacementDraft['selectedProduct'];
    if (productId) {
      // Schema verified via Supabase MCP (2026-02-11): user_products includes id,user_id,product_name.
      const { data: product } = await supabase
        .from('user_products')
        .select('id,product_name,user_product_photos(photo_url,is_primary),brand:user_brands(brand_name)')
        .eq('id', productId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!product) {
        return NextResponse.json({ error: 'Selected product not found.' }, { status: 404 });
      }

      const photos = Array.isArray(product.user_product_photos)
        ? product.user_product_photos as Array<{ photo_url?: string; is_primary?: boolean }>
        : [];
      const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
      const brandName = Array.isArray(product.brand)
        ? (product.brand[0] as { brand_name?: string } | undefined)?.brand_name
        : (product.brand as { brand_name?: string } | null | undefined)?.brand_name;

      productSelection = {
        id: product.id,
        name: product.product_name || 'Unnamed Product',
        photoUrl: primaryPhoto?.photo_url || null,
        brandName: brandName || null
      };
    }

    const referenceSourceType = reference.sourceType || 'creator';
    const referenceSourceId = reference.sourceId || reference.id;

    let analysisResult: Record<string, unknown> | null = null;

    if (referenceSourceType === 'competitor_ad') {
      // Schema verified via Supabase MCP (2026-02-11): competitor_ads includes id,user_id,analysis_result.
      const { data: competitorAd } = await supabase
        .from('competitor_ads')
        .select('id,analysis_result')
        .eq('id', referenceSourceId)
        .eq('user_id', userId)
        .maybeSingle();
      analysisResult = (competitorAd?.analysis_result as Record<string, unknown> | null) || null;
    } else {
      // Schema verified via Supabase MCP (2026-02-11): creator_source_videos includes id,user_id,analysis_result.
      const { data: creatorVideo } = await supabase
        .from('creator_source_videos')
        .select('id,analysis_result')
        .eq('id', referenceSourceId)
        .eq('user_id', userId)
        .maybeSingle();
      analysisResult = (creatorVideo?.analysis_result as Record<string, unknown> | null) || null;
    }

    const scenes = extractScenesFromAnalysis(
      analysisResult,
      reference.analysisSummary,
      reference.keyShots
    );

    const generatedScenes = await generateReplacementDraft({
      scenes,
      referenceSummary: reference.analysisSummary || 'Reference structure selected.',
      avatarName: avatarSelection?.name,
      productName: productSelection?.name
    });

    const cloneReplacementDraft: CloneReplacementDraft = {
      status: 'ready',
      error: null,
      selectedAvatar: avatarSelection,
      selectedProduct: productSelection,
      scenes: generatedScenes
    };

    const nextState: SessionState = {
      ...state,
      cloneReplacementDraft
    };

    const { error: updateError } = await supabase
      .from(sessionTable)
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
