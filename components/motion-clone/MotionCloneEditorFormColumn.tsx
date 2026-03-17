'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Image as ImageIcon, Video as VideoIcon, Sparkles, Loader2 } from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import type { UserAvatar, UserProduct } from '@/lib/supabase';

interface MotionCloneEditorFormColumnProps {
  photoPrompt: string;
  onPhotoPromptChange: (value: string) => void;
  videoPrompt: string;
  onVideoPromptChange: (value: string) => void;
  avatars: UserAvatar[];
  products: UserProduct[];
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  canGenerateImage: boolean;
  canGenerateVideo: boolean;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  videoCreditsCost: number;
  creditsIcon?: ReactNode;
}

export default function MotionCloneEditorFormColumn({
  photoPrompt,
  onPhotoPromptChange,
  videoPrompt,
  onVideoPromptChange,
  avatars,
  products,
  onGenerateImage,
  onGenerateVideo,
  canGenerateImage,
  canGenerateVideo,
  isGeneratingImage,
  isGeneratingVideo,
  videoCreditsCost,
  creditsIcon,
}: MotionCloneEditorFormColumnProps) {
  const characterMentions = useMemo(() => (
    avatars.map(avatar => ({
      id: avatar.id,
      label: avatar.avatar_name || 'Avatar',
      imageUrl: avatar.photo_url
    }))
  ), [avatars]);

  const productMentions = useMemo(() => (
    products.map(product => {
      const photos = product.user_product_photos || [];
      const primary = photos.find(photo => photo.is_primary);
      return {
        id: product.id,
        label: product.product_name,
        imageUrl: primary?.photo_url || photos[0]?.photo_url || null
      };
    })
  ), [products]);

  return (
    <div className="motion-clone-editor-form flex h-full flex-col bg-white">
      {/* Header */}
      <div className="motion-clone-editor-form-header flex items-center justify-between gap-3 border-b border-[#E5E5E5] bg-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="motion-clone-editor-form-icon h-4 w-4 text-black" />
          <h2 className="motion-clone-editor-form-title text-sm font-semibold text-black">Prompts</h2>
        </div>
        <p className="text-right text-[11px] font-medium text-[#666666]">
          Use @ in both prompts for characters or products.
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden p-3">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="motion-clone-editor-card flex min-h-0 flex-1 flex-col rounded-lg border border-[#E5E5E5] bg-white p-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="motion-clone-editor-label-icon w-4 h-4 text-black" />
              <p className="motion-clone-editor-label text-sm font-semibold text-black">Image Prompt</p>
            </div>
            <div className="mt-2.5 flex-1 min-h-0">
              <PromptMentionTextarea
                value={photoPrompt}
                onChange={onPhotoPromptChange}
                rows={4}
                placeholder="Describe the subject swap you want while keeping the same scene..."
                characterMentions={characterMentions}
                productMentions={productMentions}
                className="h-full min-h-[170px]"
                preventHorizontalScroll
              />
            </div>
          </div>

          <div className="motion-clone-editor-card flex min-h-0 flex-1 flex-col rounded-lg border border-[#E5E5E5] bg-white p-3">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <VideoIcon className="motion-clone-editor-label-icon w-4 h-4 text-black" />
                <p className="motion-clone-editor-label text-sm font-semibold text-black">Video Prompt</p>
              </div>
            </div>
            <div className="mt-2.5 flex-1 min-h-0">
              <PromptMentionTextarea
                value={videoPrompt}
                onChange={onVideoPromptChange}
                rows={5}
                placeholder="Describe how the video should behave..."
                characterMentions={characterMentions}
                productMentions={productMentions}
                preventHorizontalScroll
                className="h-full min-h-[190px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer with Buttons */}
      <div className="motion-clone-editor-footer border-t border-[#E5E5E5] bg-white p-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="motion-clone-editor-primary inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-base font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerateImage || isGeneratingImage}
            onClick={onGenerateImage}
          >
            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {isGeneratingImage ? 'Generating Image...' : 'Generate Image'}
            <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              FREE
            </span>
          </button>
          <button
            type="button"
            className="motion-clone-editor-secondary inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerateVideo || isGeneratingVideo}
            onClick={onGenerateVideo}
          >
            {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
            {isGeneratingVideo ? 'Generating Video...' : 'Generate Video'}
            <span className="ml-1 inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-[#F7F7F7] px-2.5 py-1 text-[11px] font-semibold text-gray-900">
              {creditsIcon}
              <span>{videoCreditsCost}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
