'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { SignInButton, useUser } from '@clerk/nextjs';
import { ArrowUpRight, Copy, Gift, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectItemText, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FEATURE_INTEREST_OPTIONS,
  getFeatureInterestLabel,
  type FeatureInterestOption,
} from '@/lib/feature-interest';
import { getSocialMediaLinks } from '@/lib/social-links';

export type { FeatureInterestOption } from '@/lib/feature-interest';

export interface FeatureInterestPayload {
  feature: FeatureInterestOption;
  otherText?: string;
  selectedPlatform?: string;
}

export interface FeatureInterestResponse {
  success: boolean;
  awarded?: boolean;
  awardedCredits?: number;
  alreadyClaimed?: boolean;
  error?: string;
}

interface FeatureInterestRewardProps {
  variant?: 'embedded' | 'buttonTrigger';
  className?: string;
  buttonLabel?: string;
  buttonClassName?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  showEmbeddedHeader?: boolean;
  embeddedTitle?: string;
  embeddedDescription?: string;
  submitLabel?: string;
}

function getFeatureDisplayName(feature: FeatureInterestOption, otherText?: string): string {
  return getFeatureInterestLabel(feature, otherText);
}

function getShareMessage(feature: FeatureInterestOption, otherText?: string): string {
  const displayName = getFeatureDisplayName(feature, otherText);
  return `Hi Flowtra team, I want to try ${displayName}. I just claimed the 100-credit trial and want onboarding help.`;
}

function FeatureInterestForm({ submitLabel = 'Claim 100 Free Credits' }: { submitLabel?: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const socialLinks = getSocialMediaLinks();

  const [feature, setFeature] = useState<FeatureInterestOption>('ai_agent');
  const [otherText, setOtherText] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareMessage = useMemo(() => getShareMessage(feature, otherText), [feature, otherText]);
  const selectedFeatureOption = useMemo(
    () => FEATURE_INTEREST_OPTIONS.find((option) => option.value === feature),
    [feature]
  );

  const mailtoLink = useMemo(() => {
    const emailEntry = socialLinks.find((link) => link.label === 'Email' && link.href.startsWith('mailto:'));
    const address = emailEntry?.href.replace(/^mailto:/, '');
    if (!address) {
      return null;
    }

    const subject = encodeURIComponent('Feature Trial Request');
    const body = encodeURIComponent(shareMessage);
    return `mailto:${address}?subject=${subject}&body=${body}`;
  }, [shareMessage, socialLinks]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Failed to copy message. Please copy it manually.');
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!isSignedIn) {
      setError('Please sign in to claim your 100 free credits.');
      return;
    }

    if (feature === 'other' && !otherText.trim()) {
      setError('Please describe the feature you want to try.');
      return;
    }

    const payload: FeatureInterestPayload = {
      feature,
      otherText: feature === 'other' ? otherText.trim() : undefined,
      selectedPlatform: selectedPlatform || undefined,
    };

    setSubmitting(true);

    try {
      const response = await fetch('/api/lead/feature-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as FeatureInterestResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim credits.');
      }

      setSubmitted(true);
      setAlreadyClaimed(Boolean(data.alreadyClaimed));
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to claim credits.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!submitted && (
        <>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-[#666666]">
            <div className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-center">1. Pick</div>
            <div className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-center">2. Claim</div>
            <div className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-center">3. Send</div>
          </div>

          <div>
            <label className="block text-[12px] font-medium tracking-wide uppercase text-[#666666] mb-2">Feature</label>
            <Select value={feature} onValueChange={(value: string) => setFeature(value as FeatureInterestOption)}>
              <SelectTrigger aria-label="Feature">
                <div className="flex min-w-0 items-center gap-2">
                  <SelectValue placeholder="Select a feature" />
                  {selectedFeatureOption?.isNew ? (
                    <Badge className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black">
                      New
                    </Badge>
                  ) : null}
                </div>
              </SelectTrigger>
              <SelectContent>
                {FEATURE_INTEREST_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <SelectItemText>{option.label}</SelectItemText>
                      {option.isNew ? (
                        <Badge className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black">
                          New
                        </Badge>
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {feature === 'other' && (
            <div>
              <label className="block text-[12px] font-medium tracking-wide uppercase text-[#666666] mb-2">Custom</label>
              <input
                type="text"
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
                placeholder="What would you like to try?"
                className="w-full rounded-xl border border-[#D9D9D9] bg-white px-3 py-3 text-[15px] text-black placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium tracking-wide uppercase text-[#666666] mb-2">Platform (optional)</label>
            <select
              value={selectedPlatform}
              onChange={(event) => setSelectedPlatform(event.target.value)}
              className="w-full rounded-xl border border-[#D9D9D9] bg-white px-3 py-3 text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Not selected</option>
              {socialLinks.map((link) => (
                <option key={link.label} value={link.label}>
                  {link.label}
                </option>
              ))}
            </select>
          </div>

          {isSignedIn ? (
            <button
              onClick={handleSubmit}
              disabled={!isLoaded || submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gift className="w-4 h-4" />
              {submitting ? 'Claiming...' : submitLabel}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#1a1a1a]">
                <Gift className="w-4 h-4" />
                Sign in to claim credits
              </button>
            </SignInButton>
          )}
        </>
      )}

      {submitted && (
        <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-[14px] font-medium text-black">
            {alreadyClaimed ? 'Reward already claimed.' : '100 credits added to your account.'}
          </p>
          <p className="text-[13px] text-[#666666]">Copy this message and send it on any platform:</p>

          <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-[13px] text-[#333333] leading-6">
            {shareMessage}
          </div>

          <button
            onClick={handleCopyMessage}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-black px-4 py-2.5 text-[14px] font-medium text-black hover:bg-[#F7F7F7] transition-colors"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied' : 'Copy Message'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {socialLinks.map((link) => {
              const href = link.label === 'Email' && mailtoLink ? mailtoLink : link.href;
              const Icon = link.icon;

              return (
                <a
                  key={link.label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-[13px] font-medium text-black hover:border-black transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function FeatureInterestReward({
  variant = 'embedded',
  className = '',
  buttonLabel = 'Get 100 Free Credits',
  buttonClassName = '',
  dialogTitle = 'Get 100 Free Credits',
  dialogDescription = 'Tell us which feature you want to try, then send your interest message on any platform.',
  showEmbeddedHeader = true,
  embeddedTitle = 'Get 100 Free Credits',
  embeddedDescription = 'Pick one feature, claim credits, then send one message on your preferred platform.',
  submitLabel = 'Claim 100 Free Credits',
}: FeatureInterestRewardProps) {
  if (variant === 'buttonTrigger') {
    return (
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            className={
              buttonClassName ||
              'inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a1a1a] transition-colors'
            }
          >
            <Gift className="w-4 h-4" />
            <span>{buttonLabel}</span>
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <Dialog.Title className="text-xl font-semibold tracking-tight text-black">{dialogTitle}</Dialog.Title>
                <Dialog.Description className="text-sm text-[#666666] mt-1 leading-6">{dialogDescription}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-[#666666] hover:bg-[#F5F5F5] hover:text-black" aria-label="Close dialog">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <FeatureInterestForm submitLabel={submitLabel} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#E5E5E5] bg-gradient-to-b from-white to-[#FAFAFA] p-5 ${className}`}>
      {showEmbeddedHeader && (
        <div className="mb-4">
          <h3 className="text-[22px] font-semibold tracking-[-0.01em] text-black">{embeddedTitle}</h3>
          <p className="text-[13px] text-[#666666] mt-1 leading-6 max-w-md">{embeddedDescription}</p>
        </div>
      )}

      <FeatureInterestForm submitLabel={submitLabel} />
    </div>
  );
}
