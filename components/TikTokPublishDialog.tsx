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
  const [consentChecked, setConsentChecked] = useState(false);
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
      setConsentChecked(false);
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

  const publishDeclaration = useMemo(() => {
    if (!commercialToggle) {
      return "By posting, you agree to TikTok's Music Usage Confirmation.";
    }
    if (commercialYourBrand && commercialBrandedContent) {
      return "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.";
    }
    if (commercialBrandedContent) {
      return "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.";
    }
    return "By posting, you agree to TikTok's Music Usage Confirmation.";
  }, [commercialToggle, commercialYourBrand, commercialBrandedContent]);

  const privacyLabelMap: Record<PrivacyLevel, string> = {
    PUBLIC_TO_EVERYONE: 'Public',
    MUTUAL_FOLLOW_FRIENDS: 'Friends',
    SELF_ONLY: 'Only me',
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
    || (brandedContentSelected && !privacyAllowsBrandedContent)
    || !consentChecked;

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

    if (!consentChecked) {
      setFormError('Please confirm the declaration before publishing.');
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
            expressConsent: consentChecked
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
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors z-10"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* Content */}
      <div className={inline ? "p-0" : "p-6"}>
        {inline && (
          <div className="mb-4">
            <h3 id="dialog-title" className="text-xl font-bold text-gray-900">Post to TikTok</h3>
            <p className="text-sm text-gray-500 mt-0.5">Share your video with the world</p>
          </div>
        )}
              {/* Title with TikTok branding */}
              {!inline && (
                <div className="flex items-center gap-3 mb-6">
                <div className="relative w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ea] via-[#ff0050] to-[#00f2ea] opacity-20 animate-tiktok-shimmer bg-[length:200%_200%]" />

                  {/* TikTok icon */}
                  <svg
                    className="w-7 h-7 fill-white relative z-10"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <div>
                  <h3
                    id="dialog-title"
                    className="text-xl font-bold text-gray-900"
                  >
                    Post to TikTok
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Share your video with the world</p>
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
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    {creatorInfoLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading TikTok creator info...
                      </div>
                    ) : creatorInfoError ? (
                      <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <span>{creatorInfoError}</span>
                      </div>
                    ) : creatorInfo ? (
                      <div className="flex items-center gap-3">
                        {creatorInfo.creatorAvatarUrl ? (
                          <Image
                            src={creatorInfo.creatorAvatarUrl}
                            alt={creatorInfo.creatorNickname || 'TikTok creator'}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-black/10" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            Posting as {creatorInfo.creatorNickname || 'TikTok creator'}
                          </p>
                          {creatorInfo.creatorUsername && (
                            <p className="text-xs text-gray-500">@{creatorInfo.creatorUsername}</p>
                          )}
                          {typeof creatorInfo.maxVideoPostDurationSec === 'number' && (
                            <p className="text-xs text-gray-500 mt-1">
                              Max video length: {creatorInfo.maxVideoPostDurationSec}s
                            </p>
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
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {formError}
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
                      Video Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Make it catchy..."
                      maxLength={150}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all text-sm"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500">
                        Create an engaging title for your video
                      </p>
                      <p className={cn(
                        "text-xs font-medium",
                        title.length > 140 ? "text-orange-600" : "text-gray-400"
                      )}>
                        {title.length}/150
                      </p>
                    </div>
                  </div>

                  {/* Privacy */}
                  <div>
                    <label htmlFor="privacy" className="block text-sm font-semibold text-gray-900 mb-2">
                      Privacy <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="privacy"
                      value={privacyLevel || ''}
                      onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all text-sm bg-white"
                    >
                      <option value="" disabled>
                        Select privacy
                      </option>
                      {privacyOptions.map((option) => (
                        <option key={option} value={option} disabled={disabledPrivacyOptions.has(option)}>
                          {privacyLabelMap[option] || option}
                        </option>
                      ))}
                    </select>
                    {brandedContentSelected && (
                      <p className="text-xs text-red-600 mt-2">
                        Branded content visibility cannot be set to private.
                      </p>
                    )}
                  </div>

                  {/* Interaction Settings */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Interaction Settings
                    </label>
                    <div className="space-y-2.5">
                      <label className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                        (creatorInfo?.commentDisabled ?? false) ? "opacity-60 cursor-not-allowed bg-gray-50" : "hover:bg-gray-50 cursor-pointer"
                      )}>
                        <input
                          type="checkbox"
                          checked={allowComment}
                          onChange={(e) => setAllowComment(e.target.checked)}
                          disabled={creatorInfo?.commentDisabled}
                          className="w-4 h-4 text-black border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Allow Comments</span>
                      </label>
                      {!isPhotoPost && (
                        <label className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                          (creatorInfo?.duetDisabled ?? false) ? "opacity-60 cursor-not-allowed bg-gray-50" : "hover:bg-gray-50 cursor-pointer"
                        )}>
                          <input
                            type="checkbox"
                            checked={allowDuet}
                            onChange={(e) => setAllowDuet(e.target.checked)}
                            disabled={creatorInfo?.duetDisabled}
                            className="w-4 h-4 text-black border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">Allow Duet</span>
                        </label>
                      )}
                      {!isPhotoPost && (
                        <label className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                          (creatorInfo?.stitchDisabled ?? false) ? "opacity-60 cursor-not-allowed bg-gray-50" : "hover:bg-gray-50 cursor-pointer"
                        )}>
                          <input
                            type="checkbox"
                            checked={allowStitch}
                            onChange={(e) => setAllowStitch(e.target.checked)}
                            disabled={creatorInfo?.stitchDisabled}
                            className="w-4 h-4 text-black border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">Allow Stitch</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Commercial Content Disclosure */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-white">
                    <label className="flex items-center justify-between text-sm font-semibold text-gray-900">
                      Commercial Content Disclosure
                      <input
                        type="checkbox"
                        checked={commercialToggle}
                        onChange={(e) => {
                          setCommercialToggle(e.target.checked);
                          if (!e.target.checked) {
                            setCommercialYourBrand(false);
                            setCommercialBrandedContent(false);
                          }
                        }}
                        className="w-4 h-4 text-black border-gray-300 rounded"
                      />
                    </label>

                    {commercialToggle && (
                      <div className="mt-3 space-y-2">
                        <label className="flex items-center gap-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={commercialYourBrand}
                            onChange={(e) => setCommercialYourBrand(e.target.checked)}
                            className="w-4 h-4 text-black border-gray-300 rounded"
                          />
                          Your brand
                        </label>
                        <label className={cn(
                          "flex items-center gap-3 text-sm text-gray-700",
                          !brandedContentAllowed ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        )}>
                          <input
                            type="checkbox"
                            checked={commercialBrandedContent}
                            onChange={(e) => setCommercialBrandedContent(e.target.checked)}
                            disabled={!brandedContentAllowed}
                            className="w-4 h-4 text-black border-gray-300 rounded"
                          />
                          Branded content
                        </label>

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

                  {/* Declaration & Consent */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {publishDeclaration}
                    </p>
                    <label className="mt-3 flex items-start gap-3 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-black border-gray-300 rounded"
                      />
                      <span>I confirm the preview above and consent to upload this content to TikTok.</span>
                    </label>
                  </div>

                  <p className="text-xs text-gray-500">
                    After publishing, TikTok may take a few minutes to process and show your post on the profile.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className={cn("mt-8 flex flex-col-reverse sm:flex-row gap-3", inline && "pb-2")}>
                {status === 'idle' ? (
                  <>
                    <button
                      onClick={handleClose}
                      className={cn(
                        "flex-1 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-medium",
                        inline && "hidden"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={publishDisabled}
                      className="group relative flex-1 overflow-hidden rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Gradient background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ea] via-[#ff0050] to-[#00f2ea] bg-[length:200%_100%] animate-tiktok-shimmer" />

                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-black/80 group-hover:bg-black/70 transition-colors" />

                      {/* Button content */}
                      <div className="relative flex items-center justify-center gap-2 px-5 py-2.5">
                        <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        <span className="font-bold text-white">Publish to TikTok</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(status === 'success' || status === 'failed') ? handleClose : undefined}
                    disabled={status === 'uploading' || status === 'processing'}
                    className={cn(
                      "w-full px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors",
                      (status === 'uploading' || status === 'processing')
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-800"
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
