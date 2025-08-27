'use client';

import { useCallback, useState } from 'react';
import { Upload, X, Image } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (files: File | File[]) => void;
  isLoading?: boolean;
  multiple?: boolean;
}

export default function FileUpload({ onFileUpload, isLoading, multiple = false }: FileUploadProps) {
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

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Upload className="h-8 w-8 text-gray-500" />
        </div>
        
        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                    <Image className="w-3 h-3 text-gray-600" alt="" />
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
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-transparent"></div>
                <span className="text-gray-600 font-medium">Processing {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''}...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2 text-gray-600 font-medium mt-4">
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs">✓</span>
                </div>
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} ready to process
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-500 mb-6 text-sm">
              {isLoading 
                ? 'Processing your images...' 
                : multiple 
                  ? 'Drag and drop up to 3 images, or click to browse'
                  : 'Drag and drop an image, or click to browse'
              }
            </p>
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
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{multiple ? 'Choose Images' : 'Choose Image'}</span>
                </>
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}