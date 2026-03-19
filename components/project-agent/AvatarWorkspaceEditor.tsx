'use client';

import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, MessageSquare, Film } from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import type { ProjectAgentAvatarDraft } from '@/lib/project-agent/avatar-agent';

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

type AvatarWorkspaceEditorProps = {
  draft: ProjectAgentAvatarDraft | null | undefined;
  characterMentions?: MentionOption[];
  productMentions?: MentionOption[];
  onDraftChange?: (draft: ProjectAgentAvatarDraft) => void;
};

const normalizeDraft = (draft: ProjectAgentAvatarDraft | null | undefined): ProjectAgentAvatarDraft => ({
  status: draft?.status || 'idle',
  scriptMode: draft?.scriptMode || 'agent_authored',
  scriptSource: draft?.scriptSource || '',
  imagePrompt: draft?.imagePrompt || '',
  coverImageUrl: draft?.coverImageUrl ?? null,
  scenes: Array.isArray(draft?.scenes) ? draft.scenes : [],
  error: draft?.error ?? null
});

export default function AvatarWorkspaceEditor({
  draft,
  characterMentions = [],
  productMentions = [],
  onDraftChange
}: AvatarWorkspaceEditorProps) {
  const [localDraft, setLocalDraft] = useState<ProjectAgentAvatarDraft>(() => normalizeDraft(draft));
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  useEffect(() => {
    setLocalDraft(normalizeDraft(draft));
  }, [draft]);

  useEffect(() => {
    if (!onDraftChange) return;
    onDraftChange(localDraft);
  }, [localDraft, onDraftChange]);

  const scenes = localDraft.scenes || [];
  const activeScene = scenes[activeSceneIndex] || null;
  const activePrompt = (activeScene?.prompt && typeof activeScene.prompt === 'object')
    ? activeScene.prompt as Record<string, unknown>
    : {};

  const dialogueWordCount = useMemo(() => {
    const dialog = typeof activePrompt.dialog === 'string' ? activePrompt.dialog : '';
    return dialog.trim() ? dialog.trim().split(/\s+/).length : 0;
  }, [activePrompt.dialog]);

  const updateScenePromptField = (field: string, value: string) => {
    setLocalDraft((current) => ({
      ...current,
      scenes: current.scenes.map((scene, index) => (
        index !== activeSceneIndex
          ? scene
          : {
              ...scene,
              prompt: {
                ...(scene.prompt || {}),
                [field]: value
              }
            }
      ))
    }));
  };

  return (
    <div className="rounded-xl border border-[#e6e6e4] bg-white">
      <div className="border-b border-[#efefed] px-4 py-3">
        <p className="text-sm font-medium text-[#1f1f1e]">Avatar prompt workspace</p>
        <p className="mt-1 text-xs text-[#787876]">
          Refine the cover prompt and spoken script here. Generation stays chat-driven.
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-[#ececea] bg-[#fafaf9] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6f6f6d]">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Cover Prompt</span>
          </div>
          <PromptMentionTextarea
            value={localDraft.imagePrompt || ''}
            onChange={(nextValue) => {
              setLocalDraft((current) => ({
                ...current,
                imagePrompt: nextValue
              }));
            }}
            placeholder="Describe the hero cover frame for this avatar ad."
            rows={5}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="min-h-[112px] rounded-lg border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
          />
        </div>

        <div className="rounded-xl border border-[#ececea] bg-[#fafaf9] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6f6f6d]">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Script</span>
          </div>
          <PromptMentionTextarea
            value={localDraft.scriptSource || ''}
            onChange={(nextValue) => {
              setLocalDraft((current) => ({
                ...current,
                scriptSource: nextValue
              }));
            }}
            placeholder="Write the full spoken script here."
            rows={5}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="min-h-[112px] rounded-lg border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
          />
        </div>

        <div className="rounded-xl border border-[#ececea] bg-[#fafaf9] p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6f6f6d]">
            <Film className="h-3.5 w-3.5" />
            <span>Scene Prompts</span>
          </div>

          {scenes.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {scenes.map((scene, index) => (
                  <button
                    key={scene.sceneIndex}
                    type="button"
                    onClick={() => setActiveSceneIndex(index)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      index === activeSceneIndex
                        ? 'border-[#111111] bg-[#111111] text-white'
                        : 'border-[#d9d9d7] bg-white text-[#1f1f1e]'
                    }`}
                  >
                    Scene {scene.sceneIndex}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <PromptMentionTextarea
                  value={typeof activePrompt.dialog === 'string' ? activePrompt.dialog : ''}
                  onChange={(nextValue) => updateScenePromptField('dialog', nextValue)}
                  placeholder="Dialogue for this scene"
                  rows={4}
                  characterMentions={characterMentions}
                  productMentions={productMentions}
                  className="rounded-lg border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
                />
                <p className="text-[11px] text-[#787876]">{dialogueWordCount} words in this scene dialogue.</p>

                {[
                  ['subject', 'Subject'],
                  ['context_environment', 'Context'],
                  ['action', 'Action'],
                  ['style', 'Style'],
                  ['camera_motion_positioning', 'Camera'],
                  ['composition', 'Composition'],
                  ['ambiance_color_lighting', 'Lighting'],
                  ['audio', 'Audio']
                ].map(([field, label]) => (
                  <div key={field}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6f6f6d]">{label}</p>
                    <PromptMentionTextarea
                      value={typeof activePrompt[field] === 'string' ? String(activePrompt[field]) : ''}
                      onChange={(nextValue) => updateScenePromptField(field, nextValue)}
                      placeholder={`${label} details`}
                      rows={2}
                      characterMentions={characterMentions}
                      productMentions={productMentions}
                      className="rounded-lg border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-[#dfdfdc] bg-white px-4 py-6 text-center text-sm text-[#787876]">
              No scene prompts yet. Ask Flowgen to draft the script first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
