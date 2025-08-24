'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PACKAGES } from '@/lib/constants'

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

    setIsLoading(packageName)

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageName,
          userEmail: user.emailAddresses[0].emailAddress
        })
      })

      const data = await response.json()

      if (data.success && data.checkout_url) {
        // Redirect to Creem checkout page
        window.location.href = data.checkout_url
      } else {
        throw new Error(data.error || 'Failed to create checkout')
      }
    } catch (error) {
      console.error('Purchase error:', error)
      alert('购买失败，请稍后重试')
    } finally {
      setIsLoading(null)
    }

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

        <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:gap-12">
          {Object.entries(PACKAGES).map(([key, pkg]) => {
            const packageKey = key as 'starter' | 'pro'
            const isPopular = packageKey === 'pro'
            
            return (
              <div
                key={packageKey}
                className={`relative rounded-2xl p-8 ${
                  isPopular
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white ring-2 ring-blue-500'
                    : 'bg-gray-50 text-gray-900 ring-1 ring-gray-200'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      推荐选择
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <h3 className="text-2xl font-bold">{pkg.name}</h3>
                  <p className={`mt-2 text-sm ${isPopular ? 'text-blue-100' : 'text-gray-500'}`}>
                    {pkg.description}
                  </p>
                  
                  <div className="mt-6">
                    <span className="text-4xl font-bold">
                      {pkg.priceSymbol}{pkg.price}
                    </span>
                  </div>

                  <div className="mt-6">
                    <p className={`text-sm ${isPopular ? 'text-blue-100' : 'text-gray-600'}`}>
                      包含 <span className="font-semibold">{pkg.credits.toLocaleString()}</span> 积分
                    </p>
                    <div className={`mt-2 text-xs ${isPopular ? 'text-blue-200' : 'text-gray-500'}`}>
                      <p>• {pkg.videoEstimates.veo3_fast} 条 Veo3 Fast 视频</p>
                      <p>• {pkg.videoEstimates.veo3} 条 Veo3 高质视频</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(packageKey)}
                    disabled={isLoading === packageKey}
                    className={`mt-8 w-full py-3 px-6 rounded-lg font-medium text-center transition-colors ${
                      isPopular
                        ? 'bg-white text-blue-600 hover:bg-gray-100 disabled:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
                    } disabled:cursor-not-allowed`}
                  >
                    {isLoading === packageKey ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        处理中...
                      </span>
                    ) : (
                      `立即购买 ${pkg.name}`
                    )}
                  </button>

                  <div className="mt-6">
                    <ul className={`space-y-3 text-sm ${isPopular ? 'text-blue-100' : 'text-gray-600'}`}>
                      {pkg.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <svg
                            className={`w-4 h-4 mr-2 ${isPopular ? 'text-blue-200' : 'text-green-500'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
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