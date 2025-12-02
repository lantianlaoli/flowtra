import Image from 'next/image';
import Link from 'next/link';
import {
  SparklesIcon,
  ArrowRightIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import {
  Zap,
  Languages,
  LayoutGrid,
  RefreshCw
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

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

export default function MultiVariantAdsShowcasePage() {
  // Example cases data
  const examples = [
    {
      id: 1,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_1_product.png',
      variantImages: [
        'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_1_image_1.png',
        'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_1_image_2.png',
      ],
    },
    {
      id: 2,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_2_product.png',
      variantImages: [
        'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_2_image_1.png',
        'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/multi_ads_2_image_2.png',
      ],
    },
  ];

  const features = [
    {
      icon: Languages,
      title: 'Multi-Language Support',
      description: 'Generate variants in 50+ languages including English, Urdu, Arabic, Hindi, and more. Perfect for global marketing campaigns.',
    },
    {
      icon: LayoutGrid,
      title: 'Multiple Style Variations',
      description: 'Get diverse creative options from a single input. Each variant offers unique visual styles and compositions.',
    },
    {
      icon: Zap,
      title: 'Batch Generation',
      description: 'Create multiple variants simultaneously. Save time with our efficient parallel processing system.',
    },
    {
      icon: RefreshCw,
      title: 'AI Background Replacement',
      description: 'Automatic scene transformation and background replacement. Perfect product placement every time.',
    },
  ];

  const videoConversionOptions = [
    { model: 'Veo3', credits: 150, usd: creditsToUSD(150) },
    { model: 'Veo3 Fast', credits: 20, usd: creditsToUSD(20) },
    { model: 'Sora2', credits: 6, usd: creditsToUSD(6) },
    { model: 'Sora2 Pro', credits: '36-160', usd: creditsToUSD('36-160') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
            Generate Multiple Ad Variants from One Image
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Create diverse marketing materials in seconds. Upload one product image and get multiple professional variants with different styles and backgrounds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/dashboard/multi-variant-ads"
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
            100 free credits ($1.80 value) • Image generation is FREE
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
              See The Magic In Action
            </h2>
            <p className="text-lg text-gray-600">
              Real examples showing how one image transforms into multiple creative variants
            </p>
          </div>

          <div className="space-y-20">
            {examples.map((example) => (
              <div key={example.id} className="space-y-8">
                {/* Original Image */}
                <div className="flex justify-center">
                  <div className="max-w-md space-y-4">
                    <div className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-full">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <PhotoIcon className="w-4 h-4" />
                        Original Product Image
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg">
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

                {/* Arrow Indicator */}
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center transform rotate-90">
                    <ArrowRightIcon className="w-6 h-6" />
                  </div>
                </div>

                {/* Generated Variants */}
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="inline-block px-4 py-2 bg-black text-white rounded-full">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4" />
                        AI-Generated Variants
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {example.variantImages.map((variantImage, variantIndex) => (
                      <div
                        key={variantIndex}
                        className="bg-white rounded-2xl border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                          <Image
                            src={variantImage}
                            alt={`Variant ${variantIndex + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="mt-3 text-center">
                          <span className="text-sm font-semibold text-gray-700">
                            Variant {variantIndex + 1}
                          </span>
                        </div>
                      </div>
                    ))}
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
              Powerful Features for Maximum Creativity
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to create diverse ad variations efficiently
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
              Create multiple ad variants in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Product Image',
                description: 'Start with a single product photo. High quality images work best for optimal results.',
              },
              {
                step: '02',
                title: 'Select Number of Variants',
                description: 'Choose how many different versions you want to generate. Create as many as you need.',
              },
              {
                step: '03',
                title: 'AI Generates Multiple Versions',
                description: 'Receive multiple creative variants instantly. Download and use across all your marketing channels.',
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Image generation is completely free. Only pay for video generation if needed.
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 p-12">
            <div className="text-center space-y-6">
              <div className="inline-block px-6 py-3 bg-green-100 border border-green-300 rounded-full">
                <span className="text-lg font-bold text-green-800">
                  FREE Image Generation
                </span>
              </div>
              <h3 className="text-3xl font-bold text-black">
                Unlimited Image Variants
              </h3>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Generate as many image variants as you need at no cost. Perfect for testing different creative approaches before committing to video production.
              </p>
              <div className="pt-6 border-t border-gray-300">
                <p className="text-base font-semibold text-gray-700 mb-4">
                  Optional: Convert variants to videos
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {videoConversionOptions.map((option, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="text-sm font-bold text-black mb-1">
                        {option.model}
                      </div>
                      <div className="text-xs text-gray-600">
                        {typeof option.credits === 'number' ? `${option.credits} credits` : `${option.credits} credits`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.usd}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
              Multi-Variant Ads are ideal for businesses that need diverse content
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              'A/B Testing',
              'Social Media Ads',
              'Product Catalogs',
              'E-commerce Listings',
              'Email Campaigns',
              'Instagram Stories',
              'Facebook Ads',
              'TikTok Content',
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
              Transform Your Product Images Today
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start creating multiple ad variants instantly. No credit card required for image generation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/dashboard/multi-variant-ads"
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
