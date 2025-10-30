import Image from 'next/image';
import Link from 'next/link';
import {
  GlobeAltIcon,
  SparklesIcon,
  PlayCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import {
  Smartphone,
  Zap,
  Languages,
  Film
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

// Helper function to convert credits to USD
const creditsToUSD = (credits: number | string): string => {
  if (typeof credits === 'string') {
    // Handle range like "36-160"
    if (credits.includes('-')) {
      const [min, max] = credits.split('-').map(n => parseInt(n.trim()));
      const minUSD = min * 0.018;
      const maxUSD = max * 0.018;
      const minStr = minUSD < 1 ? minUSD.toFixed(2) : minUSD.toFixed(0);
      const maxStr = maxUSD < 1 ? maxUSD.toFixed(2) : maxUSD.toFixed(0);
      return `~$${minStr}-$${maxStr}`;
    }
    credits = parseInt(credits);
  }
  const usd = credits * 0.018;
  return usd < 1 ? `~$${usd.toFixed(2)}` : `~$${usd.toFixed(0)}`;
};

export default function StandardAdsShowcasePage() {
  // Example cases data
  const examples = [
    {
      id: 1,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/standard_ads_1_product.jpg',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/standard_ads_1_video.mp4',
    },
    {
      id: 2,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/standard_ads_2_product.png',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/standard_ads_2_video.mp4',
    },
  ];

  const features = [
    {
      icon: Languages,
      title: 'Multi-Language Support',
      description: 'Create ads in 50+ languages including English, Urdu, Arabic, Hindi, Spanish, and more. Perfect for reaching global audiences.',
    },
    {
      icon: Smartphone,
      title: 'Custom WhatsApp Display',
      description: 'Add your WhatsApp number directly in videos using custom mode, making it easy for customers to reach you.',
    },
    {
      icon: SparklesIcon,
      title: 'AI-Powered Descriptions',
      description: 'Automatic product analysis and intelligent prompt generation for professional-quality results every time.',
    },
    {
      icon: Film,
      title: 'Multiple AI Models',
      description: 'Choose from Veo3, Veo3 Fast, Sora2, and Sora2 Pro to match your quality and budget needs.',
    },
  ];

  const pricingOptions = [
    { model: 'Veo3', credits: 150, type: 'Paid Generation', quality: 'Premium quality, 8s video' },
    { model: 'Veo3 Fast', credits: 20, type: 'Paid Download', quality: 'Fast generation, 8s video' },
    { model: 'Sora2', credits: 6, type: 'Paid Download', quality: 'Standard quality, 10s video' },
    { model: 'Sora2 Pro', credits: '36-160', type: 'Paid Generation', quality: 'Dynamic pricing based on duration & quality' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
            Transform Product Images into Engaging Video Ads
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            AI-powered video generation for e-commerce and marketing. Upload your product photo and get professional video ads in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/dashboard/standard-ads"
              className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
            >
              Start Creating
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center gap-2 bg-white text-black border-2 border-gray-300 px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-50 transition-colors"
            >
              View Pricing
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            100 free credits for new users (~$1.80 value) • 1 credit ≈ $0.018
          </p>
        </div>
      </section>

      {/* Examples Section - MOVED TO 2ND POSITION */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge and Title */}
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-black text-white rounded-full mb-4">
              <span className="text-sm font-semibold">Real Examples</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              See It In Action
            </h2>
            <p className="text-lg text-gray-600">
              Real examples of product images transformed into engaging video ads
            </p>
          </div>

          <div className="space-y-16">
            {examples.map((example, index) => (
              <div
                key={example.id}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Product Image */}
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-full">
                      <span className="text-sm font-semibold text-gray-700">
                        Original Product Image
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
                        <Image
                          src={example.productImage}
                          alt={`Product ${example.id}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated Video */}
                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-2 bg-black text-white rounded-full">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <PlayCircleIcon className="w-4 h-4" />
                        AI-Generated Video Ad
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-lg">
                      <LazyVideoPlayer
                        src={example.videoUrl}
                        wrapperClassName="relative aspect-[3/4] w-full overflow-hidden rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Powerful Features for Your Success
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to create professional video advertisements
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-6 h-6 text-black" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Create professional video ads in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Product Image',
                description: 'Start by uploading a clear photo of your product. Support for all common image formats.',
              },
              {
                step: '02',
                title: 'AI Analyzes & Generates',
                description: 'Our AI automatically analyzes your product, generates descriptions, and creates optimized prompts.',
              },
              {
                step: '03',
                title: 'Get Your Video Ad',
                description: 'Receive your professional video ad in minutes. Download and use across all platforms.',
              },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-black text-white rounded-full text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-black">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - WITH USD VALUES */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Flexible Pricing Options
            </h2>
            <p className="text-lg text-gray-600">
              Choose the AI model that best fits your needs and budget
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingOptions.map((option, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-black transition-colors"
              >
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-black">
                    {option.model}
                  </h3>
                  <div>
                    <div className="text-3xl font-bold text-black">
                      {typeof option.credits === 'number' ? `${option.credits} credits` : `${option.credits} credits`}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {creditsToUSD(option.credits)}
                    </div>
                  </div>
                  <div className="inline-block px-3 py-1 bg-gray-100 rounded-full">
                    <span className="text-xs font-semibold text-gray-700">
                      {option.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {option.quality}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              * Image generation is always free with unlimited generations
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-gray-600">
              Standard Ads work great for various businesses and platforms
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              'E-commerce Stores',
              'Local Businesses',
              'Social Media Marketing',
              'Etsy Sellers',
              'Shopify Stores',
              'Amazon Products',
              'Gumroad Creators',
              'WhatsApp Business',
            ].map((useCase, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-gray-900">{useCase}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - WITH USD VALUE */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 p-12 space-y-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black">
              Ready to Create Your First Video Ad?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join thousands of businesses using Flowtra to create professional video advertisements
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/dashboard/standard-ads"
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Started - 100 Free Credits (~$1.80)
                <Zap className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
