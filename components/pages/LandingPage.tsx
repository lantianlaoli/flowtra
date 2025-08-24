'use client';

import { useState } from 'react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { Upload, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import FileUpload from '@/components/FileUpload';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [showUpload, setShowUpload] = useState(false);
  const router = useRouter();

  const handleFileUpload = (file: File) => {
    // Redirect to dashboard with file upload
    router.push('/dashboard?upload=true');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Promotion Badge */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
            🎯 $200 OFF
            <span className="text-gray-300">On All AI Video Templates</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Transform Products into
            <br />
            <span className="text-gray-700">Professional AI Ads</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Upload your product photo and watch our AI create stunning cover images and engaging video advertisements in minutes. Built for results.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <SignedOut>
              <button
                onClick={() => setShowUpload(true)}
                className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 min-w-[200px]"
              >
                <Upload className="w-5 h-5" />
                Upload Product Photo
              </button>
            </SignedOut>
            
            <SignedIn>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 min-w-[200px]"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </SignedIn>

            <button
              onClick={() => router.push('/pricing')}
              className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors min-w-[200px]"
            >
              View Pricing
            </button>
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full border-2 border-white"></div>
            </div>
            <span>Join 50k+ others who signed up</span>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Upload Product Photo</h3>
              <p className="text-gray-600 mb-6">
                Sign up to start creating AI-powered advertisements for your products.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/sign-up')}
                  className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Sign Up Free
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Preview Section */}
        <div className="text-center mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            Top-Performing Ads for Every Need
          </h2>
          <p className="text-lg text-gray-600 mb-12 max-w-3xl mx-auto">
            Each advertisement is crafted to help you achieve clarity, focus, and efficiency in your marketing campaigns and drive sales.
          </p>

          {/* Product Examples Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-8">
              <div className="bg-white rounded-lg h-40 mb-4 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <div className="text-gray-400">Cover Image Preview</div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Professional Covers</h3>
              <p className="text-sm text-gray-600">
                AI-generated cover images that grab attention and drive engagement.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-8">
              <div className="bg-white rounded-lg h-40 mb-4 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <div className="text-gray-400">Video Ad Preview</div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Dynamic Videos</h3>
              <p className="text-sm text-gray-600">
                Engaging video advertisements that showcase your products in action.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-8">
              <div className="bg-white rounded-lg h-40 mb-4 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <div className="text-gray-400">Campaign Analytics</div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Analytics</h3>
              <p className="text-sm text-gray-600">
                Track performance and optimize your campaigns for better results.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <div className="bg-gray-50 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Product Marketing?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Join thousands of businesses already using AI to create professional advertisements.
            </p>
            <SignedOut>
              <button
                onClick={() => router.push('/sign-up')}
                className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Get Started for Free
              </button>
            </SignedOut>
            <SignedIn>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Go to Dashboard
              </button>
            </SignedIn>
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