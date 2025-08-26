'use client';

import { useState } from 'react';
import { SignedIn, SignedOut, useUser, SignInButton } from '@clerk/nextjs';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
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
    isRecommended: true,
    features: [
      '2,000 credits',
      '~65 Veo3 Fast videos',
      '~13 Veo3 High Quality videos'
    ]
  },
  {
    name: 'Pro',
    price: 99,
    credits: 7500,
    veo3FastVideos: 250,
    veo3HighQualityVideos: 50,
    features: [
      '7,500 credits',
      '~250 Veo3 Fast videos',
      '~50 Veo3 High Quality videos',
      'Priority processing'
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
              className={`bg-white rounded-2xl p-8 shadow-sm flex flex-col ${
                plan.isRecommended
                  ? 'border-2 border-gray-900 transform scale-105'
                  : 'border border-gray-200 hover:border-gray-300 transition-colors'
              }`}
            >
              {plan.isRecommended && (
                <div className="bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium mb-4 inline-block">
                  Recommended
                </div>
              )}

              <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                ${plan.price}
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      plan.isRecommended ? 'bg-gray-900' : 'bg-gray-600'
                    }`}></div>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    className={`w-full py-3 rounded-lg font-semibold transition-colors cursor-pointer ${
                      plan.isRecommended
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Get Started
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={selectedPlan === plan.name}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                    selectedPlan === plan.name
                      ? 'bg-green-600 text-white cursor-not-allowed'
                      : plan.isRecommended
                      ? 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {selectedPlan === plan.name ? 'Processing...' : 'Get Started'}
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

      <Footer />
    </div>
  );
}