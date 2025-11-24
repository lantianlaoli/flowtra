'use client';

import { ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

interface RequirementsInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  textareaClassName?: string;
  hideCounter?: boolean;
  variant?: 'default' | 'ghost';
}

export default function RequirementsInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Add optional guidance (discounts, call-to-action, tone)...',
  maxLength = 500,
  className,
  textareaClassName,
  hideCounter = false,
  variant = 'default',
}: RequirementsInputProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isGhost = variant === 'ghost';

  return (
    <div className={cn("relative flex-1", className)}>
      <textarea
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          `w-full px-4 py-3 pr-16 resize-none transition-all duration-200 placeholder:text-gray-400`,
          isGhost
            ? 'border-none rounded-2xl bg-transparent text-base outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:border-none focus-visible:border-none focus:shadow-none focus-visible:shadow-none !outline-none !ring-0 shadow-none'
            : 'border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed',
          disabled && isGhost && 'cursor-not-allowed opacity-60',
          textareaClassName
        )}
        rows={1}
        style={{
          minHeight: '44px',
          maxHeight: '120px',
        }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
        }}
      />

      {/* Character counter */}
      {!hideCounter && (
        <div
          className={`
            absolute right-3 bottom-2 text-xs
            ${isNearLimit ? 'text-orange-500 font-medium' : 'text-gray-400'}
          `}
        >
          {characterCount}/{maxLength}
        </div>
      )}
    </div>
  );
}
