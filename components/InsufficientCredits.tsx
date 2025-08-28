'use client';

import Link from 'next/link';
import { CreditCard, Zap, ArrowRight } from 'lucide-react';

interface InsufficientCreditsProps {
  currentCredits: number;
  requiredCredits: number;
}

export default function InsufficientCredits({ currentCredits, requiredCredits }: InsufficientCreditsProps) {
  const neededCredits = requiredCredits - currentCredits;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-8">
        <div className="text-center space-y-6">
          {/* Warning icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-4 border-orange-200">
            <CreditCard className="w-8 h-8 text-orange-600" />
          </div>
          
          {/* Message */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              积分不足
            </h3>
            <div className="space-y-3">
              <p className="text-gray-700 text-base leading-relaxed">
                您需要至少 <span className="font-semibold text-orange-600">{requiredCredits} 积分</span> 才能使用 AI 广告生成服务。
              </p>
              <div className="bg-white/60 rounded-lg p-4 border border-orange-200/50">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-600">当前积分：</span>
                  </div>
                  <span className="font-semibold text-gray-900">{currentCredits}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">还需要：</span>
                  <span className="font-semibold text-orange-600">+{neededCredits} 积分</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              购买积分
            </Link>
            <Link
              href="/dashboard/credits"
              className="flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-300 shadow-sm"
            >
              <ArrowRight className="w-4 h-4" />
              查看积分详情
            </Link>
          </div>
        </div>
      </div>
      
      {/* Additional info */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">积分使用说明</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>VEO3 Fast (1-2分钟)：</span>
            <span className="font-medium">30 积分</span>
          </div>
          <div className="flex justify-between">
            <span>VEO3 High Quality (3-5分钟)：</span>
            <span className="font-medium">150 积分</span>
          </div>
        </div>
      </div>
    </div>
  );
}