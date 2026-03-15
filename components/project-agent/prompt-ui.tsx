'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  Camera,
  Clapperboard,
  Clock,
  Layout,
  MapPin,
  MessageSquare,
  Palette,
  Sparkles,
  Sun,
  User,
  Volume2,
  Waves,
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
  | 'sfx'
  | 'ambient'
  | 'dialogue';

export type ClonePromptShotFieldMeta = {
  key: ClonePromptShotFieldKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type ClonePromptShotFieldGroup = {
  key: 'core' | 'cinematography' | 'audio';
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  fields: ClonePromptShotFieldMeta[];
};

const CORE_FIELDS: ClonePromptShotFieldMeta[] = [
  { key: 'subject', label: 'Subject', icon: User },
  { key: 'context_environment', label: 'Context & Environment', icon: MapPin },
  { key: 'action', label: 'Action', icon: Zap }
];

const CINEMATOGRAPHY_FIELDS: ClonePromptShotFieldMeta[] = [
  { key: 'style', label: 'Style', icon: Palette },
  { key: 'camera_motion_positioning', label: 'Camera Motion & Positioning', icon: Camera },
  { key: 'composition', label: 'Composition', icon: Layout },
  { key: 'ambiance_colour_lighting', label: 'Ambiance / Colour / Lighting', icon: Sun }
];

const AUDIO_FIELDS: ClonePromptShotFieldMeta[] = [
  { key: 'sfx', label: 'SFX', icon: Volume2 },
  { key: 'ambient', label: 'Ambient Noise', icon: Waves },
  { key: 'dialogue', label: 'Dialogue', icon: MessageSquare }
];

export const CLONE_PROMPT_SHOT_FIELD_GROUPS: ClonePromptShotFieldGroup[] = [
  {
    key: 'core',
    label: 'Core Prompt Elements',
    description: '',
    icon: Sparkles,
    fields: CORE_FIELDS
  },
  {
    key: 'cinematography',
    label: 'Cinematography',
    description: '',
    icon: Camera,
    fields: CINEMATOGRAPHY_FIELDS
  },
  {
    key: 'audio',
    label: 'Audio',
    description: '',
    icon: Volume2,
    fields: AUDIO_FIELDS
  }
];

export const CLONE_PROMPT_SHOT_FIELDS = CLONE_PROMPT_SHOT_FIELD_GROUPS.flatMap((group) => group.fields);

export const promptUi = {
  frame: 'w-full rounded-2xl border border-[#e6e6e4] bg-white p-4 space-y-4',
  sectionCard: 'rounded-2xl border border-[#e6e6e4] bg-[#fcfcfb] overflow-hidden',
  block: 'rounded-2xl border border-[#e6e6e4] bg-white p-3',
  shotCard: 'rounded-2xl border border-[#ececea] bg-[#fcfcfb] p-3 space-y-3',
  fieldBase: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d] mb-1 inline-flex items-center gap-1.5',
  fieldInput: 'overflow-y-auto rounded-2xl min-h-[7rem]',
  shotFieldInput: 'overflow-y-auto rounded-2xl min-h-[5.5rem]'
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

export const PromptSectionHeading = ({
  icon: Icon,
  title,
  description
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525251] inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </p>
    {description ? (
      <p className="text-[11px] leading-5 text-[#7a7a77]">
        {description}
      </p>
    ) : null}
  </div>
);
