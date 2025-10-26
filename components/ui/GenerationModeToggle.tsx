'use client';

import { Wand2, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GenerationMode = 'auto' | 'custom';

interface GenerationModeToggleProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  className?: string;
}

export default function GenerationModeToggle({
  mode,
  onModeChange,
  className
}: GenerationModeToggleProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        Generation Mode
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange('auto')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
            "border-2 flex items-center justify-center gap-2",
            mode === 'auto'
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          )}
        >
          <Wand2 className="w-4 h-4" />
          <span>Auto</span>
        </button>
        <button
          onClick={() => onModeChange('custom')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
            "border-2 flex items-center justify-center gap-2",
            mode === 'custom'
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          )}
        >
          <PenLine className="w-4 h-4" />
          <span>Custom</span>
        </button>
      </div>
    </div>
  );
}
