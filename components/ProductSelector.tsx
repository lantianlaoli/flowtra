'use client';

import { useState, useEffect, useRef } from 'react';
import { Images, Package, Upload } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

export interface TemporaryProduct extends Omit<UserProduct, 'id'> {
  id: string;
  isTemporary: true;
  uploadedFiles: File[];
}

interface ProductSelectorProps {
  selectedProduct: UserProduct | TemporaryProduct | null;
  onProductSelect: (product: UserProduct | TemporaryProduct | null) => void;
}

type FlowStep = 'choice' | 'upload' | 'existing' | 'review';

const isTemporaryProduct = (
  product: UserProduct | TemporaryProduct | null
): product is TemporaryProduct => {
  return product !== null && 'isTemporary' in product && product.isTemporary === true;
};

export default function ProductSelector({
  selectedProduct,
  onProductSelect
}: ProductSelectorProps) {
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<FlowStep>(() => (selectedProduct ? 'review' : 'choice'));
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousSelectionRef = useRef<UserProduct | TemporaryProduct | null>(selectedProduct);

  const selectedPhotos = selectedProduct?.user_product_photos || [];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct !== previousSelectionRef.current) {
      if (selectedProduct) {
        setStep('review');
      } else {
        setStep('choice');
      }
      previousSelectionRef.current = selectedProduct;
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user-products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || isUploading) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const uploadResponse = await fetch('/api/upload-temp-images', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload images. Please try again.');
      }

      const uploadData = await uploadResponse.json();

      if (!uploadData?.success || !Array.isArray(uploadData.imageUrls) || uploadData.imageUrls.length === 0) {
        throw new Error('No image URLs returned from upload.');
      }

      const tempId = `temp-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const temporaryProduct: TemporaryProduct = {
        id: tempId,
        isTemporary: true,
        uploadedFiles: files,
        product_name: 'Uploaded Images',
        description: `${files.length} image${files.length > 1 ? 's' : ''} uploaded`,
        user_id: '',
        created_at: timestamp,
        updated_at: timestamp,
        user_product_photos: uploadData.imageUrls.map((url: string, index: number) => ({
          id: `temp-photo-${index}`,
          product_id: tempId,
          user_id: '',
          photo_url: url,
          file_name: files[index]?.name || `temp-${index}`,
          is_primary: index === 0,
          created_at: timestamp,
          updated_at: timestamp
        }))
      };

      onProductSelect(temporaryProduct);
    } catch (error) {
      console.error('Error uploading product photos:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload product photos.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || isUploading) return;

    await processFiles(Array.from(files));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length || isUploading) return;

    await processFiles(files);
  };

  const handleProductSelect = (product: UserProduct) => {
    onProductSelect(product);
  };

  const clearSelection = () => {
    onProductSelect(null);
  };

  const renderStepChoice = () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setStep('upload')}
        className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-4 py-5 text-left transition hover:border-gray-300"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Upload className="h-4 w-4 text-gray-500" />
          Upload photos
        </div>
        <p className="text-xs text-gray-500">Add images directly from your device.</p>
      </button>
      <button
        type="button"
        onClick={() => setStep('existing')}
        className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-4 py-5 text-left transition hover:border-gray-300"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Images className="h-4 w-4 text-gray-500" />
          Use saved product
        </div>
        <p className="text-xs text-gray-500">Choose from the products you already saved.</p>
      </button>
    </div>
  );

  const renderUploadStep = () => (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="text-sm font-semibold text-gray-900">Upload product photos</div>
        <button
          type="button"
          onClick={() => setStep('choice')}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <span className="text-base">←</span>
          Back
        </button>
      </div>
      <div
        className="space-y-5 px-6 py-6"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
      >
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={isUploading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Select images
              </>
            )}
          </button>
          <p className="mt-3 text-xs text-gray-500">
            Drag and drop files here or browse from your device.
          </p>
        </div>
        {uploadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            {uploadError}
          </div>
        )}
        {isTemporaryProduct(selectedProduct) && selectedPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Uploaded photos</span>
              <button
                type="button"
                onClick={clearSelection}
                className="cursor-pointer font-medium text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto">
              {selectedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="h-16 w-16 flex-none overflow-hidden rounded border border-gray-100"
                >
                  <Image
                    src={photo.photo_url}
                    alt={`Uploaded product photo`}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderExistingStep = () => (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="text-sm font-semibold text-gray-900">Select a saved product</div>
        <button
          type="button"
          onClick={() => setStep('choice')}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <span className="text-base">←</span>
          Back
        </button>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            <Package className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            No products found.
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => {
              const photos = product.user_product_photos || [];
              const previewPhoto = photos.find((photo) => photo.is_primary) || photos[0];
              const isSelected = selectedProduct?.id === product.id && !isTemporaryProduct(selectedProduct);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductSelect(product)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    isSelected ? 'border-gray-400 bg-gray-100' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {previewPhoto ? (
                    <div className="h-12 w-12 overflow-hidden rounded">
                      <Image
                        src={previewPhoto.photo_url}
                        alt={product.product_name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {product.product_name}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                      {product.description && (
                        <>
                          {' • '}
                          {product.description}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderReviewStep = () => {
    if (!selectedProduct) return null;

    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="text-sm font-semibold text-gray-900">Product photos ready</div>
        <button
          type="button"
          onClick={() => setStep('choice')}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <span className="text-base">←</span>
          Back
        </button>
        </div>
        <div className="space-y-4 px-6 py-6">
          {!isTemporaryProduct(selectedProduct) && (
            <div>
              <div className="text-sm font-semibold text-gray-900">{selectedProduct.product_name}</div>
              {selectedProduct.description && (
                <p className="mt-1 text-xs text-gray-500">{selectedProduct.description}</p>
              )}
            </div>
          )}
          {selectedPhotos.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto">
              {selectedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="h-16 w-16 flex-none overflow-hidden rounded border border-gray-100"
                >
                  <Image
                    src={photo.photo_url}
                    alt={`${selectedProduct.product_name} photo`}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No photos linked yet.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {step === 'choice' && (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepChoice()}
          </motion.div>
        )}

        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderUploadStep()}
          </motion.div>
        )}

        {step === 'existing' && (
          <motion.div
            key="existing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderExistingStep()}
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderReviewStep()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
