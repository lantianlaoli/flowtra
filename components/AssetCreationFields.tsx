'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Check, CircleHelp, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReferenceImageGrid from './ReferenceImageGrid';

type PreviewImage = {
  src: string;
  alt: string;
};

type ReferenceGridItem = {
  alt: string;
  key: string;
  src: string;
};

type ReferenceGridSlot = {
  description: string;
  label: string;
};

type AssetCreationFieldsProps = {
  fieldBadgeClassName: string;
  formError?: ReactNode;
  highlightReferenceRequirement: boolean;
  isGeneratingReferences: boolean;
  isPrimaryBusy?: boolean;
  nameLabel: string;
  nameInputId: string;
  namePlaceholder: string;
  nameValue: string;
  onGenerateReferences: () => void;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onPrimaryClear: () => void;
  onPrimaryTrigger: () => void;
  onReferenceAdd?: () => void;
  onReferenceRemove: (index: number) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  primaryEmptyCopy: string;
  primaryEmptyTitle: string;
  primaryHelpAriaLabel: string;
  primaryHelpContent?: ReactNode;
  primaryImage: PreviewImage | null;
  primaryPreviewLabel: string;
  primaryTitle: string;
  requiredLabel: string;
  referenceColumns?: 'responsive' | 2 | 3;
  referenceGenerateDisabled?: boolean;
  referenceMinimumLabel: string;
  referenceHelpAriaLabel: string;
  referenceHelpContent?: ReactNode;
  referenceItems: ReferenceGridItem[];
  referenceRemoveDisabled?: boolean;
  referenceSlots: ReferenceGridSlot[];
  referenceTitle: string;
  generateLabel: string;
  generatingLabel: string;
  saveDisabled: boolean;
  saveBusy: boolean;
  cancelLabel: string;
  saveLabel: string;
};

export default function AssetCreationFields({
  fieldBadgeClassName,
  formError,
  highlightReferenceRequirement,
  isGeneratingReferences,
  isPrimaryBusy = false,
  nameLabel,
  nameInputId,
  namePlaceholder,
  nameValue,
  onGenerateReferences,
  onNameChange,
  onCancel,
  onPrimaryClear,
  onPrimaryTrigger,
  onReferenceAdd,
  onReferenceRemove,
  onSubmit,
  primaryEmptyCopy,
  primaryEmptyTitle,
  primaryHelpAriaLabel,
  primaryHelpContent,
  primaryImage,
  primaryPreviewLabel,
  primaryTitle,
  requiredLabel,
  referenceColumns = 'responsive',
  referenceGenerateDisabled = false,
  referenceMinimumLabel,
  referenceHelpAriaLabel,
  referenceHelpContent,
  referenceItems,
  referenceRemoveDisabled = false,
  referenceSlots,
  referenceTitle,
  generateLabel,
  generatingLabel,
  saveDisabled,
  saveBusy,
  cancelLabel,
  saveLabel,
}: AssetCreationFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="assets-modal-body space-y-4 px-6 py-5">
      {formError ? (
        <div className="assets-modal-error flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-2">
        <label htmlFor={nameInputId} className="assets-modal-label block text-sm font-medium text-gray-700">{nameLabel}</label>
        <input
          id={nameInputId}
          type="text"
          value={nameValue}
          onChange={(event) => onNameChange(event.target.value)}
          className="assets-modal-input w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
          placeholder={namePlaceholder}
          maxLength={60}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.02fr_1fr] lg:items-stretch">
        <div className="flex min-h-0 h-full flex-col space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium leading-5 text-gray-900">{primaryTitle}</p>
            <span className={`${fieldBadgeClassName} border-black/10 bg-black/[0.04] text-black/75`}>
              {requiredLabel}
            </span>
            {primaryHelpContent ? (
              <div className="relative group">
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 align-middle"
                  aria-label={primaryHelpAriaLabel}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute left-0 top-6 z-20 w-80 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  {primaryHelpContent}
                </div>
              </div>
            ) : null}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={onPrimaryTrigger}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPrimaryTrigger();
              }
            }}
            className={cn(
              'assets-modal-upload relative w-full flex-1 overflow-hidden rounded-2xl border-2 border-dashed transition min-h-[360px] lg:min-h-0',
              primaryImage ? 'border-gray-300 bg-[#F8F8F8]' : 'border-gray-300 bg-[#FAFAFA]'
            )}
          >
            <div className="absolute left-3 top-3">
              <span className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{primaryPreviewLabel}</span>
            </div>

            {primaryImage ? (
              <>
                <Image src={primaryImage.src} alt={primaryImage.alt} fill className="object-cover" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPrimaryClear();
                  }}
                  className="assets-modal-chip-close absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                  disabled={isPrimaryBusy}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-600">
                <Upload className="mb-3 h-7 w-7 text-gray-400" />
                <p className="text-base font-semibold text-gray-900">{primaryEmptyTitle}</p>
                <p className="mt-1 text-xs text-gray-500">{primaryEmptyCopy}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 h-full flex-col space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 leading-none">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{referenceTitle}</p>
                <motion.span
                className={`${fieldBadgeClassName} ${highlightReferenceRequirement ? 'border-black/20 bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.14)]' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                animate={highlightReferenceRequirement ? { scale: [1, 1.08, 1], x: [0, -3, 3, 0] } : { scale: 1, x: 0 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
              >
                  {referenceMinimumLabel}
                </motion.span>
              </div>
              {referenceHelpContent ? (
                <div className="relative group">
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600"
                    aria-label={referenceHelpAriaLabel}
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute right-0 top-6 z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {referenceHelpContent}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onGenerateReferences}
              disabled={referenceGenerateDisabled}
              className="assets-ai-generate-button inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#1d1d1d] bg-white px-3.5 text-xs font-semibold text-[#111111] shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_4px_0_rgba(34,34,34,0.18),0_12px_18px_rgba(0,0,0,0.06)] transition-all duration-150 hover:translate-y-[2px] hover:bg-[#f5f5f4] hover:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_2px_0_rgba(34,34,34,0.14),0_6px_12px_rgba(0,0,0,0.05)] active:translate-y-[3px] active:shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_1px_0_rgba(34,34,34,0.12),0_4px_8px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:border-[#cfcfc9] disabled:bg-white disabled:text-[#8e8e88] disabled:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_2px_0_rgba(34,34,34,0.08),0_6px_10px_rgba(0,0,0,0.03)]"
            >
              {isGeneratingReferences ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGeneratingReferences ? generatingLabel : generateLabel}
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <ReferenceImageGrid
              columns={referenceColumns}
              items={referenceItems}
              isGenerating={isGeneratingReferences}
              onAdd={onReferenceAdd}
              onRemove={onReferenceRemove}
              removeDisabled={referenceRemoveDisabled}
              slots={referenceSlots}
            />
          </div>
        </div>
      </div>

      <div className="assets-modal-actions flex gap-3 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="assets-modal-secondary flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={saveDisabled}
          className="assets-modal-primary flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saveLabel}
        </button>
      </div>
    </form>
  );
}
