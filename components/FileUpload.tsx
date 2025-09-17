'use client';

import { useCallback, useState } from 'react';
import { Upload, X, Image } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (files: File | File[]) => void;
  isLoading?: boolean;
  multiple?: boolean;
  variant?: 'default' | 'compact';
}

export default function FileUpload({ onFileUpload, isLoading, multiple = false, variant = 'default' }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      if (files.length > 0) {
        if (multiple) {
          // Limit to 3 files for multiple mode
          const limitedFiles = files.slice(0, 3);
          setSelectedFiles(limitedFiles);
          onFileUpload(limitedFiles);
        } else {
          setSelectedFiles([files[0]]);
          onFileUpload(files[0]);
        }
      }
    }
  }, [onFileUpload, multiple]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      if (files.length > 0) {
        if (multiple) {
          // Limit to 3 files for multiple mode
          const limitedFiles = files.slice(0, 3);
          setSelectedFiles(limitedFiles);
          onFileUpload(limitedFiles);
        } else {
          setSelectedFiles([files[0]]);
          onFileUpload(files[0]);
        }
      }
    }
  }, [onFileUpload, multiple]);


  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const wrapperClasses = variant === 'compact'
    ? 'w-full flex flex-col'
    : 'w-full max-w-lg mx-auto';

  const dropzoneClasses = variant === 'compact'
    ? `border border-dashed rounded-xl p-6 sm:p-7 text-center transition-all duration-200 flex flex-col gap-5 ${
        dragActive 
          ? 'border-gray-700 bg-gray-100 scale-[1.01]' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`
    : `border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
        dragActive 
          ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
      }`;

  return (
    <div className={wrapperClasses}>
      <div
        className={dropzoneClasses}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className={variant === 'compact' ? 'w-12 h-12 bg-gray-900/5 rounded-lg flex items-center justify-center mx-auto mb-4' : 'w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-6'}>
          <Upload className={variant === 'compact' ? 'h-6 w-6 text-gray-700' : 'h-8 w-8 text-gray-500'} />
        </div>
        
        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="w-3 h-3 text-gray-600" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                    {file.name}
                  </span>
                </div>
                {!isLoading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {isLoading ? (
              <div className="flex items-center justify-center space-x-3 mt-4">
                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-black font-medium">Uploading...</span>
              </div>
            ) : (
              <div className="text-center mt-4 animate-slide-in-right">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-gray-900/80 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">Great pick — ready to generate.</p>
                </div>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline transition-all duration-200"
                >
                  Try a different product
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className={variant === 'compact' ? 'mb-5' : 'mb-6'}>
              <h3 className={variant === 'compact' ? 'text-base font-semibold text-gray-900 mb-1.5' : 'text-lg font-semibold text-gray-900 mb-2'}>
                {multiple ? 'Turn Your Photos Into Amazing Videos' : 'Transform Your Product Into a Masterpiece'}
              </h3>
              <p className={variant === 'compact' ? 'text-gray-500 text-sm leading-relaxed' : 'text-gray-500 text-sm'}>
                {isLoading
                  ? 'Creating magic...'
                  : multiple
                    ? 'Drop your product photos here and watch AI create stunning video ads in minutes'
                    : 'Upload your product photo and let AI craft a professional video ad that converts'
                }
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple={multiple}
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
              disabled={isLoading}
            />
            <label
              htmlFor="fileInput"
              className={`px-6 py-3 rounded-lg cursor-pointer inline-flex items-center space-x-2 font-medium transition-all ${
                isLoading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : variant === 'compact'
                    ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm hover:shadow'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
                  <span className="text-black">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{multiple ? 'Upload Product Photos' : 'Upload Product Photo'}</span>
                </>
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
