'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

type FeatureSignupCTAProps = {
  title?: string;
  description?: string;
};

export function FeatureSignupCTA({
  title = 'Start creating with Flowtra',
  description = 'Create your account and start your first workflow in minutes.',
}: FeatureSignupCTAProps) {
  const { isLoaded, user } = useUser();

  const href = user ? '/dashboard' : '/sign-up';
  const label = user ? 'Open Dashboard' : 'Create Free Account';
  const helperText = user
    ? 'Open your dashboard and continue creating.'
    : description;

  return (
    <section className="px-4 py-16 md:px-6 md:py-20 lg:py-28">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] px-6 py-10 text-center md:px-10 md:py-12">
        {!user ? (
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#666666]">
            100 Free Credits Included
          </p>
        ) : null}
        <h2 className="text-[30px] font-bold tracking-[-0.02em] text-black md:text-[40px]">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-[#666666]">
          {helperText}
        </p>
        <div className="mt-8">
          {isLoaded ? (
            <Link
              href={href}
              className="landing-press-button text-[15px] font-semibold"
            >
              {label}
            </Link>
          ) : (
            <div className="landing-press-button text-[15px] font-semibold opacity-60">
              Loading...
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
