'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/contexts/ToastContext';
import { Link as LinkIcon, ArrowRight, HelpCircle } from 'lucide-react';

const TikTokAnalysisModal = dynamic(
  () => import('@/components/showcase/TikTokAnalysisModal').then((mod) => mod.TikTokAnalysisModal),
  { ssr: false }
);

export default function TikTokInputHero() {
  const { isSignedIn } = useUser();
  const { showError } = useToast();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedTikTokUrl, setSelectedTikTokUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isValidTikTokUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url.trim()));
  };

  const isUrlValid = tiktokUrl.trim() !== '' && !validationError && isValidTikTokUrl(tiktokUrl);
  const validateUrl = (url: string) => {
    if (!url) {
      setValidationError(null);
      return false;
    }
    const isValid = isValidTikTokUrl(url);
    if (!isValid) {
      setValidationError('Please enter a valid TikTok video URL');
    } else {
      setValidationError(null);
    }
    return isValid;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setTiktokUrl(url);
    validateUrl(url);
  };

  const handleAnalyzeTikTok = () => {
    if (!isSignedIn) {
      showError('Sign in to analyze TikTok videos.');
      window.location.href = '/sign-up?redirect_url=/';
      return;
    }

    // Validate TikTok URL
    if (!tiktokUrl || !validateUrl(tiktokUrl)) {
      showError('Please enter a valid TikTok video URL');
      return;
    }

    // Open modal
    setSelectedTikTokUrl(tiktokUrl);
    setIsAnalysisModalOpen(true);
  };

  return (
    <>
      <div className="w-full max-w-lg">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 !h-16 sm:!h-14">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <LinkIcon className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400" />
            </div>
            <input
              type="url"
              placeholder="Paste TikTok URL..."
              value={tiktokUrl}
              onChange={handleUrlChange}
              className={`w-full !h-16 sm:!h-14 pl-14 sm:pl-12 pr-11 border-2 rounded-xl text-base font-medium placeholder:text-gray-400 focus:ring-0 focus:outline-none transition-all shadow-sm ${
                validationError 
                  ? 'border-red-300 focus:border-red-400 bg-white' 
                  : 'border-[#D9D9D9] focus:border-black/50 bg-white'
              }`}
            />
            {/* Valid URL Flood Animation */}
            {isUrlValid && (
              <div className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden mix-blend-multiply opacity-50">
                <div className="flowtra-shimmer h-full w-[40%] bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent" />
              </div>
            )}
            {/* Help Tooltip */}
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center group">
              <HelpCircle className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
              <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                <p className="font-semibold mb-1">How to get a video URL:</p>
                <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                  <li>Find a video on TikTok web</li>
                  <li>Copy the URL from browser address bar</li>
                </ol>
                <p className="mt-2 text-gray-300">
                  TikTok Shop product links are not supported (e.g. <span className="font-medium">vm.tiktok.com/...</span>).
                </p>
                <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 rotate-45"></div>
              </div>
            </div>
          </div>
          <button
            onClick={handleAnalyzeTikTok}
            disabled={!isUrlValid}
            className="w-full sm:w-auto flex-shrink-0 px-6 h-16 sm:h-14 inline-flex items-center justify-center gap-2 bg-black text-white rounded-xl hover:bg-black/90 active:scale-[0.98] transition-all border-2 border-black disabled:bg-[#F7F7F7] disabled:text-[#999999] disabled:border-[#E5E5E5] disabled:cursor-not-allowed shadow-sm cursor-pointer"
            aria-label="Analyze TikTok Video"
          >
            <span className="font-semibold">Analyze</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        
        {/* Validation Error Message */}
        {validationError && (
          <p className="text-sm text-red-500 pl-1 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {validationError}
          </p>
        )}
      </div>

      {isAnalysisModalOpen ? (
        <TikTokAnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          tiktokUrl={selectedTikTokUrl}
        />
      ) : null}
    </>
  );
}
