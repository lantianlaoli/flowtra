'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { onboardingSteps, TOTAL_STEPS } from '@/lib/onboarding-steps';

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetPosition, setTargetPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const step = onboardingSteps[currentStep];

  // Calculate target element position
  const updateTargetPosition = useCallback(() => {
    if (!step.targetId) {
      setTargetPosition(null);
      return;
    }

    const element = document.querySelector(`[data-onboarding-id="${step.targetId}"]`);
    if (!element) {
      console.warn(`Target element not found: ${step.targetId}`);
      setTargetPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    // Scroll element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [step.targetId]);

  // Update position when step changes
  useEffect(() => {
    updateTargetPosition();

    // Update position on resize
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  // Calculate card position based on target and placement
  const getCardPosition = () => {
    if (!targetPosition) {
      // Center of screen for steps without target
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const placement = step.placement || 'right';
    const offset = 16; // Gap between target and card

    switch (placement) {
      case 'right':
        return {
          top: `${targetPosition.top + targetPosition.height / 2}px`,
          left: `${targetPosition.left + targetPosition.width + offset}px`,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          top: `${targetPosition.top + targetPosition.height / 2}px`,
          right: `${window.innerWidth - targetPosition.left + offset}px`,
          transform: 'translateY(-50%)',
        };
      case 'bottom':
        return {
          top: `${targetPosition.top + targetPosition.height + offset}px`,
          left: `${targetPosition.left + targetPosition.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'top':
        return {
          bottom: `${window.innerHeight - targetPosition.top + offset}px`,
          left: `${targetPosition.left + targetPosition.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      default:
        return {
          top: `${targetPosition.top + targetPosition.height / 2}px`,
          left: `${targetPosition.left + targetPosition.width + offset}px`,
          transform: 'translateY(-50%)',
        };
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 pointer-events-none"
      >
        {/* Floating Card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="fixed pointer-events-auto"
          style={{
            ...getCardPosition(),
            maxWidth: '380px',
            width: '90vw',
          }}
        >
          <div className="bg-white rounded-xl shadow-lg border border-gray-200/80 overflow-hidden relative">

            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3">
              <div className="flex-1 pr-4">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                aria-label="Close tour"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3">
              {/* Progress Dots */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      index === currentStep
                        ? 'w-6 bg-gray-800'
                        : index < currentStep
                        ? 'w-1.5 bg-gray-400'
                        : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentStep === 0
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Previous
                </button>

                <div className="text-xs text-gray-500 font-medium">
                  {currentStep + 1} of {TOTAL_STEPS}
                </div>

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  {currentStep === TOTAL_STEPS - 1 ? 'Finish' : 'Next'}
                  {currentStep < TOTAL_STEPS - 1 && <ChevronRightIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Target Highlight */}
        {targetPosition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed pointer-events-none"
            style={{
              top: targetPosition.top - 4,
              left: targetPosition.left - 4,
              width: targetPosition.width + 8,
              height: targetPosition.height + 8,
            }}
          >
            <div className="w-full h-full rounded-lg ring-2 ring-gray-900/30 bg-gray-900/5" />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
