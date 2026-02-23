'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  Camera,
  Clapperboard,
  Clock,
  Layout,
  MapPin,
  MessageSquare,
  Music,
  Palette,
  Sun,
  User,
  Zap
} from 'lucide-react';

export type ClonePromptShotFieldKey =
  | 'subject'
  | 'context_environment'
  | 'action'
  | 'style'
  | 'camera_motion_positioning'
  | 'composition'
  | 'ambiance_colour_lighting'
  | 'audio'
  | 'dialogue';

export type ClonePromptShotFieldMeta = {
  key: ClonePromptShotFieldKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const CLONE_PROMPT_SHOT_FIELDS: ClonePromptShotFieldMeta[] = [
  { key: 'subject', label: 'Subject', icon: User },
  { key: 'context_environment', label: 'Context & Environment', icon: MapPin },
  { key: 'action', label: 'Action', icon: Zap },
  { key: 'style', label: 'Style', icon: Palette },
  { key: 'camera_motion_positioning', label: 'Camera Motion & Positioning', icon: Camera },
  { key: 'composition', label: 'Composition', icon: Layout },
  { key: 'ambiance_colour_lighting', label: 'Ambiance / Colour / Lighting', icon: Sun },
  { key: 'audio', label: 'Audio', icon: Music },
  { key: 'dialogue', label: 'Dialogue', icon: MessageSquare }
];

export const promptUi = {
  frame: 'w-full rounded-2xl border border-[#e6e6e4] bg-white p-4 space-y-4',
  sectionCard: 'rounded-2xl border border-[#e6e6e4] bg-[#fcfcfb] overflow-hidden',
  block: 'rounded-2xl border border-[#e6e6e4] bg-white p-3',
  shotCard: 'rounded-2xl border border-[#ececea] bg-[#fcfcfb] p-3 space-y-3',
  fieldBase: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d] mb-1 inline-flex items-center gap-1.5',
  fieldInput: 'resize-none overflow-y-auto rounded-2xl'
} as const;

export const PromptFieldLabel = ({
  icon: Icon,
  children
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) => (
  <p className={promptUi.fieldBase}>
    <Icon className="h-3.5 w-3.5" />
    <span>{children}</span>
  </p>
);

export const PromptShotLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525251] inline-flex items-center gap-1.5">
    <Clapperboard className="h-3.5 w-3.5" />
    {children}
  </p>
);

export const PromptTimeLabel = ({ children }: { children: ReactNode }) => (
  <span className="text-[11px] text-[#666665] inline-flex items-center gap-1">
    <Clock className="h-3.5 w-3.5" />
    {children}
  </span>
);
