'use client';

import { Image as ImageIcon, MessageSquare } from 'lucide-react';
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
  const normalizedDraft = normalizeDraft(draft);

  const updateDraft = (patch: Partial<ProjectAgentAvatarDraft>) => {
    if (!onDraftChange) return;
    onDraftChange({
      ...normalizedDraft,
      ...patch
    });
  };

  return (
    <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#ececea] bg-[#fafaf9] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c7c78]">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Image Prompt</span>
          </div>
          <PromptMentionTextarea
            value={normalizedDraft.imagePrompt || ''}
            onChange={(nextValue) => updateDraft({ imagePrompt: nextValue })}
            placeholder="Describe the cover frame."
            rows={5}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="min-h-[112px] rounded-xl border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
          />
        </div>

        <div className="rounded-xl border border-[#ececea] bg-[#fafaf9] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c7c78]">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Script</span>
          </div>
          <PromptMentionTextarea
            value={normalizedDraft.scriptSource || ''}
            onChange={(nextValue) => updateDraft({ scriptSource: nextValue })}
            placeholder="Write what the avatar should say."
            rows={8}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="min-h-[176px] rounded-xl border-[#dfdfdc] bg-white text-sm text-[#1f1f1e]"
          />
        </div>
      </div>
    </div>
  );
}
