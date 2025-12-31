'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface AnalysisProgressProps {
  progress: number;
}

const ANALYSIS_TIPS = [
  'Analyzing shot composition...',
  'Detecting camera movements...',
  'Extracting audio patterns...',
  'Identifying brand elements...',
  'Mapping narrative structure...',
  'Breaking down visual style...',
];

export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % ANALYSIS_TIPS.length);
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  const estimatedTimeLeft = Math.max(0, Math.round((100 - progress) / 3));

  return (
    <div className="w-full h-[400px] lg:h-[320px] md:h-[280px] flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-8">
      {/* Animated icon */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-20 h-20 mb-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
      >
        <Sparkles className="w-10 h-10 text-white" />
      </motion.div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        AI Analysis in Progress...
      </h3>

      {/* Rotating tips */}
      <div className="h-8 mb-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentTipIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-gray-600 text-center font-medium"
          >
            {ANALYSIS_TIPS[currentTipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Progress details */}
        <div className="flex justify-between items-center mt-3 text-sm">
          <span className="text-gray-500">
            {estimatedTimeLeft > 0 ? `~${estimatedTimeLeft} seconds left` : 'Almost done...'}
          </span>
          <span className="font-semibold text-purple-600">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Helpful tip */}
      <p className="text-xs text-gray-400 mt-6 text-center max-w-sm">
        This usually takes 30-60 seconds. We&apos;re analyzing every frame for the best results.
      </p>
    </div>
  );
}
