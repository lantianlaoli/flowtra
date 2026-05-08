'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  CubeIcon,
  UserCircleIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface OnboardingProgressProps {
  progress: {
    hasImportedTiktok: boolean;
    hasProduct: boolean;
    hasAvatar: boolean;
    hasCreatedVideo: boolean;
    tasksCompleted: number;
    totalTasks: number;
  };
  className?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  targetUrl: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function OnboardingProgress({ progress, className = '' }: OnboardingProgressProps) {
  const router = useRouter();

  // If all tasks are completed, don't render the component
  if (progress.tasksCompleted === progress.totalTasks) {
    return null;
  }

  const tasks: Task[] = [
    {
      id: 'import-tiktok',
      title: 'Import a TikTok video',
      description: 'Bring in a reference video to start',
      completed: progress.hasImportedTiktok,
      targetUrl: '/dashboard/assets',
      icon: ArrowDownTrayIcon,
    },
    {
      id: 'product',
      title: 'Add a product',
      description: 'Upload product images and details',
      completed: progress.hasProduct,
      targetUrl: '/dashboard/assets',
      icon: CubeIcon,
    },
    {
      id: 'avatar',
      title: 'Add a person',
      description: 'Upload a character/avatar image',
      completed: progress.hasAvatar,
      targetUrl: '/dashboard/assets',
      icon: UserCircleIcon,
    },
    {
      id: 'video',
      title: 'Generate your first video',
      description: 'Use any feature to create your first output',
      completed: progress.hasCreatedVideo,
      targetUrl: '/dashboard/video-clone',
      icon: SparklesIcon,
    },
  ];

  const progressPercentage = (progress.tasksCompleted / progress.totalTasks) * 100;
  const firstIncompleteTask = tasks.find((task) => !task.completed) ?? tasks[0];

  const handleTaskClick = (task: Task) => {
    router.push(task.targetUrl);
  };

  const handleProgressClick = () => {
    if (firstIncompleteTask) {
      router.push(firstIncompleteTask.targetUrl);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`onboarding-shell rounded-xl border shadow-sm ${className}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="onboarding-title text-lg font-semibold">Getting Started</h2>
            <p className="onboarding-subtitle mt-1 text-sm">
              Complete these tasks to unlock the full potential
            </p>
          </div>
          <div className="text-right">
            <div className="onboarding-title text-2xl font-bold">
              {progress.tasksCompleted}/{progress.totalTasks}
            </div>
            <div className="onboarding-caption text-xs">completed</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="onboarding-progress-track h-2 overflow-hidden rounded-full">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="onboarding-progress-fill h-full rounded-full"
            />
          </div>
          <button
            type="button"
            onClick={handleProgressClick}
            className="onboarding-progress-link mt-1 text-right text-xs transition-colors"
          >
            {Math.round(progressPercentage)}% complete
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const Icon = task.icon;
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleTaskClick(task)}
                className={`
                  onboarding-task group flex items-start gap-4 rounded-xl border p-4 transition-all
                  ${task.completed
                    ? 'onboarding-task--complete cursor-pointer hover:shadow-sm'
                    : 'onboarding-task--pending cursor-pointer hover:shadow-sm'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  onboarding-task-icon flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg
                  ${task.completed ? 'onboarding-task-icon--complete' : 'onboarding-task-icon--pending'}
                `}>
                  <Icon className={`h-5 w-5 ${task.completed ? 'onboarding-task-icon-svg--complete' : 'onboarding-task-icon-svg--pending'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium ${task.completed ? 'onboarding-task-title--complete' : 'onboarding-task-title--pending'}`}>
                      {task.title}
                    </h3>
                    {task.completed && (
                      <CheckCircleIcon className="h-5 w-5 flex-shrink-0 onboarding-task-check" />
                    )}
                  </div>
                  <p className={`mt-1 text-xs ${task.completed ? 'onboarding-task-description--complete' : 'onboarding-task-description--pending'}`}>
                    {task.description}
                  </p>
                </div>

                {/* Arrow for incomplete tasks */}
                {!task.completed && (
                  <ArrowRightIcon className="onboarding-task-arrow h-5 w-5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
