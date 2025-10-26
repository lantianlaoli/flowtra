'use client';

import { Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OutputMode = 'image' | 'video';

interface OutputModeToggleProps {
  mode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
  className?: string;
}

export default function OutputModeToggle({
  mode,
  onModeChange,
  className
}: OutputModeToggleProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        Output Mode
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange('image')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
            "border-2 flex items-center justify-center gap-2",
            mode === 'image'
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Image</span>
        </button>
        <button
          onClick={() => onModeChange('video')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
            "border-2 flex items-center justify-center gap-2",
            mode === 'video'
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          )}
        >
          <Video className="w-4 h-4" />
          <span>Video</span>
        </button>
      </div>
    </div>
  );
}
