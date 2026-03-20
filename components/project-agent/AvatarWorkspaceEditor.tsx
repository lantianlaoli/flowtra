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
    <div className="flex h-full min-h-full flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#E5E5E5] bg-white p-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-black" />
          <p className="text-sm font-semibold text-black">Image Prompt</p>
        </div>
        <div className="mt-2.5 flex-1 min-h-0">
          <PromptMentionTextarea
            value={normalizedDraft.imagePrompt || ''}
            onChange={(nextValue) => updateDraft({ imagePrompt: nextValue })}
            placeholder="Describe the cover frame."
            rows={5}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="h-full min-h-[170px]"
            preventHorizontalScroll
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#E5E5E5] bg-white p-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-black" />
          <p className="text-sm font-semibold text-black">Script</p>
        </div>
        <div className="mt-2.5 flex-1 min-h-0">
          <PromptMentionTextarea
            value={normalizedDraft.scriptSource || ''}
            onChange={(nextValue) => updateDraft({ scriptSource: nextValue })}
            placeholder="Write what the avatar should say."
            rows={8}
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="h-full min-h-[220px]"
            preventHorizontalScroll
          />
        </div>
      </div>

      {normalizedDraft.error ? (
        <div className="rounded-lg border border-[#f1d2d2] bg-[#fff6f6] px-4 py-3 text-sm text-[#8c3f3f]">
          {normalizedDraft.error}
        </div>
      ) : null}
    </div>
  );
}
