'use client';

import { useMemo } from 'react';
import { Image as ImageIcon, Video as VideoIcon, Sparkles, Loader2 } from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import type { UserAvatar, UserProduct } from '@/lib/supabase';

interface MotionSwapEditorFormColumnProps {
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
  errorMessage?: string | null;
}

export default function MotionSwapEditorFormColumn({
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
  errorMessage
}: MotionSwapEditorFormColumnProps) {
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
    <div className="motion-swap-editor-form flex h-full flex-col bg-white">
      {/* Header */}
      <div className="motion-swap-editor-form-header flex items-center gap-2 border-b border-[#E5E5E5] bg-gray-50 px-4 py-3">
        <Sparkles className="motion-swap-editor-form-icon h-4 w-4 text-black" />
        <h2 className="motion-swap-editor-form-title text-sm font-semibold text-black">Prompts</h2>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="motion-swap-editor-card rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3 shrink-0">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="motion-swap-editor-label-icon w-4 h-4 text-black" />
              <p className="motion-swap-editor-label text-sm font-semibold text-black">First Frame Prompt</p>
            </div>
            <span className="motion-swap-editor-helper text-xs text-[#666666]">Type @ to insert a character or product</span>
          </div>
          <PromptMentionTextarea
            value={photoPrompt}
            onChange={onPhotoPromptChange}
            rows={5}
            placeholder="Describe the exact first frame you want..."
            characterMentions={characterMentions}
            productMentions={productMentions}
          />
        </div>

        <div className="motion-swap-editor-card rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3 flex flex-col flex-1 min-h-[220px]">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <VideoIcon className="motion-swap-editor-label-icon w-4 h-4 text-black" />
              <p className="motion-swap-editor-label text-sm font-semibold text-black">Video Prompt</p>
            </div>
          </div>
          <PromptMentionTextarea
            value={videoPrompt}
            onChange={onVideoPromptChange}
            rows={8}
            placeholder="Describe how the video should behave..."
            characterMentions={characterMentions}
            productMentions={productMentions}
            className="flex-1 min-h-[200px]"
          />
        </div>

        {errorMessage && (
          <div className="motion-swap-editor-error text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Fixed Footer with Buttons */}
      <div className="motion-swap-editor-footer border-t border-[#E5E5E5] bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="motion-swap-editor-primary inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-base font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerateImage || isGeneratingImage}
            onClick={onGenerateImage}
          >
            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            Generate Image
            <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              FREE
            </span>
          </button>
          <button
            type="button"
            className="motion-swap-editor-secondary inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerateVideo || isGeneratingVideo}
            onClick={onGenerateVideo}
          >
            {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
            Generate Video
            <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              FREE
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
