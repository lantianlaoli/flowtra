'use client';

import { FeatureInterestReward } from '@/components/lead/FeatureInterestReward';

interface DemoContactCardProps {
  className?: string;
}

export function DemoContactCard({ className = '' }: DemoContactCardProps) {
  return (
    <article
      className={`bg-white rounded-xl border border-[#E5E5E5] p-6 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col relative overflow-hidden ${className}`}
      itemScope
      itemType="https://schema.org/ContactPage"
    >
      <div className="mb-4">
        <h3 className="text-[20px] font-semibold text-black tracking-tight" itemProp="name">
          Try Any Feature
        </h3>
        <p className="text-[13px] text-[#666666] leading-6 mt-1">
          Tell us what you want to generate, then choose the plan that fits.
        </p>
      </div>

      <div className="flex-grow">
        <FeatureInterestReward
          showEmbeddedHeader={false}
          submitLabel="Send Request"
          className="p-0 border-0 bg-transparent"
        />
      </div>
    </article>
  );
}
