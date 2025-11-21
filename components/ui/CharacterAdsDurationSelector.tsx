"use client";

import { CHARACTER_ADS_DURATION_OPTIONS, CharacterAdsDuration } from '@/lib/character-ads-dialogue';
import { ChevronDown } from 'lucide-react';

interface CharacterAdsDurationSelectorProps {
  value: CharacterAdsDuration;
  onChange: (duration: CharacterAdsDuration) => void;
}

const formatDurationLabel = (seconds: number) => {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
};

export default function CharacterAdsDurationSelector({ value, onChange }: CharacterAdsDurationSelectorProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as CharacterAdsDuration)}
        className="w-full appearance-none rounded-full border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        {CHARACTER_ADS_DURATION_OPTIONS.map((seconds) => (
          <option key={seconds} value={seconds}>
            {formatDurationLabel(seconds)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </div>
  );
}
