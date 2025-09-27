'use client';

import { Globe } from 'lucide-react';

export type AccentType = 'australian' | 'american' | 'british' | 'canadian' | 'irish' | 'south_african';

interface AccentOption {
  value: AccentType;
  label: string;
  description: string;
  flag: string;
}

interface AccentSelectorProps {
  selectedAccent: AccentType;
  onAccentChange: (accent: AccentType) => void;
  showIcon?: boolean;
}

const accentOptions: AccentOption[] = [
  {
    value: 'australian',
    label: 'Australian',
    description: 'Warm, friendly Australian accent',
    flag: '🇦🇺'
  },
  {
    value: 'american',
    label: 'American',
    description: 'Clear, professional American accent',
    flag: '🇺🇸'
  },
  {
    value: 'british',
    label: 'British',
    description: 'Sophisticated British accent',
    flag: '🇬🇧'
  },
  {
    value: 'canadian',
    label: 'Canadian',
    description: 'Friendly, approachable Canadian accent',
    flag: '🇨🇦'
  },
  {
    value: 'irish',
    label: 'Irish',
    description: 'Charming, melodic Irish accent',
    flag: '🇮🇪'
  },
  {
    value: 'south_african',
    label: 'South African',
    description: 'Distinctive South African accent',
    flag: '🇿🇦'
  }
];

export default function AccentSelector({
  selectedAccent,
  onAccentChange,
  showIcon = false
}: AccentSelectorProps) {
  const selectedOption = accentOptions.find(option => option.value === selectedAccent);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {showIcon && <Globe className="w-4 h-4 text-gray-600" />}
        <label className="text-sm font-medium text-gray-700">
          Voice Accent
        </label>
      </div>

      <div className="relative">
        <select
          value={selectedAccent}
          onChange={(e) => onAccentChange(e.target.value as AccentType)}
          className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none cursor-pointer"
        >
          {accentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.flag} {option.label}
            </option>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      {/* Selected accent description */}
      {selectedOption && (
        <p className="mt-2 text-xs text-gray-500">
          {selectedOption.description}
        </p>
      )}
    </div>
  );
}