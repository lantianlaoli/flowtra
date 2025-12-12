'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Loader2, Package, Upload, X } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import { useImageCompression } from '@/hooks/useImageCompression';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: UserProduct) => void;
  preselectedBrandId?: string | null;
}

type AnalysisState = 'idle' | 'purifying' | 'analyzing' | 'completed' | 'failed';

const STATUS_COPY: Record<AnalysisState, { label: string; badge: string; helper: string }> = {
  idle: {
    label: 'Waiting for photo',
    badge: 'bg-gray-200 text-gray-700',
    helper: 'Upload a clear product photo and Flowtra will purify and describe it automatically.'
  },
  purifying: {
    label: 'Purifying photo…',
    badge: 'bg-purple-100 text-purple-800',
    helper: 'AI is removing background and centering your product. This takes 1-2 minutes.'
  },
  analyzing: {
    label: 'Analyzing photo…',
    badge: 'bg-blue-100 text-blue-800',
    helper: 'Hang tight while we inspect the photo and write the product copy.'
  },
  completed: {
    label: 'Metadata ready',
    badge: 'bg-emerald-100 text-emerald-800',
    helper: 'Review or tweak the generated name and description before saving.'
  },
  failed: {
    label: 'Processing failed',
    badge: 'bg-red-100 text-red-800',
    helper: 'Upload a new photo to retry the automatic processing.'
  }
};

export default function CreateProductModal({
  isOpen,
  onClose,
  onProductCreated,
  preselectedBrandId = null
}: CreateProductModalProps) {
  const [productName, setProductName] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisState>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Purification state tracking
  const [purificationStatus, setPurificationStatus] = useState<'idle' | 'uploading' | 'purifying' | 'completed' | 'failed'>('idle');
  const [purificationTaskId, setPurificationTaskId] = useState<string | null>(null);
  const [purifiedImageUrl, setPurifiedImageUrl] = useState<string | null>(null);
  const [purificationError, setPurificationError] = useState<string | null>(null);

  // Image compression hook
  const { compressImage, isCompressing, compressionProgress } = useImageCompression();

  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setProductDetails('');
      setUploadedImage(null);
      setImagePreview(null);
      setAnalysisStatus('idle');
      setAnalysisError(null);
      setFormError(null);
      setPurificationStatus('idle');
      setPurificationTaskId(null);
      setPurifiedImageUrl(null);
      setPurificationError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setFormError(validationResult.error);
      if (event.target) event.target.value = '';
      return;
    }

    // Reset all states
    setFormError(null);
    setAnalysisError(null);
    setPurificationError(null);
    setUploadedImage(file);
    setAnalysisStatus('purifying');
    setPurificationStatus('uploading');

    // Show original preview while purifying
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Start purification workflow
    purifyAndAnalyzePhoto(file);
  };

  const renderErrorMessage = (message: string) => {
    if (!message.includes(IMAGE_CONVERSION_LINK)) {
      return message;
    }
    const [before, after] = message.split(IMAGE_CONVERSION_LINK);
    return (
      <>
        {before}
        <a
          href={IMAGE_CONVERSION_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-red-800"
        >
          {IMAGE_CONVERSION_LINK}
        </a>
        {after}
      </>
    );
  };

  // NEW: Complete purification + analysis workflow
  const purifyAndAnalyzePhoto = async (file: File) => {
    try {
      // STEP 0: Compress if file > 4MB (to avoid Vercel 4.5MB limit)
      let fileToUpload = file;
      const fileSizeMB = file.size / 1024 / 1024;

      if (fileSizeMB > 4) {
        console.log(`[purify-workflow] File size ${fileSizeMB.toFixed(2)}MB exceeds 4MB, compressing...`);
        setPurificationStatus('uploading'); // Show "Uploading..." during compression

        const compressionResult = await compressImage(file);
        fileToUpload = compressionResult.compressedFile;

        console.log('[purify-workflow] Compression complete:', {
          originalSizeMB: (compressionResult.originalSize / 1024 / 1024).toFixed(2),
          compressedSizeMB: (compressionResult.compressedSize / 1024 / 1024).toFixed(2),
          compressionRatio: `${compressionResult.compressionRatio.toFixed(1)}%`
        });
      }

      // STEP 1: Upload to temporary storage for purification
      setPurificationStatus('uploading');
      console.log('[purify-workflow] Starting temporary upload');

      const uploadFormData = new FormData();
      uploadFormData.append('file', fileToUpload);

      const tempUploadResponse = await fetch('/api/user-products/temp-upload', {
        method: 'POST',
        body: uploadFormData
      });

      if (!tempUploadResponse.ok) {
        const uploadError = await tempUploadResponse.json().catch(() => ({}));
        throw new Error(uploadError?.error || 'Failed to upload photo for purification');
      }

      const { publicUrl: originalImageUrl } = await tempUploadResponse.json();
      console.log('[purify-workflow] Temporary upload complete:', originalImageUrl);

      // STEP 2: Start purification
      setPurificationStatus('purifying');
      console.log('[purify-workflow] Starting purification');

      const purifyResponse = await fetch('/api/user-products/purify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: originalImageUrl })
      });

      if (!purifyResponse.ok) {
        const purifyError = await purifyResponse.json().catch(() => ({}));

        // Check for insufficient credits
        if (purifyResponse.status === 402) {
          setAnalysisStatus('failed');
          setPurificationStatus('failed');
          setPurificationError(purifyError?.details || 'Insufficient credits for photo purification');
          setFormError(purifyError?.details || 'Insufficient credits for photo purification');
          return;
        }

        throw new Error(purifyError?.error || 'Failed to start photo purification');
      }

      const { taskId } = await purifyResponse.json();
      setPurificationTaskId(taskId);
      console.log('[purify-workflow] Purification task created:', taskId);

      // STEP 3: Poll purification status
      const purifiedUrl = await pollPurificationStatus(taskId);

      setPurifiedImageUrl(purifiedUrl);
      setPurificationStatus('completed');
      console.log('[purify-workflow] Purification complete:', purifiedUrl);

      // STEP 4: Update preview with purified image
      setImagePreview(purifiedUrl);

      // STEP 5: Analyze purified photo with Gemini
      setAnalysisStatus('analyzing');
      await analyzePhotoByUrl(purifiedUrl);

    } catch (error) {
      console.error('[purify-workflow] Workflow failed:', error);
      setPurificationStatus('failed');
      setAnalysisStatus('failed');

      const errorMessage = error instanceof Error ? error.message : 'Failed to purify product photo';
      setPurificationError(errorMessage);
      setAnalysisError(errorMessage);
      setFormError(errorMessage);
    }
  };

  // NEW: Poll purification status
  const pollPurificationStatus = async (taskId: string, maxAttempts = 60, intervalMs = 2000): Promise<string> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      console.log(`[purify-workflow] Polling attempt ${attempt + 1}/${maxAttempts}`);

      const statusResponse = await fetch(`/api/user-products/purify-photo?taskId=${taskId}`);

      if (!statusResponse.ok) {
        throw new Error('Failed to check purification status');
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'success' && statusData.imageUrl) {
        console.log('[purify-workflow] Purification succeeded');
        return statusData.imageUrl;
      }

      if (statusData.status === 'fail') {
        throw new Error('Photo purification failed. Please try a different photo.');
      }

      // Status is still 'waiting', continue polling
    }

    throw new Error('Photo purification timed out. Please try again.');
  };

  // NEW: Analyze photo by URL (for purified images)
  const analyzePhotoByUrl = async (imageUrl: string) => {
    try {
      console.log('[purify-workflow] Starting analysis of purified photo');

      const response = await fetch('/api/user-products/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.productName) {
        const message = payload?.error || payload?.details || 'Failed to analyze product photo';
        throw new Error(message);
      }

      setProductName(payload.productName.slice(0, 100));
      setProductDetails(payload.productDetails || '');
      setAnalysisStatus('completed');
      console.log('[purify-workflow] Analysis complete');
    } catch (error) {
      console.error('[purify-workflow] Analysis failed:', error);
      setAnalysisStatus('failed');
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze product photo');
    }
  };

  const analyzePhoto = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/user-products/analyze', {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.productName) {
        const message = payload?.error || payload?.details || 'Failed to analyze product photo';
        throw new Error(message);
      }

      setProductName(payload.productName.slice(0, 100));
      setProductDetails(payload.productDetails || '');
      setAnalysisStatus('completed');
    } catch (error) {
      console.error('Product analysis failed:', error);
      setAnalysisStatus('failed');
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze product photo');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!uploadedImage) {
      setFormError('Upload a product photo to continue.');
      return;
    }

    if (analysisStatus !== 'completed') {
      setFormError('Wait for the AI analysis to finish before saving.');
      return;
    }

    setIsCreating(true);
    setFormError(null);

    try {
      const response = await fetch('/api/user-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim(),
          product_details: productDetails.trim() || null,
          brand_id: preselectedBrandId
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.product) {
        const message = payload?.details || payload?.error || `Failed to create product (${response.status})`;
        throw new Error(message);
      }

      const newProduct = payload.product as UserProduct;

      setIsUploading(true);
      try {
        // Use purified image URL if available, otherwise use original file
        if (purifiedImageUrl) {
          console.log('[submit] Uploading purified image from URL');
          const photoResponse = await fetch(`/api/user-products/${newProduct.id}/photos/from-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: purifiedImageUrl })
          });

          const photoPayload = await photoResponse.json().catch(() => ({}));
          if (!photoResponse.ok || !photoPayload?.photo) {
            console.error('Purified photo upload failed:', {
              status: photoResponse.status,
              payload: photoPayload
            });
            throw new Error(photoPayload?.error || photoPayload?.details || 'Failed to save purified photo');
          }

          newProduct.user_product_photos = [photoPayload.photo];
        } else {
          console.log('[submit] Uploading original image file (fallback)');
          const uploadForm = new FormData();
          uploadForm.append('file', uploadedImage);
          uploadForm.append('is_primary', 'true');

          const photoResponse = await fetch(`/api/user-products/${newProduct.id}/photos`, {
            method: 'POST',
            body: uploadForm
          });

          const photoPayload = await photoResponse.json().catch(() => ({}));
          if (!photoResponse.ok || !photoPayload?.photo) {
            console.error('Product photo upload failed:', {
              status: photoResponse.status,
              payload: photoPayload
            });
            throw new Error(photoPayload?.error || photoPayload?.details || 'Failed to upload product photo');
          }

          newProduct.user_product_photos = [photoPayload.photo];
        }
      } catch (photoError) {
        await fetch(`/api/user-products/${newProduct.id}`, { method: 'DELETE' }).catch(() => null);
        throw photoError;
      } finally {
        setIsUploading(false);
      }

      onProductCreated(newProduct);
      onClose();
    } catch (error) {
      console.error('Error creating product:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to create product. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const canSubmit = Boolean(uploadedImage && analysisStatus === 'completed' && !isCreating && !isUploading);
  const statusMeta = STATUS_COPY[analysisStatus];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-900">Create New Product</p>
                  <p className="text-sm text-gray-600">Upload a product photo and Flowtra will write the listing for you.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                disabled={isCreating}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{renderErrorMessage(formError)}</span>
                </div>
              )}

              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="space-y-3 lg:w-5/12">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-dashed transition",
                      imagePreview
                        ? "border-gray-200 bg-gray-900/5"
                        : "border-gray-300 bg-gray-50 hover:border-gray-400"
                    )}
                  >
                    <div className="absolute left-3 top-3">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusMeta.badge)}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {imagePreview ? (
                      <>
                        <Image src={imagePreview} alt="Product preview" fill className="object-cover" />
                        <button
                          type="button"
                          className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                          onClick={() => {
                            setUploadedImage(null);
                            setImagePreview(null);
                            setAnalysisStatus('idle');
                            setAnalysisError(null);
                            setProductName('');
                            setProductDetails('');
                          }}
                          disabled={isCreating}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-600">
                        <Upload className="mb-3 h-6 w-6 text-gray-400" />
                        <p className="font-semibold text-gray-900">Drop a product photo or click to browse</p>
                        <p className="mt-1 text-xs text-gray-500">PNG or JPG, up to 8MB. Auto-compressed for upload if needed.</p>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isCreating}
                    />

                    {(analysisStatus === 'purifying' || analysisStatus === 'analyzing') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-700 mx-auto mb-2" />
                          <p className="text-xs text-gray-600">
                            {analysisStatus === 'purifying' ? 'Purifying photo...' : 'Analyzing...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">{statusMeta.helper}</p>
                  {analysisError && (
                    <p className="text-xs text-red-600">{analysisError}</p>
                  )}
                </div>

                <div className="flex-1 space-y-5">
                  <div>
                    <label htmlFor="product-name" className="mb-2 block text-sm font-medium text-gray-700">
                      Product Name
                    </label>
                    <input
                      id="product-name"
                      type="text"
                      value={productName}
                      onChange={(event) => setProductName(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      placeholder="AI generated name"
                      disabled={isCreating}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label htmlFor="product-details" className="mb-2 block text-sm font-medium text-gray-700">
                      Product Details
                    </label>
                    <textarea
                      id="product-details"
                      value={productDetails}
                      onChange={(event) => setProductDetails(event.target.value)}
                      className="min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      placeholder="AI generated description"
                      disabled={isCreating}
                      maxLength={2000}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Flowtra drafts 2-3 short sentences automatically. Refine them before saving if needed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {(isCreating || isUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCreating ? (isUploading ? 'Uploading photo…' : 'Creating…') : 'Save Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
