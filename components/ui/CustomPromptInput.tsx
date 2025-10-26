'use client';

import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface CustomPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  showHint?: boolean;
}

export default function CustomPromptInput({
  value,
  onChange,
  placeholder = "Describe the scene, setting, or context for your ad (e.g., 'product on a beach at sunset'). Brand information will be added automatically.",
  className,
  maxLength = 500,
  showHint = true
}: CustomPromptInputProps) {
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 50;

  return (
    <div className={cn("space-y-3", className)}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        Custom Script
        <span className="text-xs text-gray-500 font-normal">(Optional)</span>
      </label>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          className={cn(
            "w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md",
            "focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400",
            "resize-none transition-colors duration-150",
            "placeholder:text-gray-400"
          )}
        />

        {/* Character counter */}
        <div className="absolute bottom-2 right-2 text-xs">
          <span className={cn(
            "font-medium",
            isNearLimit ? "text-orange-600" : "text-gray-400"
          )}>
            {value.length}/{maxLength}
          </span>
        </div>
      </div>

      {/* Hint message */}
      {showHint && (
        <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-md border border-gray-200">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Auto-enhanced:</strong> Your description will be automatically combined with brand name, slogan, and product details for optimal results.
          </div>
        </div>
      )}
    </div>
  );
}
