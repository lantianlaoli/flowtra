'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/contexts/ToastContext';
import { TikTokAnalysisModal } from '@/components/showcase/TikTokAnalysisModal';
import { Link as LinkIcon, ArrowRight, HelpCircle } from 'lucide-react';

export default function TikTokInputHero() {
  const { isSignedIn } = useUser();
  const { showError } = useToast();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedTikTokUrl, setSelectedTikTokUrl] = useState('');
  const [hasUsedFreeAnalysis, setHasUsedFreeAnalysis] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if user has already used free analysis
  useEffect(() => {
    const analysisUsed = sessionStorage.getItem('tiktok_analysis_used');
    if (analysisUsed) {
      setHasUsedFreeAnalysis(true);
    }
  }, []);

  const isValidTikTokUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url.trim()));
  };

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
    // Check session rate limit
    const analysisUsed = sessionStorage.getItem('tiktok_analysis_used');
    if (analysisUsed) {
      showError('You have already used your free analysis. Sign up to continue!');
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
        <div className="flex gap-2 h-14">
          <div className="relative flex-1 h-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <LinkIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="url"
              placeholder="Paste TikTok URL..."
              value={tiktokUrl}
              onChange={handleUrlChange}
              className={`w-full h-full pl-12 pr-10 border rounded-lg text-base font-medium placeholder:text-gray-400 bg-white focus:ring-0 focus:outline-none transition-all shadow-sm focus:shadow-md ${
                validationError 
                  ? 'border-red-300 focus:border-red-400' 
                  : 'border-[#E5E5E5] focus:border-[#CCCCCC]'
              }`}
            />
            {/* Help Tooltip */}
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center group">
              <HelpCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                <p className="font-semibold mb-1">How to get the URL:</p>
                <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                  <li>Find a video on TikTok web</li>
                  <li>Copy the URL from browser address bar</li>
                </ol>
                <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 rotate-45"></div>
              </div>
            </div>
          </div>
          <button
            onClick={handleAnalyzeTikTok}
            disabled={!tiktokUrl.trim() || !!validationError}
            className="flex-shrink-0 w-14 h-14 inline-flex items-center justify-center bg-black text-white rounded-lg hover:bg-black/90 active:scale-[0.98] transition-all disabled:bg-[#F7F7F7] disabled:text-[#999999] disabled:border-[#E5E5E5] disabled:border disabled:cursor-not-allowed shadow-sm"
            aria-label="Analyze TikTok Video"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
        
        {/* Validation Error Message */}
        {validationError && (
          <p className="text-sm text-red-500 pl-1 mt-2 animate-in fade-in slide-in-from-top-1 duration-200 absolute">
            {validationError}
          </p>
        )}
      </div>

      <TikTokAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        tiktokUrl={selectedTikTokUrl}
        onComplete={(result) => {
          sessionStorage.setItem('tiktok_analysis_used', JSON.stringify({
            used: true,
            timestamp: Date.now()
          }));
          setHasUsedFreeAnalysis(true);
          sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
            ...result,
            tiktokUrl: selectedTikTokUrl
          }));
        }}
      />
    </>
  );
}
