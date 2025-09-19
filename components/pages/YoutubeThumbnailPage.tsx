'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import { ImageIcon, Type, Zap, Download, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { THUMBNAIL_CREDIT_COST } from '@/lib/constants';
import Image from 'next/image';

interface ThumbnailRecord {
  id: string;
  title: string;
  identity_image_url: string;
  thumbnail_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  credits_cost: number;
  downloaded: boolean;
  created_at: string;
  error_message?: string;
}

export default function YoutubeThumbnailPage() {
  const { user, isLoaded } = useUser();
  const { credits, refetchCredits } = useCredits();
  const [title, setTitle] = useState('');
  const [identityImage, setIdentityImage] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thumbnailHistory, setThumbnailHistory] = useState<ThumbnailRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // System prompt for YouTube thumbnail generation
  const systemPrompt = `A dynamic, flat-design YouTube thumbnail with a clear left-right composition. The left side is dominated by large, bold, vertically stacked text, occupying approximately 70% of the thumbnail's total width. This text displays the video title: "${title}". This text has its own solid color background panel.

The right side features a real person from the provided image. The person is cropped to show only the head and chest, with a distinct white outline or stroke. **Crucially, the person's facial expression and body language should directly reflect the emotion or subject conveyed by the video title, such as sadness, happiness, excitement, or surprise.**

The colors of the text's background panel, the overall thumbnail background, and the person's clothing must be distinctly different from each other, selected to create maximum visual contrast and separation. The overall thumbnail background is a vibrant gradient with a flat and minimalist aesthetic. Aspect ratio: 16:9.`;

  // Load thumbnail history
  useEffect(() => {
    if (user) {
      loadThumbnailHistory();
    }
  }, [user]);

  const loadThumbnailHistory = async () => {
    try {
      const response = await fetch('/api/youtube-thumbnail/history');
      if (response.ok) {
        const data = await response.json();
        setThumbnailHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load thumbnail history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileUpload = (files: File | File[]) => {
    const file = Array.isArray(files) ? files[0] : files;
    if (file) {
      setIdentityImage(file);
    }
  };

  const handleGenerate = async () => {
    if (!identityImage || !title.trim()) {
      alert('请上传身份照片并输入标题');
      return;
    }

    if (!credits || credits < THUMBNAIL_CREDIT_COST) {
      alert(`积分不足！生成缩略图需要 ${THUMBNAIL_CREDIT_COST} 个积分`);
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('identityImage', identityImage);
      formData.append('title', title);
      formData.append('prompt', systemPrompt);

      const response = await fetch('/api/youtube-thumbnail/generate', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setTitle('');
        setIdentityImage(null);
        await loadThumbnailHistory();
        alert('缩略图生成已开始，请稍后查看结果');
      } else {
        const error = await response.json();
        alert(error.message || '生成失败');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (recordId: string) => {
    try {
      const response = await fetch(`/api/youtube-thumbnail/download/${recordId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        // Download the file
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `thumbnail-${recordId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await refetchCredits();
        await loadThumbnailHistory();
      } else {
        const error = await response.json();
        alert(error.message || '下载失败');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败，请重试');
    }
  };

  const canAffordGeneration = credits != null && credits >= THUMBNAIL_CREDIT_COST;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={credits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">YouTube Thumbnail Generator</h1>
            <p className="text-gray-600">Generate professional YouTube thumbnails with your photo and custom title</p>
          </div>

          {/* Generation Form */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Thumbnail</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Identity Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  <ImageIcon className="w-4 h-4 inline mr-2" />
                  Upload Your Photo
                </label>
                <FileUpload
                  onFileUpload={handleFileUpload}
                />
                {identityImage && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>{identityImage.name}</span>
                  </div>
                )}
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  <Type className="w-4 h-4 inline mr-2" />
                  Video Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter your video title here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  maxLength={100}
                />
                <div className="mt-1 text-sm text-gray-500">
                  {title.length}/100 characters
                </div>
              </div>


              {/* Generate Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <Zap className="w-4 h-4 inline mr-1" />
                  Cost: {THUMBNAIL_CREDIT_COST} credits
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!canAffordGeneration || isGenerating || !identityImage || !title.trim()}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Generate Thumbnail
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Thumbnail History */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Your Thumbnails</h2>
            </div>

            <div className="p-6">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : thumbnailHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No thumbnails generated yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {thumbnailHistory.map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {record.thumbnail_url && (
                        <div className="aspect-video relative">
                          <Image
                            src={record.thumbnail_url}
                            alt={record.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}

                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                          {record.title}
                        </h3>

                        <div className="flex items-center gap-2 mb-3 text-sm">
                          {record.status === 'completed' && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Completed
                            </span>
                          )}
                          {record.status === 'processing' && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Clock className="w-4 h-4" />
                              Processing
                            </span>
                          )}
                          {record.status === 'failed' && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-4 h-4" />
                              Failed
                            </span>
                          )}
                        </div>

                        {record.status === 'completed' && record.thumbnail_url && (
                          <button
                            onClick={() => handleDownload(record.id)}
                            disabled={record.downloaded}
                            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            <Download className="w-4 h-4" />
                            {record.downloaded ? 'Downloaded' : `Download (${THUMBNAIL_CREDIT_COST} credits)`}
                          </button>
                        )}

                        {record.error_message && (
                          <div className="mt-2 text-sm text-red-600">
                            {record.error_message}
                          </div>
                        )}

                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(record.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}