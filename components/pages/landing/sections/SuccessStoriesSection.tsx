import Image from 'next/image';
import { FaTiktok } from 'react-icons/fa6';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import { StoreLinkCTA } from '@/components/pages/landing/StoreLinkCTA';
import { successCases } from '@/lib/landing-data';

export default function SuccessStoriesSection() {
  return (
    <section id="features" className="pt-12 md:pt-20 pb-6 md:pb-10 scroll-mt-24">
      <div className="text-center mb-8 md:mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-6">
          Real Success Stories
        </h2>
        <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
          See how creators and businesses use Flowtra to create engaging video content
        </p>
      </div>

      {/* Side-by-Side TikTok Style Cards */}
      <div className="max-w-[100rem] mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-6 lg:gap-8">
          {successCases.map((successCase, index) => (
            <article key={successCase.id} className="bg-white rounded-3xl border border-gray-200 shadow-lg p-6 md:p-8 overflow-hidden">
              {/* Header */}
              <header className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                    <Image
                      src={successCase.avatar}
                      alt={`${successCase.user} TikTok creator profile`}
                      width={48}
                      height={48}
                      sizes="48px"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{successCase.user}</h3>
                  </div>
                </div>
                <a
                  href={successCase.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${successCase.tiktokText} on TikTok`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
                >
                  <FaTiktok className="w-4 h-4" />
                  <span className="sm:hidden">View</span>
                  <span className="hidden sm:inline">{successCase.tiktokText}</span>
                </a>
              </header>

              {/* Quote */}
              <figure className="mb-6">
                <blockquote
                  className="text-lg text-gray-700 font-medium leading-relaxed max-w-3xl"
                  style={index === 0 ? {lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'} : {}}
                >
                  &ldquo;{successCase.quote}&rdquo;
                </blockquote>
              </figure>

              {/* Before & After Showcase */}
              {successCase.layout === 'input-to-output' ? (
                <div className="relative max-w-3xl">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                    {/* Original Product Image */}
                    <div className="flex flex-col items-center">
                      <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[160px] h-[213px] sm:w-[200px] sm:h-[267px]">
                        <Image
                          src={successCase.content.inputImage!}
                          alt="Original product photo"
                          width={200}
                          height={267}
                          sizes="200px"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    {/* Mobile Arrow Between (vertical) */}
                    <div className="block sm:hidden my-1">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Generated Video */}
                    <div className="flex flex-col items-center">
                      <LazyVideoPlayer
                        wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl w-[160px] h-[213px] sm:w-[200px] sm:h-[267px]"
                        className="h-full w-full rounded-2xl"
                        src={successCase.content.videoUrl}
                        ariaLabel="Standard Ads success story: video created with Flowtra AI"
                      />
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="hidden sm:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-3xl px-2">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                    {/* Character Image */}
                    <div className="flex flex-col items-center">
                      <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]">
                        <Image
                          src={successCase.content.characterImage!}
                          alt="Character photo"
                          width={200}
                          height={267}
                          sizes="200px"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    {/* Plus Sign */}
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>

                    {/* Product Image */}
                    <div className="flex flex-col items-center">
                      <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]">
                        <Image
                          src={successCase.content.productImage!}
                          alt="Product photo"
                          width={200}
                          height={267}
                          sizes="200px"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Generated Video */}
                    <div className="flex flex-col items-center">
                      <LazyVideoPlayer
                        wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]"
                        className="h-full w-full rounded-2xl"
                        src={successCase.content.videoUrl}
                        ariaLabel="Character Ads success story: personalized video created with character and product"
                      />
                    </div>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {/* Lead Capture: Store Link Submission */}
      <StoreLinkCTA />
    </section>
  );
}
