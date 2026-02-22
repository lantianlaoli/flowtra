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
      targetUrl: '/dashboard/competitor-ugc-replication',
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
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete these tasks to unlock the full potential
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {progress.tasksCompleted}/{progress.totalTasks}
            </div>
            <div className="text-xs text-gray-500">completed</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
            />
          </div>
          <button
            type="button"
            onClick={handleProgressClick}
            className="text-xs text-gray-500 mt-1 text-right hover:text-gray-900 transition-colors"
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
                  group flex items-start gap-4 p-4 rounded-lg border transition-all
                  ${task.completed
                    ? 'bg-green-50 border-green-200 hover:border-green-300 hover:shadow-sm cursor-pointer'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                  ${task.completed ? 'bg-green-100' : 'bg-gray-100'}
                `}>
                  <Icon className={`w-5 h-5 ${task.completed ? 'text-green-600' : 'text-gray-600'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium ${task.completed ? 'text-green-900' : 'text-gray-900'}`}>
                      {task.title}
                    </h3>
                    {task.completed && (
                      <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${task.completed ? 'text-green-700' : 'text-gray-600'}`}>
                    {task.description}
                  </p>
                </div>

                {/* Arrow for incomplete tasks */}
                {!task.completed && (
                  <ArrowRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
