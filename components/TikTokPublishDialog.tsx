'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TikTokPublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  historyId: string;
  coverImageUrl?: string;
  videoDurationSeconds?: number | null;
  isPhotoPost?: boolean;
  inline?: boolean;
}

type PrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'SELF_ONLY'
  | 'FOLLOWER_OF_CREATOR';

type PublishStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'failed';

interface CreatorInfo {
  creatorNickname?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string;
  privacyLevelOptions: PrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number | null;
  canPost: boolean;
  cannotPostReason?: string;
}

const panelCardClasses =
  'rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.98)_100%)] p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_34px_rgba(15,23,42,0.06)]';

const inputShellClasses =
  'w-full rounded-[22px] border border-[#d9d9d4] bg-white px-4 py-3.5 text-[15px] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(232,232,228,0.98)] transition-[border-color,box-shadow,transform] duration-150 placeholder:text-[#8a8a85] focus:border-black/30 focus:outline-none focus:ring-0 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_0_rgba(232,232,228,0.98)]';

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn('fill-current', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

interface ToggleChipProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function ToggleChip({ label, description, checked, disabled = false, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'my-ads-button my-ads-button--secondary flex min-h-[88px] w-full items-start justify-between rounded-[24px] border px-4 py-4 text-left transition-all',
        checked
          ? 'border-black bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_0_rgba(58,58,58,0.92),0_12px_20px_rgba(0,0,0,0.12)]'
          : 'border-[#dfdfd9] bg-white text-black',
        disabled && 'cursor-not-allowed opacity-45'
      )}
    >
      <div className="pr-3">
        <p className={cn('text-sm font-semibold tracking-tight', checked ? 'text-white' : 'text-black')}>
          {label}
        </p>
        {description ? (
          <p className={cn('mt-1 text-xs leading-relaxed', checked ? 'text-white/72' : 'text-[#6f6f69]')}>
            {description}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
          checked
            ? 'border-white/18 bg-white text-black'
            : 'border-[#d2d2cc] bg-[#f7f7f4] text-transparent'
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export default function TikTokPublishDialog({
  isOpen,
  onClose,
  historyId,
  coverImageUrl,
  videoDurationSeconds,
  isPhotoPost = false,
  inline = false
}: TikTokPublishDialogProps) {
  const [title, setTitle] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel | null>(null);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowComment, setAllowComment] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [publishId, setPublishId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [creatorInfoLoading, setCreatorInfoLoading] = useState(false);
  const [creatorInfoError, setCreatorInfoError] = useState<string | null>(null);
  const [commercialToggle, setCommercialToggle] = useState(false);
  const [commercialYourBrand, setCommercialYourBrand] = useState(false);
  const [commercialBrandedContent, setCommercialBrandedContent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPrivacyLevel(null);
      setAllowDuet(false);
      setAllowComment(false);
      setAllowStitch(false);
      setStatus('idle');
      setPublishId(null);
      setErrorMessage(null);
      setPostId(null);
      setCreatorInfo(null);
      setCreatorInfoError(null);
      setCommercialToggle(false);
      setCommercialYourBrand(false);
      setCommercialBrandedContent(false);
      setFormError(null);
    }
  }, [isOpen]);

  // Fetch latest creator info whenever dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    const loadCreatorInfo = async () => {
      setCreatorInfoLoading(true);
      setCreatorInfoError(null);

      try {
        const response = await fetch('/api/tiktok/publish/creator-info', {
          method: 'GET',
          signal: controller.signal
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch TikTok creator info');
        }

        const info: CreatorInfo = {
          creatorNickname: result.data?.creatorNickname,
          creatorUsername: result.data?.creatorUsername,
          creatorAvatarUrl: result.data?.creatorAvatarUrl,
          privacyLevelOptions: result.data?.privacyLevelOptions || [],
          commentDisabled: !!result.data?.commentDisabled,
          duetDisabled: !!result.data?.duetDisabled,
          stitchDisabled: !!result.data?.stitchDisabled,
          maxVideoPostDurationSec: result.data?.maxVideoPostDurationSec ?? null,
          canPost: result.data?.canPost !== false,
          cannotPostReason: result.data?.cannotPostReason || undefined
        };

        setCreatorInfo(info);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Creator info error:', error);
        setCreatorInfoError(error instanceof Error ? error.message : 'Failed to fetch TikTok creator info');
      } finally {
        setCreatorInfoLoading(false);
      }
    };

    loadCreatorInfo();

    return () => controller.abort();
  }, [isOpen]);

  // Poll status if we have a publishId
  useEffect(() => {
    if (!publishId || status !== 'processing') return;

    let isCancelled = false;
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/tiktok/publish/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ publishId })
        });

        const result = await response.json();

        if (!isCancelled) {
          if (result.success) {
            if (result.isComplete) {
              setStatus('success');
              setPostId(result.postId);
              clearInterval(pollInterval);
            } else if (result.isFailed) {
              setStatus('failed');
              setErrorMessage(result.failReason || 'TikTok rejected the video');
              clearInterval(pollInterval);
            }
            // Otherwise keep polling (still processing)
          } else {
            setStatus('failed');
            setErrorMessage(result.error || 'Failed to check status');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Status polling error:', error);
          // Don't fail immediately - TikTok might still be processing
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [publishId, status]);

  const privacyOptions = useMemo(() => {
    return creatorInfo?.privacyLevelOptions || [];
  }, [creatorInfo]);

  const isCreatorReady = !!creatorInfo && creatorInfo.canPost;

  const maxDurationSeconds = creatorInfo?.maxVideoPostDurationSec ?? null;
  const durationTooLong = typeof videoDurationSeconds === 'number' && maxDurationSeconds !== null
    ? videoDurationSeconds > maxDurationSeconds
    : false;

  const requiresCommercialSelection = commercialToggle && !commercialYourBrand && !commercialBrandedContent;
  const brandedContentSelected = commercialToggle && commercialBrandedContent;
  const privacyAllowsBrandedContent = privacyLevel !== null && privacyLevel !== 'SELF_ONLY';

  const disabledPrivacyOptions = useMemo(() => {
    if (!brandedContentSelected) return new Set<PrivacyLevel>();
    return new Set<PrivacyLevel>(['SELF_ONLY']);
  }, [brandedContentSelected]);

  useEffect(() => {
    if (!brandedContentSelected) return;
    if (privacyLevel !== 'SELF_ONLY') return;

    const nextPrivacy = privacyOptions.find((option) => option !== 'SELF_ONLY') || null;
    setPrivacyLevel(nextPrivacy);
  }, [brandedContentSelected, privacyLevel, privacyOptions]);

  const confirmationIncludesBrandedPolicy = commercialToggle && commercialBrandedContent;

  const privacyLabelMap: Record<PrivacyLevel, string> = {
    PUBLIC_TO_EVERYONE: 'Public',
    MUTUAL_FOLLOW_FRIENDS: 'Friends',
    SELF_ONLY: 'Private',
    FOLLOWER_OF_CREATOR: 'Followers'
  };

  const brandedContentAllowed = useMemo(() => {
    return privacyOptions.some((option) => option !== 'SELF_ONLY');
  }, [privacyOptions]);

  const publishDisabled = !title.trim()
    || !privacyLevel
    || !creatorInfo
    || !isCreatorReady
    || creatorInfoLoading
    || !!creatorInfoError
    || durationTooLong
    || requiresCommercialSelection
    || (brandedContentSelected && !privacyAllowsBrandedContent);

  const handleSubmit = async () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please enter a title before publishing.');
      return;
    }

    if (!creatorInfo || creatorInfoLoading) {
      setFormError('Please wait while we load your TikTok creator info.');
      return;
    }

    if (!creatorInfo.canPost) {
      setFormError(creatorInfo.cannotPostReason || 'TikTok cannot accept new posts from this account right now. Please try again later.');
      return;
    }

    if (!privacyLevel) {
      setFormError('Please select a privacy setting.');
      return;
    }

    if (durationTooLong) {
      setFormError('This video exceeds the maximum duration allowed for your TikTok account.');
      return;
    }

    if (requiresCommercialSelection) {
      setFormError('Select at least one commercial content option to proceed.');
      return;
    }

    if (brandedContentSelected && privacyLevel === 'SELF_ONLY') {
      setFormError('Branded content cannot be posted with private visibility.');
      return;
    }

    setStatus('uploading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/tiktok/publish/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
          body: JSON.stringify({
            historyId,
            title: title.trim(),
            privacyLevel,
            disableDuet: isPhotoPost ? true : !allowDuet || !!creatorInfo?.duetDisabled,
            disableComment: !allowComment || !!creatorInfo?.commentDisabled,
            disableStitch: isPhotoPost ? true : !allowStitch || !!creatorInfo?.stitchDisabled,
            videoCoverTimestampMs: 1000,
            commercialContentEnabled: commercialToggle,
            commercialYourBrand,
            commercialBrandedContent,
            expressConsent: true
          })
        });

      const result = await response.json();

      if (result.success) {
        setPublishId(result.publishId);
        setStatus('processing');
      } else {
        setStatus('failed');
        setErrorMessage(result.error || 'Failed to publish video');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status === 'idle') {
      onClose();
    }
  };

  const handleClose = () => {
    if (status !== 'uploading' && status !== 'processing') {
      onClose();
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'success':
        return <Check className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading video to TikTok...';
      case 'processing':
        return 'TikTok is processing your video...';
      case 'success':
        return 'Successfully published to TikTok!';
      case 'failed':
        return 'Failed to publish';
      default:
        return '';
    }
  };

  const dialogContent = (
    <div
      className={cn(
        "relative bg-white rounded-xl shadow-lg border border-gray-200 w-full mx-auto overflow-y-auto",
        inline ? "max-w-none max-h-none shadow-none border-none p-0" : "max-w-lg max-h-[90vh]"
      )}
      role="dialog"
      aria-modal={!inline}
      aria-labelledby="dialog-title"
    >
      {/* Close button */}
      {!inline && status !== 'uploading' && status !== 'processing' && (
        <button
          onClick={handleClose}
          className="my-ads-button my-ads-button--secondary absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#dfdfd9] bg-white text-[#63635e]"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Content */}
      <div className={inline ? "p-0" : "p-6"}>
        {inline && (
          <div className="mb-5">
            <h3 id="dialog-title" className="text-[2rem] font-semibold tracking-[-0.03em] text-black">Post to TikTok</h3>
            <p className="mt-1 text-[15px] text-[#6f6f69]">Polish your caption, privacy, and interaction settings before posting.</p>
          </div>
        )}
              {/* Title with TikTok branding */}
              {!inline && (
                <div className="mb-6 flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] bg-black">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ea] via-[#ff0050] to-[#00f2ea] opacity-20 animate-tiktok-shimmer bg-[length:200%_200%]" />
                  <TikTokGlyph className="relative z-10 h-7 w-7 text-white" />
                </div>
                <div>
                  <h3
                    id="dialog-title"
                    className="text-xl font-semibold tracking-tight text-black"
                  >
                    Post to TikTok
                  </h3>
                  <p className="mt-0.5 text-sm text-[#6f6f69]">Refine the post details and publish from one clean panel.</p>
                </div>
              </div>
              )}

              {/* Status Message */}
              {status !== 'idle' && !inline && (
                <div className={cn(
                  "mb-6 p-4 rounded-xl border flex items-start gap-3 transition-all",
                  status === 'success' && "bg-green-50 border-green-200",
                  status === 'failed' && "bg-red-50 border-red-200",
                  (status === 'uploading' || status === 'processing') && "bg-blue-50 border-blue-200"
                )}>
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon()}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-semibold",
                      status === 'success' && "text-green-900",
                      status === 'failed' && "text-red-900",
                      (status === 'uploading' || status === 'processing') && "text-blue-900"
                    )}>
                      {getStatusText()}
                    </p>
                    {(status === 'uploading' || status === 'processing' || status === 'success') && (
                      <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
                        After publishing, TikTok may take a few minutes to process and show your post on the profile.
                      </p>
                    )}
                    {errorMessage && (
                      <p className="text-sm text-red-700 mt-1.5 leading-relaxed">
                        {errorMessage}
                      </p>
                    )}
                    {postId && (
                      <a
                        href={`https://www.tiktok.com/@me/video/${postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mt-2 group"
                      >
                        <span>View on TikTok</span>
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Preview (hide in inline mode) */}
              {coverImageUrl && status === 'idle' && !inline && (
                <div className="mb-4">
                  <div className="relative w-full aspect-[9/16] max-w-[200px] mx-auto rounded-lg overflow-hidden border border-gray-200">
                    <Image
                      src={coverImageUrl}
                      alt="Video cover"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Inline Status Panel */}
              {inline && status !== 'idle' && (
                <div className="mb-6 rounded-xl border border-[#E5E5E5] bg-white p-6">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon()}
                    <p className="text-sm font-semibold text-gray-900">
                      {getStatusText()}
                    </p>
                  </div>
                  {status === 'uploading' || status === 'processing' ? (
                    <div className="space-y-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-black/80" />
                      </div>
                      <p className="text-xs text-gray-600">
                        After publishing, TikTok may take a few minutes to process and show your post on the profile.
                      </p>
                    </div>
                  ) : (
                    <>
                      {status === 'success' && (
                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                          After publishing, TikTok may take a few minutes to process and show your post on the profile.
                        </p>
                      )}
                      {errorMessage && (
                        <p className="text-sm text-red-700 mt-2 leading-relaxed">
                          {errorMessage}
                        </p>
                      )}
                      {postId && (
                        <a
                          href={`https://www.tiktok.com/@me/video/${postId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mt-2 group"
                        >
                          <span>View on TikTok</span>
                          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </a>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Form */}
              {status === 'idle' && (
                <div className="space-y-5">
                  {/* Creator Info */}
                  <div className={cn(panelCardClasses, 'overflow-hidden')}>
                    {creatorInfoLoading ? (
                      <div className="flex items-center gap-2 text-sm text-[#6f6f69]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading TikTok creator info...
                      </div>
                    ) : creatorInfoError ? (
                      <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <span>{creatorInfoError}</span>
                      </div>
                    ) : creatorInfo ? (
                      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                        <div className="flex items-center gap-4">
                          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_0_rgba(58,58,58,0.92)]">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ea] via-[#ff0050] to-[#00f2ea] opacity-15" />
                            {creatorInfo.creatorAvatarUrl ? (
                              <Image
                                src={creatorInfo.creatorAvatarUrl}
                                alt={creatorInfo.creatorNickname || 'TikTok creator'}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <TikTokGlyph className="relative z-10 h-6 w-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b7b75]">
                              Connected account
                            </p>
                            <p className="mt-1 text-lg font-semibold tracking-tight text-black">
                              {creatorInfo.creatorNickname || 'TikTok creator'}
                            </p>
                            {creatorInfo.creatorUsername && (
                              <p className="mt-0.5 text-sm text-[#6f6f69]">@{creatorInfo.creatorUsername}</p>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <div className="rounded-[22px] border border-black/8 bg-white/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(232,232,228,0.9)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b75]">Publish status</p>
                            <p className="mt-1 text-sm font-semibold text-black">{creatorInfo.canPost ? 'Ready to post' : 'Posting unavailable'}</p>
                          </div>
                          {typeof creatorInfo.maxVideoPostDurationSec === 'number' && (
                            <div className="rounded-[22px] border border-black/8 bg-white/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(232,232,228,0.9)]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b75]">Account limit</p>
                              <p className="mt-1 text-sm font-semibold text-black">{creatorInfo.maxVideoPostDurationSec}s max length</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Connect TikTok to continue.</p>
                    )}
                  </div>

                  {!isCreatorReady && creatorInfo && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-yellow-900">
                            TikTok can’t accept new posts right now
                          </p>
                          <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                            {creatorInfo.cannotPostReason || 'Please try again later.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {durationTooLong && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900">
                            Video exceeds the maximum length allowed for this TikTok account.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                      {formError}
                    </div>
                  )}

                  <div className={panelCardClasses}>
                    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                      <div>
                        <label htmlFor="title" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6f69]">
                          Video title <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="title"
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Write a sharp, scroll-stopping caption..."
                          maxLength={150}
                          className={inputShellClasses}
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs leading-relaxed text-[#6f6f69]">
                            Keep it crisp, readable, and native to how TikTok captions feel.
                          </p>
                          <p className={cn(
                            'text-xs font-semibold tabular-nums',
                            title.length > 140 ? 'text-orange-600' : 'text-[#9a9a94]'
                          )}>
                            {title.length}/150
                          </p>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="privacy" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6f69]">
                          Privacy <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="privacy"
                          value={privacyLevel || ''}
                          onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}
                          className={cn(inputShellClasses, 'appearance-none bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,247,1)_100%)]')}
                        >
                          <option value="" disabled>
                            Select privacy
                          </option>
                          {privacyOptions.map((option) => (
                            <option
                              key={option}
                              value={option}
                              disabled={disabledPrivacyOptions.has(option)}
                              title={disabledPrivacyOptions.has(option) && option === 'SELF_ONLY'
                                ? 'Branded content visibility cannot be set to private.'
                                : undefined}
                            >
                              {privacyLabelMap[option] || option}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs leading-relaxed text-[#6f6f69]">
                          Choose who can see the post once TikTok finishes processing it.
                        </p>
                        {brandedContentSelected && (
                          <p className="mt-2 text-xs font-medium text-red-600">
                            Branded content visibility cannot be set to private.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interaction Settings */}
                  <div className={panelCardClasses}>
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6f69]">Interaction settings</p>
                      <p className="mt-1 text-sm text-[#6f6f69]">Choose which TikTok-native interactions stay available on the post.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <ToggleChip
                        label="Allow Comments"
                        description="Let viewers react directly under the post."
                        checked={allowComment}
                        disabled={creatorInfo?.commentDisabled}
                        onToggle={() => setAllowComment((prev) => !prev)}
                      />
                      {!isPhotoPost && (
                        <ToggleChip
                          label="Allow Duet"
                          description="Enable audience remixing with a split response."
                          checked={allowDuet}
                          disabled={creatorInfo?.duetDisabled}
                          onToggle={() => setAllowDuet((prev) => !prev)}
                        />
                      )}
                      {!isPhotoPost && (
                        <ToggleChip
                          label="Allow Stitch"
                          description="Allow creators to quote and build on your clip."
                          checked={allowStitch}
                          disabled={creatorInfo?.stitchDisabled}
                          onToggle={() => setAllowStitch((prev) => !prev)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Commercial Content Disclosure */}
                  <div className={panelCardClasses}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-xl">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6f69]">Commercial disclosure</p>
                        <p className="mt-1 text-base font-semibold tracking-tight text-black">Declare promotional or partnership context before publishing.</p>
                        <p className="mt-2 text-sm leading-relaxed text-[#6f6f69]">
                          Turn this on when the post promotes your own offer, a paid partner, or both.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={commercialToggle}
                        onClick={() => {
                          const nextValue = !commercialToggle;
                          setCommercialToggle(nextValue);
                          if (!nextValue) {
                            setCommercialYourBrand(false);
                            setCommercialBrandedContent(false);
                          }
                        }}
                        className={cn(
                          'my-ads-button inline-flex min-w-[148px] items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold',
                          commercialToggle
                            ? 'my-ads-button--primary border-black bg-black text-white'
                            : 'my-ads-button--secondary border-[#dfdfd9] bg-white text-black'
                        )}
                      >
                        {commercialToggle ? 'Disclosure on' : 'Disclosure off'}
                      </button>
                    </div>

                    {commercialToggle && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <ToggleChip
                          label="Your brand"
                          description="Use this when the post promotes your own product or store."
                          checked={commercialYourBrand}
                          onToggle={() => setCommercialYourBrand((prev) => !prev)}
                        />
                        <ToggleChip
                          label="Branded content"
                          description="Use this when a third-party brand or paid partnership is involved."
                          checked={commercialBrandedContent}
                          disabled={!brandedContentAllowed}
                          onToggle={() => setCommercialBrandedContent((prev) => !prev)}
                        />
                      </div>
                    )}

                    {commercialToggle && (
                      <div className="mt-4 space-y-2">
                        {requiresCommercialSelection && (
                          <p className="text-xs text-red-600" title="You need to indicate if your content promotes yourself, a third party, or both.">
                            You need to indicate if your content promotes yourself, a third party, or both.
                          </p>
                        )}

                        {commercialYourBrand && !commercialBrandedContent && (
                          <p className="text-xs text-gray-600">
                            Your photo/video will be labeled as &quot;Promotional content&quot;.
                          </p>
                        )}
                        {commercialBrandedContent && (
                          <p className="text-xs text-gray-600">
                            Your photo/video will be labeled as &quot;Paid partnership&quot;.
                          </p>
                        )}
                        {!brandedContentAllowed && commercialToggle && (
                          <p className="text-xs text-red-600">
                            Branded content visibility cannot be set to private.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[22px] border border-black/8 bg-[linear-gradient(135deg,rgba(0,242,234,0.06)_0%,rgba(255,255,255,0.95)_38%,rgba(255,0,80,0.06)_100%)] px-4 py-3 text-sm text-[#5f5f5a] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    After publishing, TikTok may take a few minutes to process and show your post on the profile.
                  </div>
                </div>
              )}

              {status === 'idle' && (
                <p className="mt-6 text-xs leading-relaxed text-[#6f6f69]">
                  By posting, you agree to TikTok&apos;s{' '}
                  {confirmationIncludesBrandedPolicy && (
                    <>
                      <a
                        href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-500"
                      >
                        Branded Content Policy
                      </a>{' '}
                      and{' '}
                    </>
                  )}
                  <a
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-500"
                  >
                    Music Usage Confirmation
                  </a>
                  .
                </p>
              )}

              {/* Actions */}
              <div className={cn("mt-3 flex flex-col-reverse sm:flex-row gap-3", inline && "pb-2")}>
                {status === 'idle' ? (
                  <>
                    <button
                      onClick={handleClose}
                      className={cn(
                        "my-ads-button my-ads-button--secondary flex-1 rounded-[24px] border border-[#dfdfd9] px-5 py-3 text-sm font-semibold text-[#4d4d47]",
                        inline && "hidden"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={publishDisabled}
                      className="my-ads-button my-ads-button--primary group relative flex-1 overflow-hidden rounded-[24px] border border-black transition-all duration-300 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,242,234,0.18)_0%,rgba(255,255,255,0)_32%,rgba(255,0,80,0.18)_100%)] opacity-90" />
                      <div className="absolute inset-0 bg-black/88 transition-colors group-hover:bg-black/84" />

                      {/* Button content */}
                      <div className="relative flex items-center justify-center gap-2.5 px-5 py-3">
                        <TikTokGlyph className="h-4 w-4 text-white" />
                        <span className="font-semibold tracking-tight text-white">Publish to TikTok</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(status === 'success' || status === 'failed') ? handleClose : undefined}
                    disabled={status === 'uploading' || status === 'processing'}
                    className={cn(
                      "my-ads-button flex w-full items-center justify-center gap-2 rounded-[24px] border px-5 py-3 text-sm font-semibold",
                      (status === 'uploading' || status === 'processing')
                        ? "border-[#dfdfd9] bg-[#f3f3f0] text-[#9b9b95] cursor-not-allowed shadow-none"
                        : "my-ads-button--primary border-black bg-black text-white"
                    )}
                  >
                    {(status === 'uploading' || status === 'processing') ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <span>{inline ? 'Back to Details' : 'Close'}</span>
                    )}
                  </button>
                )}
              </div>
      </div>
    </div>
  );

  if (inline) {
    return isOpen ? dialogContent : null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog Card */}
          <motion.div
            className="w-full max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {dialogContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
