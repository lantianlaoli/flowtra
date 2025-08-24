'use client';

import { useState } from 'react';
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import Header from '@/components/layout/Header';
import { Check, Zap, Star } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: number;
  credits: number;
  veo3FastVideos: number;
  veo3HighQualityVideos: number;
  isRecommended?: boolean;
  features: string[];
}

const pricingPlans: PricingPlan[] = [
  {
    name: 'Starter',
    price: 29,
    credits: 2000,
    veo3FastVideos: 65,
    veo3HighQualityVideos: 13,
    features: [
      'AI Product Analysis',
      'Professional Cover Images',
      'Video Advertisements',
      'Multiple Video Models',
      'Download HD Content',
      'Basic Support'
    ]
  },
  {
    name: 'Pro',
    price: 99,
    credits: 7500,
    veo3FastVideos: 250,
    veo3HighQualityVideos: 50,
    isRecommended: true,
    features: [
      'Everything in Starter',
      'Priority Processing',
      'Advanced Video Models',
      'Bulk Processing',
      'Custom Branding',
      'Priority Support',
      'Analytics Dashboard',
      'API Access'
    ]
  }
];

export default function PricingPage() {
  const { user } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (planName: string) => {
    setSelectedPlan(planName);
    // TODO: Implement payment processing
    console.log(`Selected plan: ${planName}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the perfect plan for your business. Start creating professional AI advertisements today.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl border-2 p-8 ${
                plan.isRecommended
                  ? 'border-gray-900 shadow-lg'
                  : 'border-gray-200'
              }`}
            >
              {plan.isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Recommended
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600 ml-2">one-time</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <span className="text-lg font-semibold">{plan.credits.toLocaleString()} Credits</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>≈ {plan.veo3FastVideos} Veo3 Fast videos</div>
                    <div>≈ {plan.veo3HighQualityVideos} Veo3 high-quality videos</div>
                  </div>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <SignedOut>
                <button
                  onClick={() => window.location.href = '/sign-up'}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    plan.isRecommended
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Get Started
                </button>
              </SignedOut>

              <SignedIn>
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={selectedPlan === plan.name}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    selectedPlan === plan.name
                      ? 'bg-green-600 text-white cursor-not-allowed'
                      : plan.isRecommended
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {selectedPlan === plan.name ? 'Processing...' : `Choose ${plan.name}`}
                </button>
              </SignedIn>
            </div>
          ))}
        </div>

        {/* Usage Examples */}
        <div className="bg-gray-50 rounded-2xl p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Credit Usage Guide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Veo3 Fast</h3>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">30 credits</span>
                <span className="text-gray-600">per video</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Quick generation (2-3 minutes)</li>
                <li>• Good quality output</li>
                <li>• Perfect for testing ideas</li>
                <li>• Suitable for social media</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Veo3 High Quality</h3>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">150 credits</span>
                <span className="text-gray-600">per video</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Premium generation (5-8 minutes)</li>
                <li>• Highest quality output</li>
                <li>• Professional campaigns</li>
                <li>• Commercial use ready</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Which Plan Is Right for You?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-blue-50 rounded-xl p-8">
              <h3 className="text-xl font-semibold text-blue-900 mb-4">Starter Package</h3>
              <p className="text-blue-800 mb-4">
                Perfect for small businesses and entrepreneurs just starting with AI advertisement creation.
              </p>
              <ul className="text-left text-blue-700 space-y-2">
                <li>• Test AI video generation</li>
                <li>• Create social media content</li>
                <li>• Low-cost entry point</li>
                <li>• Explore different video styles</li>
              </ul>
            </div>

            <div className="bg-purple-50 rounded-xl p-8">
              <h3 className="text-xl font-semibold text-purple-900 mb-4">Pro Package</h3>
              <p className="text-purple-800 mb-4">
                Ideal for businesses with regular marketing needs and professional campaign requirements.
              </p>
              <ul className="text-left text-purple-700 space-y-2">
                <li>• Scale your marketing efforts</li>
                <li>• Create premium campaigns</li>
                <li>• Better cost per video</li>
                <li>• Advanced features access</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Do credits expire?
              </h3>
              <p className="text-gray-600">
                No, your credits never expire. Use them at your own pace to create advertisements whenever you need them.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I upgrade my plan later?
              </h3>
              <p className="text-gray-600">
                Yes, you can purchase additional credit packages anytime. Your existing credits will be added to your account.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What&apos;s the difference between Veo3 and Veo3 Fast?
              </h3>
              <p className="text-gray-600">
                Veo3 Fast generates videos quickly (2-3 minutes) and costs 30 credits, while Veo3 high-quality takes longer (5-8 minutes) but produces premium results for 150 credits.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                New users get 100 free credits upon sign-up to test our AI advertisement generation capabilities.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Flowtra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}