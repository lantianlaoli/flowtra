'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useI18n } from '@/providers/I18nProvider';

type FeatureSignupCTAProps = {
  title?: string;
  description?: string;
};

export function FeatureSignupCTA({
  title = 'Start creating with Flowtra',
  description = 'Create your account and start your first workflow in minutes.',
}: FeatureSignupCTAProps) {
  const { locale, messages } = useI18n();
  const { isLoaded, user } = useUser();

  const href = user ? '/dashboard' : '/sign-up';
  const resolvedLabel = user
    ? (locale === 'zh' ? '打开控制台' : 'Open Dashboard')
    : (locale === 'zh' ? '创建免费账户' : 'Create Free Account');
  const helperText = user
    ? (locale === 'zh' ? '打开你的控制台并继续创作。' : 'Open your dashboard and continue creating.')
    : description;

  return (
    <section className="px-4 py-16 md:px-6 md:py-20 lg:py-28">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] px-6 py-10 text-center md:px-10 md:py-12">
        {!user ? (
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#666666]">
            {locale === 'zh' ? '包含 100 免费积分' : '100 Free Credits Included'}
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
              {resolvedLabel}
            </Link>
          ) : (
            <div className="landing-press-button text-[15px] font-semibold opacity-60">
              {messages.common.loading}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
