'use client';

import { useState } from 'react';
import { Download, Package, CheckCircle, Heart, Sparkles, Coins, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VideoModel } from '@/lib/constants';

interface DownloadButtonProps {
  historyId: string;
  videoModel: VideoModel;
  onDownload: (historyId: string, videoModel: VideoModel) => Promise<void>;
  downloadCost: number;
  isDownloading: boolean;
  hasDownloaded: boolean;
  disabled?: boolean;
}

type DownloadState = 'idle' | 'packaging' | 'downloading' | 'success' | 'error';

const successMessages = [
  "Hope you love this creation! ✨",
  "Your creative video is ready! 🎬",
  "Enjoy this amazing advertisement! 🚀",
  "Carefully crafted video for you! 💫",
  "Hope this creation captivates your audience! 🎯"
];

const packagingMessages = [
  "Carefully packaging for you... 📦",
  "Preparing your exclusive video... 🎁",
  "Almost ready, please wait... ⏳",
  "Processing, almost done... 🔄"
];

export default function DownloadButton({
  historyId,
  videoModel,
  onDownload,
  downloadCost,
  isDownloading,
  hasDownloaded,
  disabled = false
}: DownloadButtonProps) {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [currentMessage, setCurrentMessage] = useState('');

  const handleDownload = async () => {
    if (disabled || isDownloading) return;

    // Start packaging animation
    setDownloadState('packaging');
    setCurrentMessage(packagingMessages[Math.floor(Math.random() * packagingMessages.length)]);
    
    // Simulate packaging time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Start downloading
    setDownloadState('downloading');
    
    try {
      await onDownload(historyId, videoModel);
      
      // Success state
      setDownloadState('success');
      setCurrentMessage(successMessages[Math.floor(Math.random() * successMessages.length)]);
      
      // Reset to idle after showing success
      setTimeout(() => {
        setDownloadState('idle');
        setCurrentMessage('');
      }, 3000);
      
    } catch (error) {  
      setDownloadState('error');
      setCurrentMessage('Download failed, please try again');
      
      // Reset to idle after showing error
      setTimeout(() => {
        setDownloadState('idle');
        setCurrentMessage('');
      }, 2000);
    }
  };

  const getButtonContent = () => {
    switch (downloadState) {
      case 'packaging':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Package className="w-4 h-4 text-blue-600" />
              </motion.div>
              <span className="text-sm font-medium text-blue-600">{currentMessage}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-400">{downloadCost}</span>
            </div>
          </motion.div>
        );
      
      case 'downloading':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Download className="w-4 h-4 text-green-600" />
              </motion.div>
              <span className="text-sm font-medium text-green-600">Downloading...</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">{downloadCost}</span>
            </div>
          </motion.div>
        );
      
      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm font-medium text-green-700"
              >
                {currentMessage}
              </motion.span>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-1.5"
            >
              <Heart className="w-4 h-4 text-pink-500" />
              <span className="text-sm font-bold text-pink-500">❤️</span>
            </motion.div>
          </motion.div>
        );
      
      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ x: [0, -5, 5, -5, 5, 0] }}
                transition={{ duration: 0.5 }}
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
              </motion.div>
              <span className="text-sm font-medium text-red-600">{currentMessage}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400">{downloadCost}</span>
            </div>
          </motion.div>
        );
      
      default:
        if (hasDownloaded) {
          return (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Download Again</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-green-600">{downloadCost}</span>
              </div>
            </div>
          );
        }
        
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Download Video</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-bold text-gray-900">{downloadCost}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <motion.button
      onClick={handleDownload}
      disabled={disabled || isDownloading || downloadState !== 'idle'}
      className={`
        w-full text-left hover:bg-gray-50 rounded cursor-pointer transition-all duration-300
        ${disabled || isDownloading || downloadState !== 'idle' ? 'cursor-not-allowed opacity-75' : ''}
        ${downloadState === 'success' ? 'bg-green-50 border-green-200' : ''}
        ${downloadState === 'error' ? 'bg-red-50 border-red-200' : ''}
        ${downloadState === 'packaging' ? 'bg-blue-50 border-blue-200' : ''}
        ${downloadState === 'downloading' ? 'bg-green-50 border-green-200' : ''}
      `}
      whileHover={downloadState === 'idle' ? { scale: 1.02 } : {}}
      whileTap={downloadState === 'idle' ? { scale: 0.98 } : {}}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={downloadState}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="px-4 py-3"
        >
          {getButtonContent()}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

