"use client";

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DurationValue = 8 | 10 | 16 | 20 | 24 | 30;

interface VideoDurationSelectorProps {
  value: DurationValue;
  onChange: (duration: DurationValue) => void;
  disabledDurations?: DurationValue[];
}

export default function VideoDurationSelector({ value, onChange, disabledDurations }: VideoDurationSelectorProps) {
  const options = useMemo(() => ([
    { value: 8 as const, label: '8s' },
    { value: 10 as const, label: '10s' },
    { value: 16 as const, label: '16s' },
    { value: 20 as const, label: '20s' },
    { value: 24 as const, label: '24s' },
    { value: 30 as const, label: '30s' },
  ]), []);

  const permanentlyDisabled = useMemo(() => new Set<DurationValue>([10, 20, 30]), []);

  useEffect(() => {
    if (!permanentlyDisabled.has(value)) return;

    const fallback = options.find((option) => !permanentlyDisabled.has(option.value))?.value;
    if (fallback && fallback !== value) {
      onChange(fallback);
    }
  }, [value, onChange, options, permanentlyDisabled]);

  return (
    <div className="flex gap-0 bg-gray-100 rounded-lg p-1">
      <AnimatePresence initial={false}>
      {options.map((option) => {
        const isDisabled = permanentlyDisabled.has(option.value)
          || (disabledDurations?.includes(option.value) ?? false);
        const isActive = value === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => {
              if (isDisabled) return;
              onChange(option.value);
            }}
            className={`
              flex-1 relative py-2.5 px-4 rounded-md font-medium text-sm transition-colors
              ${isActive
                ? 'text-white bg-gray-900 shadow-sm'
                : isDisabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }
            `}
            whileHover={!isActive && !isDisabled ? { scale: 1.02 } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            animate={isActive ? { scale: 1 } : { scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
            disabled={isDisabled}
          >
            {isActive && (
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
        );
      })}
      </AnimatePresence>
    </div>
  );
}
