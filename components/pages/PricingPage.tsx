'use client';

import { useState } from 'react';
import { SignedIn, SignedOut, useUser, SignInButton } from '@clerk/nextjs';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Zap } from 'lucide-react';

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
    name: 'Lite',
    price: 9,
    credits: 500,
    veo3FastVideos: 16,
    veo3HighQualityVideos: 3,
    features: [
      '500 credits',
      'Up to 16 video downloads',
      'Unlimited ad image downloads',
      'V2 batch generation'
    ]
  },
  {
    name: 'Basic',
    price: 29,
    credits: 2000,
    veo3FastVideos: 66,
    veo3HighQualityVideos: 13,
    isRecommended: true,
    features: [
      '2,000 credits',
      'Up to 66 video downloads',
      'Unlimited ad image downloads',
      'V2 batch generation'
    ]
  },
  {
    name: 'Pro',
    price: 49,
    credits: 3500,
    veo3FastVideos: 116,
    veo3HighQualityVideos: 23,
    features: [
      '3,500 credits',
      'Up to 116 video downloads',
      'Unlimited ad image downloads',
      'V2 batch generation',
      'Priority processing'
    ]
  }
];

export default function PricingPage() {
  useUser();
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
            Choose the plan that fits your needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
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
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
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

        {/* Features Overview */}
        <div className="bg-gray-50 rounded-2xl p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            What&apos;s Included
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Video Generation</h3>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-blue-500" />
                <span className="text-lg font-bold text-blue-600">AI-powered videos</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• High-quality ad videos</li>
                <li>• Multiple format options</li>
                <li>• Professional output</li>
                <li>• Commercial use ready</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Additional Features</h3>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-purple-500" />
                <span className="text-lg font-bold text-purple-600">Unlimited access</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Unlimited ad image downloads</li>
                <li>• V2 batch generation</li>
                <li>• Cover image creation</li>
                <li>• Multiple export formats</li>
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
                How does video generation work?
              </h3>
              <p className="text-gray-600">
                Our AI creates professional advertisement videos based on your requirements. Each plan includes a specific number of video downloads, plus unlimited access to ad image covers and batch generation features.
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
