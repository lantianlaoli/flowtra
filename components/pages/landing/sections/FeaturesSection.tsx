import Link from 'next/link';
import { Play, UserPlus, Copy, ArrowRight } from 'lucide-react';

export default function FeaturesSection() {
  return (
    <section className="py-16 lg:py-24">
      <div className="text-center max-w-3xl mx-auto mb-12 px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
          Explore Our Features
        </h2>
        <p className="text-lg text-gray-600">
          Powerful AI tools to transform your product images into professional marketing content
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Standard Ads */}
          <article>
            <Link
              href="/features/standard-ads"
              className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:border-gray-300 block h-full"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors flex-shrink-0" aria-hidden="true">
                  <Play className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-black group-hover:text-gray-900">
                    Standard Ads
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Transform product images into engaging video ads with AI. Support for 50+ languages and custom WhatsApp display.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-black pt-2">
                    Learn More
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </article>

          {/* Character Ads */}
          <article>
            <Link
              href="/features/character-ads"
              className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:border-gray-300 block h-full"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors flex-shrink-0" aria-hidden="true">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-black group-hover:text-gray-900">
                    Character Ads
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Create character-driven video advertisements with realistic AI characters powered by Google Veo3.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-black pt-2">
                    Learn More
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </article>

          {/* Competitor Replica */}
          <article>
            <Link
              href="/features/competitor-replica"
              className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:border-gray-300 block h-full"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors flex-shrink-0" aria-hidden="true">
                  <Copy className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-black group-hover:text-gray-900">
                    Competitor Replica
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Clone top-performing competitor videos with AI. Replicate proven creative structures in minutes.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-black pt-2">
                    Learn More
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
