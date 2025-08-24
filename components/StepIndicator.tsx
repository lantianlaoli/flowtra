'use client';

import { Check, Upload, MessageSquare, Lightbulb, Image, Video, CheckCircle, X } from 'lucide-react';
import { WorkflowStep, StepResult } from '@/hooks/useWorkflow';

interface Step {
  id: WorkflowStep;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: Step[] = [
  { id: 'upload', name: 'Upload Image', icon: Upload },
  { id: 'describe', name: 'Describe Product', icon: MessageSquare },
  { id: 'generate-prompts', name: 'Generate Prompts', icon: Lightbulb },
  { id: 'generate-cover', name: 'Create Cover', icon: Image },
  { id: 'generate-video', name: 'Create Video', icon: Video },
  { id: 'complete', name: 'Complete', icon: CheckCircle },
];

interface StepIndicatorProps {
  currentStep: WorkflowStep;
  isLoading?: boolean;
  stepResults: Record<WorkflowStep, StepResult>;
  selectedStep?: WorkflowStep | null;
  onStepClick?: (step: WorkflowStep) => void;
}

export default function StepIndicator({ currentStep, isLoading, stepResults, selectedStep, onStepClick }: StepIndicatorProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isSelected = selectedStep === step.id;
          const stepResult = stepResults[step.id];
          const Icon = step.icon;
          const canClick = stepResult.status === 'completed' && onStepClick;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => canClick && onStepClick(step.id)}
                  disabled={!canClick}
                  className={`rounded-full p-2 transition-all duration-200 ${
                    canClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                  } ${
                    isSelected
                      ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                      : stepResult.status === 'error'
                      ? 'bg-red-600 text-white'
                      : isCompleted
                      ? canClick 
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-green-600 text-white'
                      : isCurrent
                      ? isLoading 
                        ? 'bg-blue-600 text-white animate-pulse' 
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                  title={canClick ? `点击查看${step.name}详情` : undefined}
                >
                  {stepResult.status === 'error' ? (
                    <X className="h-5 w-5" />
                  ) : isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </button>
                
                <span
                  className={`mt-2 text-sm transition-colors ${
                    isSelected
                      ? 'text-purple-600 font-semibold'
                      : stepResult.status === 'error'
                      ? 'text-red-600 font-medium'
                      : isCompleted || isCurrent
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-px w-16 mx-4 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}