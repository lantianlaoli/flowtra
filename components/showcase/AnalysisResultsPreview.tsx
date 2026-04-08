'use client';

import { CheckCircle, Play, Mic } from 'lucide-react';
import type { ReferenceVideoAnalysis } from '@/hooks/useVideoAnalysis';

interface AnalysisResultsPreviewProps {
  analysis: ReferenceVideoAnalysis;
  language: string;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
  hi: '🇮🇳',
  ru: '🇷🇺',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
};

export function AnalysisResultsPreview({
  analysis,
  language,
}: AnalysisResultsPreviewProps) {
  const displayShots = analysis.shots.slice(0, 3);
  const remainingCount = Math.max(0, analysis.shots.length - 3);
  const languageFlag = LANGUAGE_FLAGS[language] || '🌐';
  const languageName = LANGUAGE_NAMES[language] || language.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="flex items-center gap-3">
        <CheckCircle className="w-8 h-8 text-green-500" />
        <h3 className="text-2xl font-bold text-gray-900">
          Analysis Complete!
        </h3>
      </div>

      {/* Metrics badges */}
      <div className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-2xl">{languageFlag}</span>
          <span className="text-sm font-medium text-gray-700">{languageName}</span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-sm font-bold text-purple-600">
            {analysis.shots.length} shots
          </span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-sm font-medium text-gray-700">
            {analysis.video_duration_seconds}s duration
          </span>
        </div>
      </div>

      {/* Shot breakdown */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Shot Breakdown</h4>

        {displayShots.map((shot) => (
          <div
            key={shot.shot_id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            {/* Shot header */}
            <div className="flex justify-between items-start mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                Shot {shot.shot_id}
              </span>
              <span className="text-xs font-mono text-gray-500">
                {shot.start_time} - {shot.end_time} • {shot.duration_seconds}s
              </span>
            </div>

            {/* Shot details */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Play className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-800 leading-relaxed">
                  {shot.action}
                </p>
              </div>

              {shot.audio && (
                <div className="flex items-start gap-2">
                  <Mic className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 italic leading-relaxed">
                    &quot;{shot.audio}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Show remaining count */}
        {remainingCount > 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              +{remainingCount} more {remainingCount === 1 ? 'shot' : 'shots'} detected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
