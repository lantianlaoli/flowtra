'use client';

import { useState, useEffect } from 'react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { ArrowUpTrayIcon, ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FileUpload from '@/components/FileUpload';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState(0);
  const router = useRouter();

  const platforms = ['Amazon', 'Walmart', 'eBay', 'Shopify', 'Etsy'];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlatform((prev) => (prev + 1) % platforms.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [platforms.length]);

  const handleFileUpload = (file: File) => {
    router.push('/dashboard?upload=true');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Promotion Badge */}
        <div className="flex justify-center pt-8 mb-8">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2">
            🎁 100 Free Credits
            <span className="text-gray-300">Create 2 AI Video Ads</span>
          </div>
        </div>

        {/* Main Hero Section - Left/Right Layout */}
        <div className="grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left Content */}
          <div className="space-y-8">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
              Turn your{' '}
              <span 
                key={currentPlatform}
                className="text-blue-600 inline-block animate-pulse"
                style={{ animationDuration: '0.5s' }}
              >
                {platforms[currentPlatform]}
              </span>
              <br />
              <span className="text-gray-700">products into viral video ads</span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              AI creates professional ads in minutes. No design skills needed.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <SignedOut>
                <button
                  onClick={() => setShowUpload(true)}
                  className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[240px] justify-center"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Upload Product Photo
                </button>
              </SignedOut>
              
              <SignedIn>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[240px] justify-center"
                >
                  Go to Dashboard
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </SignedIn>

              <button
                onClick={() => router.push('/pricing')}
                className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors min-w-[200px]"
              >
                View Pricing
              </button>
            </div>

          </div>

          {/* Right Before/After Visual Impact */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-6 items-center">
              {/* Before - Static Image */}
              <div className="relative">
                <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200">
                  <img 
                    src="https://tempfile.aiquickdraw.com/s/2d20e399065cf0bd885f1cd9d77b45c0_0_1756032920_4230.png"
                    alt="Static product image"
                    className="w-full h-40 object-cover"
                  />
                </div>
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Static
                </div>
                <div className="absolute -top-3 -right-3 bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-medium">
                  Boring
                </div>
              </div>

              {/* After - Dynamic Video */}
              <div className="relative">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-1 rounded-2xl shadow-2xl">
                  <div className="bg-black rounded-2xl overflow-hidden">
                    <video 
                      className="w-full h-40 object-cover"
                      autoPlay 
                      muted 
                      loop 
                      playsInline
                    >
                      <source 
                        src="https://tempfile.aiquickdraw.com/p/c1dc5ad1d1e55eecdc8375483407c865_1756033014.mp4" 
                        type="video/mp4" 
                      />
                    </video>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Dynamic
                </div>
                <div className="absolute -top-3 -right-3 bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-medium">
                  Viral
                </div>
              </div>
            </div>

            {/* Magic Arrow */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-white rounded-full p-3 shadow-lg border-2 border-yellow-400 animate-bounce">
                <ArrowRightIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>

            {/* AI Magic Label */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
              ✨ AI Magic Transformation
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Get Started with 100 Free Credits</h3>
              <p className="text-gray-600 mb-6">
                Sign up now and receive 100 free credits to create your first 2 professional AI video advertisements. No credit card required.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/sign-up')}
                  className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold"
                >
                  Start Free
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex-1 border border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Section */}
        <div className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
            <p className="text-lg text-gray-600">Choose the plan that fits your needs</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $29
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">2,000 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">~65 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">~13 Veo3 High Quality videos</span>
                </li>
              </ul>
              <button 
                onClick={() => router.push('/pricing')}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-gray-900 text-white rounded-2xl p-8 shadow-lg transform scale-105">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                Recommended
              </div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">
                $99
                <span className="text-lg font-normal text-gray-300">/package</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">7,500 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">~250 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">~50 Veo3 High Quality videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">Priority processing</span>
                </li>
              </ul>
              <button 
                onClick={() => router.push('/pricing')}
                className="w-full bg-white text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}