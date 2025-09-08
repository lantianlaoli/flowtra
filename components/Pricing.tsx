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

  const handlePurchase = async (packageName: 'lite' | 'basic' | 'pro') => {
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      alert('Please sign in first to purchase a plan')
      return
    }

    await handleCreemCheckout({
      packageName,
      userEmail: user.emailAddresses[0].emailAddress,
      onLoading: (isLoading) => setIsLoading(isLoading ? packageName : null),
      onError: () => alert('Purchase failed, please try again later')
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
            Choose Your Perfect Plan
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            AI-powered video generation to make your product ads stand out
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {Object.entries(PACKAGES).map(([key, pkg]) => {
            const packageKey = key as 'lite' | 'basic' | 'pro'
            const isPopular = packageKey === 'basic'
            
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
                    <span className="text-sm font-medium text-gray-900">Recommended</span>
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
                      Includes <span className="font-semibold text-gray-900">{pkg.credits.toLocaleString()}</span> credits
                    </p>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <div>≈ {pkg.videoEstimates.veo3_fast} Veo3 Fast videos</div>
                      <div>≈ {pkg.videoEstimates.veo3} Veo3 high-quality videos</div>
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
                        Processing...
                      </div>
                    ) : (
                      `Buy ${pkg.name} Now`
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            All plans include: AI analysis, high-quality video generation, 24/7 support
          </p>
          <p className="mt-2 text-xs text-gray-400">
            * Video generation count based on model credit consumption, actual count may vary slightly
          </p>
        </div>
      </div>
    </div>
  )
}
