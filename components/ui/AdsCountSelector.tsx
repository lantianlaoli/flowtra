'use client';

import { motion } from 'framer-motion';

interface AdsCountSelectorProps {
  value: 1 | 2 | 3 | 4;
  onChange: (count: 1 | 2 | 3 | 4) => void;
}

export default function AdsCountSelector({ value, onChange }: AdsCountSelectorProps) {
  const options = [
    { value: 1 as const, label: '1 Ad' },
    { value: 2 as const, label: '2 Ads' },
    { value: 3 as const, label: '3 Ads' },
    { value: 4 as const, label: '4 Ads' },
  ];

  return (
    <div className="flex gap-0 bg-gray-100 rounded-lg p-1">
      {options.map((option) => (
        <motion.button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            flex-1 relative py-2.5 px-4 rounded-md font-medium text-sm transition-colors
            ${value === option.value
              ? 'text-white bg-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }
          `}
          whileHover={value !== option.value ? { scale: 1.02 } : {}}
          whileTap={{ scale: 0.98 }}
          animate={value === option.value ? { scale: 1 } : { scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30
          }}
        >
          {value === option.value && (
            <motion.div
              className="absolute inset-0 bg-gray-900 rounded-md"
              layoutId="activeBackground"
              initial={false}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 35
              }}
              style={{ zIndex: -1 }}
            />
          )}
          <span className="relative z-10">
            {option.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}