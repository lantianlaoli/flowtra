'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, User, Video, Sparkles, CheckCircle2, type LucideIcon } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface ProgressStep {
  id: number;
  emoji: string;
  label: string;
  description: string;
  icon: LucideIcon;
  duration: number;  // milliseconds to show this step
}

interface CreatorSourceProgressModalProps {
  isOpen: boolean;
  apiComplete: boolean;
  onComplete: () => void;
}

const PROGRESS_STEPS: ProgressStep[] = [
  {
    id: 1,
    emoji: '🔍',
    label: 'Searching TikTok...',
    description: 'Finding your creator in the TikTok universe',
    icon: Link,
    duration: 400  // Fast initial step
  },
  {
    id: 2,
    emoji: '✨',
    label: 'Found them!',
    description: 'Getting their profile and stats',
    icon: User,
    duration: 400  // Fast
  },
  {
    id: 3,
    emoji: '🎬',
    label: 'Collecting videos...',
    description: 'Grabbing their most recent masterpieces',
    icon: Video,
    duration: 600  // Slightly slower
  },
  {
    id: 4,
    emoji: '🎉',
    label: 'Almost there!',
    description: 'Finalizing everything for you',
    icon: Sparkles,
    duration: Infinity  // Stay here until API completes
  }
];

export default function CreatorSourceProgressModal({
  isOpen,
  apiComplete,
  onComplete
}: CreatorSourceProgressModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Progress step timer
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setShowSuccess(false);
      return;
    }

    // If API completes, show success
    if (apiComplete && !showSuccess) {
      setShowSuccess(true);
      setTimeout(onComplete, 1500);
      return;
    }

    // Auto-advance through steps (but not past the last step)
    if (currentStep < PROGRESS_STEPS.length - 1) {
      const duration = PROGRESS_STEPS[currentStep]?.duration || 2000;

      // Don't set timer if duration is Infinity (waiting for API)
      if (duration === Infinity) {
        return;
      }

      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStep, apiComplete, showSuccess, onComplete]);

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-white rounded-lg shadow-lg border border-gray-200 p-6"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="space-y-4">
            {/* Success State */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-2">
                    🚀 All set!
                  </h3>
                  <p className="text-sm text-gray-600">
                    Your creator is ready to inspire your content!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Steps */}
            {!showSuccess && (
              <div className="space-y-3">
                {PROGRESS_STEPS.map((step, index) => {
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  const isPending = index > currentStep;

                  const StepIcon = step.icon;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        isActive
                          ? 'border-black bg-gray-50'
                          : isCompleted
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-gray-200 bg-white opacity-50'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-black text-white'
                            : isCompleted
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <StepIcon
                            className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-black flex items-center gap-1">
                          <span>{step.emoji}</span>
                          <span>{step.label}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
