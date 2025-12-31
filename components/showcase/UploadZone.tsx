'use client';

import { useCallback, useState } from 'react';
import { Upload, Video } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  uploadProgress?: number;
  fileName?: string;
  fileSize?: number;
  disabled?: boolean;
}

export function UploadZone({
  onFileSelect,
  uploadProgress,
  fileName,
  fileSize,
  disabled = false,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0].type.startsWith('video/')) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect, disabled]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isUploading = uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100;

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 transition-all duration-200
          ${isDragging ? 'border-black bg-gray-50 scale-[1.02]' : 'border-dashed border-gray-300 bg-white'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-black hover:bg-gray-50'}
          ${isUploading ? 'border-solid border-blue-500' : ''}
          h-[400px] lg:h-[320px] md:h-[280px]
        `}
      >
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          aria-label="Upload video file"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
          {isUploading ? (
            // Uploading state
            <>
              <div className="w-16 h-16 mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Uploading...
              </h3>

              {/* Progress bar */}
              <div className="w-full max-w-md mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-600">
                    {fileName && `${fileName} • ${fileSize ? formatFileSize(fileSize) : ''}`}
                  </span>
                  <span className="font-semibold text-blue-600">{uploadProgress}%</span>
                </div>
              </div>
            </>
          ) : (
            // Idle state
            <>
              <div className="w-16 h-16 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Video className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Drop Your Video Here
              </h3>
              <p className="text-gray-600 mb-4 max-w-sm">
                Click to browse or drag and drop your video file
              </p>
              <div className="flex flex-col gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                  <span>Max 80 seconds • MP4, MOV, WEBM</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span>1 free analysis per session</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
