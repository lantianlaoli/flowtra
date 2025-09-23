'use client';

import { Clock } from 'lucide-react';

interface VideoDurationSelectorProps {
  value: 8 | 16 | 24;
  onChange: (duration: 8 | 16 | 24) => void;
}

export default function VideoDurationSelector({ value, onChange }: VideoDurationSelectorProps) {
  const options = [
    {
      value: 8 as const,
      label: '8 seconds',
      scenes: 1,
      description: '1 video scene'
    },
    {
      value: 16 as const,
      label: '16 seconds',
      scenes: 2,
      description: '2 video scenes'
    },
    {
      value: 24 as const,
      label: '24 seconds',
      scenes: 3,
      description: '3 video scenes'
    },
  ];

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`
            flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all
            ${value === option.value
              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="video-duration"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900">{option.label}</span>
              </div>
              <div className="text-sm text-gray-600 ml-6">
                {option.description}
              </div>
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700">
            {option.scenes} scene{option.scenes > 1 ? 's' : ''}
          </div>
        </label>
      ))}
    </div>
  );
}