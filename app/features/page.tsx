import Header from '@/components/layout/Header';
import { Zap, Image, Play, BarChart3, Globe, Shield } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Analysis',
    description: 'Advanced AI analyzes your product images to understand features, benefits, and target audience automatically.'
  },
  {
    icon: Image,
    title: 'Professional Cover Images',
    description: 'Generate high-quality, professional advertisement images that grab attention and drive engagement.'
  },
  {
    icon: Play,
    title: 'Dynamic Video Ads',
    description: 'Create engaging video advertisements using state-of-the-art VEO models for maximum impact.'
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description: 'Track performance metrics and optimize your campaigns with detailed analytics and insights.'
  },
  {
    icon: Globe,
    title: 'Multi-Platform Export',
    description: 'Download content in various formats optimized for different social media platforms and advertising channels.'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Your data is protected with enterprise-grade security and privacy measures throughout the process.'
  }
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            Powerful Features for
            <br />
            <span className="text-gray-700">Modern Marketers</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to create professional advertisements that convert. From AI analysis to final export.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div key={index} className="bg-gray-50 rounded-2xl p-8">
              <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Workflow Section */}
        <div className="bg-gray-50 rounded-2xl p-12 mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple 5-Step Process
            </h2>
            <p className="text-lg text-gray-600">
              From product photo to professional advertisement in minutes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {[
              { step: 1, title: 'Upload', description: 'Upload your product image' },
              { step: 2, title: 'Analyze', description: 'AI analyzes your product' },
              { step: 3, title: 'Generate', description: 'Create campaign concepts' },
              { step: 4, title: 'Design', description: 'Generate cover image' },
              { step: 5, title: 'Produce', description: 'Create video advertisement' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {item.description}
                </p>
                {index < 4 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-0.5 bg-gray-300 transform -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Marketing?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of businesses already using AI to create professional advertisements.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => window.location.href = '/sign-up'}
              className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Get Started for Free
            </button>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              View Pricing
            </button>
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