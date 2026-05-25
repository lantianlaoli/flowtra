'use client';

import { ByteDance, Gemini, Kling, OpenAI, Qwen } from '@lobehub/icons';
import { Coins, DollarSign } from 'lucide-react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useI18n } from '@/providers/I18nProvider';
import {
  KLING_QUALITY_COSTS,
  SEEDANCE_2_FAST_QUALITY_COSTS,
  SEEDANCE_2_QUALITY_COSTS,
  WAN_27_QUALITY_COSTS,
} from '@/lib/constants';

const CREDIT_TO_USD = 0.015;

type ModelCard = {
  name: string;
  unit: 'sec' | 'image';
  qualities: Array<{
    label: string;
    credits: number;
  }>;
  icon: ComponentType<{ className?: string }>;
};

const MODEL_CARDS: ModelCard[] = [
  {
    name: 'Gemini Omni',
    unit: 'sec',
    qualities: [
      { label: '720p', credits: 6 },
      { label: '1080p', credits: 6 },
      { label: '4K', credits: 10 },
    ],
    icon: Gemini,
  },
  {
    name: 'Seedance 2 Fast',
    unit: 'sec',
    qualities: Object.entries(SEEDANCE_2_FAST_QUALITY_COSTS).map(([label, credits]) => ({
      label,
      credits,
    })),
    icon: ByteDance,
  },
  {
    name: 'Seedance 2',
    unit: 'sec',
    qualities: Object.entries(SEEDANCE_2_QUALITY_COSTS).map(([label, credits]) => ({
      label,
      credits,
    })),
    icon: ByteDance,
  },
  {
    name: 'GPT Image 2',
    unit: 'image',
    qualities: [
      { label: '1K', credits: 3 },
      { label: '2K', credits: 5 },
      { label: '4K', credits: 8 },
    ],
    icon: OpenAI,
  },
  {
    name: 'Kling 3.0',
    unit: 'sec',
    qualities: Object.entries(KLING_QUALITY_COSTS).map(([label, credits]) => ({
      label,
      credits,
    })),
    icon: Kling,
  },
  {
    name: 'Wan 2.7',
    unit: 'sec',
    qualities: Object.entries(WAN_27_QUALITY_COSTS).map(([label, credits]) => ({
      label,
      credits,
    })),
    icon: Qwen,
  },
];

const STACK_STYLES = [
  'lg:left-0 lg:top-14 lg:-rotate-7',
  'lg:left-[15%] lg:top-5 lg:-rotate-4',
  'lg:left-[30%] lg:top-0 lg:-rotate-1',
  'lg:left-[45%] lg:top-4 lg:rotate-2',
  'lg:left-[60%] lg:top-6 lg:rotate-5',
  'lg:left-[75%] lg:top-14 lg:rotate-8',
];

function formatUsd(credits: number) {
  return (credits * CREDIT_TO_USD).toFixed(2);
}


function RollingValue({
  value,
  decimals = 0,
  motionKey,
}: {
  value: number;
  decimals?: number;
  motionKey?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const formattedValue = value.toFixed(decimals);

  if (shouldReduceMotion) {
    return <span className="tabular-nums">{formattedValue}</span>;
  }

  return (
    <span className="relative inline-flex min-w-[4ch] items-baseline justify-start overflow-hidden align-baseline tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${motionKey ?? ''}:${formattedValue}`}
          initial={{ y: '70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-70%', opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {formattedValue}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ModelPricingCard({
  model,
  stackClassName,
}: {
  model: ModelCard;
  stackClassName: string;
}) {
  const [selectedQuality, setSelectedQuality] = useState(model.qualities[0]);
  const Icon = model.icon;

  return (
    <article
      className={`group rounded-[24px] border border-[#E7E7E7] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.06)] will-change-transform transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:z-10 hover:-translate-y-2 hover:scale-[1.035] hover:border-[#D8D8D8] hover:shadow-[0_30px_64px_rgba(0,0,0,0.16)] motion-reduce:transform-none motion-reduce:transition-none lg:absolute lg:w-[220px] ${stackClassName}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold tracking-tight text-black">{model.name}</h3>
        </div>
        <div className="rounded-2xl border border-[#E8E8E8] bg-[#F7F7F7] p-2.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none">
          <Icon className="h-4 w-4 text-black" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {model.qualities.map((quality) => {
          const isSelected = quality.label === selectedQuality.label;
          return (
            <button
              key={quality.label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedQuality(quality)}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                isSelected
                  ? 'bg-black text-white'
                  : 'border border-[#E5E5E5] bg-[#F7F7F7] text-[#666666] hover:text-black'
              }`}
            >
              {quality.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#ECECEC] pt-4 text-black">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 flex-shrink-0 text-[#666666]" />
            <div className="flex items-center text-[20px] font-bold leading-none tracking-tight">
              <RollingValue
                value={selectedQuality.credits}
                decimals={Number.isInteger(selectedQuality.credits) ? 0 : 1}
                motionKey={selectedQuality.label}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 flex-shrink-0 text-[#666666]" />
            <div className="flex items-center text-[20px] font-bold leading-none tracking-tight">
              <RollingValue
                value={Number(formatUsd(selectedQuality.credits))}
                decimals={2}
                motionKey={selectedQuality.label}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function WhyFlowtraSection() {
  const { messages } = useI18n();
  const copy = messages.landing.whyFlowtra;

  return (
    <section className="landing-section-surface px-4 py-12 md:px-6 md:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
          <h2 className="mb-4 text-[32px] font-bold tracking-tight text-black md:text-[40px]">{copy.title}</h2>
          <p className="text-base text-[#666666] md:text-lg">{copy.description}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:relative lg:block lg:h-[250px]">
          {MODEL_CARDS.map((model, index) => (
            <ModelPricingCard key={model.name} model={model} stackClassName={STACK_STYLES[index]} />
          ))}
        </div>

      </div>
    </section>
  );
}
