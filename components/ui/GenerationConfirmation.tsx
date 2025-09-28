'use client';

import { ArrowRight, History, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GenerationConfirmationProps {
  title: string;
  description: string;
  estimatedTime: string;
  onCreateAnother: () => void;
}

export default function GenerationConfirmation({
  title,
  description,
  estimatedTime,
  onCreateAnother
}: GenerationConfirmationProps) {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      {/* Success indicator */}
      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-xl font-medium text-gray-900">
          {title}
        </h3>
        <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
          {description}
        </p>

        {/* Key message about navigation freedom */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-blue-800 text-sm font-medium">
            ✨ Feel free to explore other features while we work on your project
          </p>
        </div>

        {/* Estimated time */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{estimatedTime}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => router.push('/dashboard/videos')}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <History className="w-4 h-4" />
          View My Projects
        </button>
        <button
          onClick={onCreateAnother}
          className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium"
        >
          <ArrowRight className="w-4 h-4" />
          Create Another
        </button>
      </div>
    </div>
  );
}