import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Touch request to satisfy lint without changing behavior
    void request.method;
    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !project) {
      return NextResponse.json({ success: false, error: 'No project found' }, { status: 404 });
    }

    const userDialogue: string | undefined = project.custom_dialogue || project.image_analysis_result?.user_dialogue;
    if (!userDialogue) {
      return NextResponse.json({ success: false, error: 'No custom dialogue on latest project' }, { status: 400 });
    }

    const prompts = project.generated_prompts as unknown as { scenes?: Array<{ scene?: number | string; prompt?: unknown }> };
    if (!prompts || !Array.isArray(prompts.scenes)) {
      return NextResponse.json({ success: false, error: 'No generated_prompts to update' }, { status: 400 });
    }

    const scenes = prompts.scenes as Array<{ scene?: number | string; prompt?: unknown }>;
    let s1 = scenes.find((s) => s && (Number(s.scene) === 1));
    if (!s1 && scenes.length > 1) s1 = scenes[1];

    if (!s1) {
      return NextResponse.json({ success: false, error: 'Scene 1 not found' }, { status: 400 });
    }

    const exact = `dialogue, the character in the video says: ${userDialogue.replace(/"/g, '\\"')}`;
    if (!s1.prompt || typeof s1.prompt === 'string') {
      s1.prompt = { video_prompt: exact } as Record<string, unknown>;
    } else {
      (s1.prompt as Record<string, unknown>)["video_prompt"] = exact;
    }

    const { error: updateError } = await supabase
      .from('character_ads_projects')
      .update({ generated_prompts: prompts })
      .eq('id', project.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update prompts' }, { status: 500 });
    }

    return NextResponse.json({ success: true, project_id: project.id });
  } catch (err) {
    console.error('fix-character-dialogue error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
