'use client';

import { useState } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface OnboardingTriggerProps {
  onTrigger: () => void;
}

export function OnboardingTrigger({ onTrigger }: OnboardingTriggerProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1 }}
      onClick={onTrigger}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-40 group"
      aria-label="Restart tour"
    >
      <div className="relative">
        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 10 }}
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
        >
          <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
            Restart product tour
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
              <div className="w-2 h-2 bg-gray-900 transform rotate-45" />
            </div>
          </div>
        </motion.div>

        {/* Button */}
        <div className="bg-gray-900 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95">
          <QuestionMarkCircleIcon className="w-6 h-6" />
        </div>

        {/* Pulse Ring */}
        <div className="absolute inset-0 rounded-full bg-gray-900 opacity-0 group-hover:opacity-25 group-hover:scale-150 transition-all duration-300" />
      </div>
    </motion.button>
  );
}
