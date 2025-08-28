'use client';

import Link from 'next/link';
import { CreditCard, Zap, ArrowRight, AlertCircle } from 'lucide-react';

interface InsufficientCreditsProps {
  currentCredits: number;
  requiredCredits: number;
}

export default function InsufficientCredits({ currentCredits, requiredCredits }: InsufficientCreditsProps) {
  const neededCredits = requiredCredits - currentCredits;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="text-center space-y-6">
          {/* Notion-style icon */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-gray-600" />
          </div>
          
          {/* Message */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Insufficient Credits
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              You need at least <span className="font-semibold text-gray-900">{requiredCredits} credits</span> to use the AI advertisement generation service.
            </p>
            
            {/* Notion-style info callout */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-md mx-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-600">Current Credits:</span>
                  </div>
                  <span className="font-semibold text-gray-900">{currentCredits}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Additional needed:</span>
                  <span className="font-semibold text-gray-900">+{neededCredits} credits</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action buttons - Notion style */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              Purchase Credits
            </Link>
            <Link
              href="/dashboard/credits"
              className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium border border-gray-200"
            >
              <ArrowRight className="w-4 h-4" />
              View Credits
            </Link>
          </div>
        </div>
      </div>
      
      {/* Additional info - Notion style */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Credit Usage</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>VEO3 Fast (1-2 mins):</span>
            <span className="font-medium">30 credits</span>
          </div>
          <div className="flex justify-between">
            <span>VEO3 High Quality (3-5 mins):</span>
            <span className="font-medium">150 credits</span>
          </div>
        </div>
      </div>
    </div>
  );
}