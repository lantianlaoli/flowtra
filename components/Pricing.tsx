'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PACKAGES } from '@/lib/constants'
import { handleCreemCheckout } from '@/lib/payment'
import { HiStar, HiCheck } from 'react-icons/hi'

interface PricingProps {
  onPurchase?: (packageName: string) => void
}

export function Pricing({ onPurchase }: PricingProps) {
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handlePurchase = async (packageName: 'starter' | 'pro') => {
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      alert('请先登录后再购买套餐')
      return
    }

    await handleCreemCheckout({
      packageName,
      userEmail: user.emailAddresses[0].emailAddress,
      onLoading: (isLoading) => setIsLoading(isLoading ? packageName : null),
      onError: (error) => alert('购买失败，请稍后重试')
    })

    if (onPurchase) {
      onPurchase(packageName)
    }
  }

  return (
    <div className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            选择适合你的套餐
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            AI 智能视频生成，让你的产品广告脱颖而出
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {Object.entries(PACKAGES).map(([key, pkg]) => {
            const packageKey = key as 'starter' | 'pro'
            const isPopular = packageKey === 'starter'
            
            return (
              <div
                key={packageKey}
                className={`relative bg-white border rounded-lg p-6 transition-colors hover:bg-gray-50 flex flex-col h-full ${
                  isPopular ? 'border-gray-400' : 'border-gray-200'
                }`}
              >
                {isPopular && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                      <HiStar className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">推荐选择</span>
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{pkg.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>
                  
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-gray-900">
                      {pkg.priceSymbol}{pkg.price}
                    </span>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-gray-600">
                      包含 <span className="font-semibold text-gray-900">{pkg.credits.toLocaleString()}</span> 积分
                    </p>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <div>≈ {pkg.videoEstimates.veo3_fast} 条 Veo3 Fast 视频</div>
                      <div>≈ {pkg.videoEstimates.veo3} 条 Veo3 高质视频</div>
                    </div>
                  </div>

                  <div className="flex-1 mb-4">
                    <ul className="space-y-2 text-sm text-gray-600">
                      {pkg.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-black rounded-sm flex items-center justify-center flex-shrink-0">
                            <HiCheck className="w-2 h-2 text-white" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handlePurchase(packageKey)}
                    disabled={isLoading === packageKey}
                    className={`w-full py-2.5 px-4 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-auto ${
                      isLoading === packageKey
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isPopular
                        ? 'bg-black text-white hover:bg-gray-800'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {isLoading === packageKey ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        处理中...
                      </div>
                    ) : (
                      `立即购买 ${pkg.name}`
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            所有套餐包含：AI 智能分析、高质量视频生成、24/7 技术支持
          </p>
          <p className="mt-2 text-xs text-gray-400">
            * 视频生成数量基于模型积分消耗计算，实际可生成数量可能略有差异
          </p>
        </div>
      </div>
    </div>
  )
}