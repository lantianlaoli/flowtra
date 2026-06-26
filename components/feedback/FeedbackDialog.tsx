'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { SignInButton, useUser } from '@clerk/nextjs';
import { CheckCircle2, MessageSquareWarning, X } from 'lucide-react';
import { useI18n } from '@/providers/I18nProvider';

export type FeedbackVariant = 'suggest_tool' | 'general_feedback';

export interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: FeedbackVariant;
  source: string;
  trigger?: React.ReactNode;
}

const VARIANT_LABELS: Record<FeedbackVariant, 'suggest' | 'feedback'> = {
  suggest_tool: 'suggest',
  general_feedback: 'feedback',
};

const VARIANT_KEYS: Record<'suggest' | 'feedback', {
  title: 'titleSuggest' | 'titleFeedback';
  description: 'descriptionSuggest' | 'descriptionFeedback';
  placeholder: 'placeholderSuggest' | 'placeholderFeedback';
  examples: 'hintExamplesSuggest' | 'hintExamplesFeedback';
}> = {
  suggest: {
    title: 'titleSuggest',
    description: 'descriptionSuggest',
    placeholder: 'placeholderSuggest',
    examples: 'hintExamplesSuggest',
  },
  feedback: {
    title: 'titleFeedback',
    description: 'descriptionFeedback',
    placeholder: 'placeholderFeedback',
    examples: 'hintExamplesFeedback',
  },
};

export function FeedbackDialog({
  open,
  onOpenChange,
  variant,
  source,
}: FeedbackDialogProps) {
  const { messages } = useI18n();
  const feedbackCopy = messages.landing.feedback;
  const { isLoaded, isSignedIn } = useUser();

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variantKey = VARIANT_LABELS[variant];
  const keys = VARIANT_KEYS[variantKey];
  const title = feedbackCopy[keys.title];
  const description = feedbackCopy[keys.description];
  const placeholder = feedbackCopy[keys.placeholder];
  const examples = feedbackCopy[keys.examples];

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setMessage('');
        setError(null);
        setSubmitted(false);
      }, 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const handleSubmit = async () => {
    setError(null);

    if (!message.trim()) {
      setError(feedbackCopy.errorEmpty);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), source }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || feedbackCopy.errorGeneric);
      }

      setSubmitted(true);
    } catch (submitError) {
      const errorMessage =
        submitError instanceof Error ? submitError.message : feedbackCopy.errorGeneric;
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setMessage((current) => (current.trim() ? current : example));
  };

  const submitButtonLabel = submitted
    ? feedbackCopy.success
    : submitting
      ? feedbackCopy.submitting
      : feedbackCopy.submit;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-xl font-semibold tracking-tight text-black">
                <MessageSquareWarning className="h-5 w-5" aria-hidden="true" />
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-[#666666] mt-1 leading-6">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-[#666666] hover:bg-[#F5F5F5] hover:text-black"
                aria-label="Close dialog"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="feedback-message"
                className="block text-[12px] font-medium tracking-wide uppercase text-[#666666] mb-2"
              >
                {title}
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (submitted) setSubmitted(false);
                }}
                placeholder={placeholder}
                rows={5}
                disabled={!isSignedIn || submitting}
                className="w-full resize-none rounded-xl border border-[#D9D9D9] bg-white px-3 py-3 text-[15px] text-black placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:bg-[#FAFAFA] disabled:opacity-60"
              />
            </div>

            {examples.length > 0 ? (
              <div>
                <p className="text-[12px] font-medium tracking-wide uppercase text-[#666666] mb-2">
                  {feedbackCopy.hintLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      disabled={!isSignedIn || submitting}
                      className="rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-1.5 text-[12px] text-[#333333] transition-colors hover:border-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isLoaded && isSignedIn ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || submitted}
                aria-live="polite"
                className={`relative w-full inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-[15px] font-semibold text-white transition-all duration-300 ease-out disabled:cursor-not-allowed ${
                  submitted
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : 'bg-black hover:bg-[#1a1a1a] disabled:opacity-50'
                }`}
              >
                <span
                  className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 ease-out ${
                    submitted
                      ? 'translate-y-0 opacity-100'
                      : '-translate-y-2 opacity-0 pointer-events-none'
                  }`}
                  aria-hidden={!submitted}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {feedbackCopy.success}
                </span>
                <span
                  className={`flex items-center justify-center gap-2 transition-all duration-300 ease-out ${
                    submitted
                      ? 'translate-y-2 opacity-0 pointer-events-none'
                      : 'translate-y-0 opacity-100'
                  }`}
                  aria-hidden={submitted}
                >
                  <MessageSquareWarning className="h-4 w-4" />
                  {submitting ? feedbackCopy.submitting : feedbackCopy.submit}
                </span>
              </button>
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#1a1a1a]"
                >
                  <MessageSquareWarning className="h-4 w-4" />
                  {feedbackCopy.signInToSend}
                </button>
              </SignInButton>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FeedbackDialog;

