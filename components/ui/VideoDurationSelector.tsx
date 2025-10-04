"use client";

import { motion, AnimatePresence } from 'framer-motion';

interface VideoDurationSelectorProps {
  value: 8 | 10 | 16 | 20 | 24 | 30;
  onChange: (duration: 8 | 10 | 16 | 20 | 24 | 30) => void;
  hideSora2Durations?: boolean;
}

export default function VideoDurationSelector({ value, onChange, hideSora2Durations = false }: VideoDurationSelectorProps) {
  const options = hideSora2Durations
    ? [
        { value: 8 as const, label: '8s' },
        { value: 16 as const, label: '16s' },
        { value: 24 as const, label: '24s' },
      ]
    : [
        { value: 8 as const, label: '8s' },
        { value: 10 as const, label: '10s' },
        { value: 16 as const, label: '16s' },
        { value: 20 as const, label: '20s' },
        { value: 24 as const, label: '24s' },
        { value: 30 as const, label: '30s' },
      ];

  return (
    <div className="flex gap-0 bg-gray-100 rounded-lg p-1">
      <AnimatePresence initial={false}>
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
              layoutId="durationActiveBackground"
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
      </AnimatePresence>
    </div>
  );
}
