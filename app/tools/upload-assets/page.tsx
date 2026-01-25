"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Copy, ExternalLink, Image as ImageIcon, Upload, Video } from "lucide-react";

type UploadResult = {
  downloadUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
};

export default function ToolsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [videoCopied, setVideoCopied] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<UploadResult | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [imageCopied, setImageCopied] = useState(false);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setSelectedFileName(file.name);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/tools/upload-video", {
        method: "POST",
        body,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setResult({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadedAt: data.uploadedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleCopy = async () => {
    if (!result?.downloadUrl) return;
    await navigator.clipboard.writeText(result.downloadUrl);
    setVideoCopied(true);
    setTimeout(() => setVideoCopied(false), 1200);
  };

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    setImageError(null);
    setImageResult(null);
    setSelectedImageName(file.name);

    try {
      const base64Data = await readAsDataUrl(file);

      const response = await fetch("/api/tools/upload-image-base64", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ base64Data, fileName: file.name }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setImageResult({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadedAt: data.uploadedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setImageError(message);
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCopyImageUrl = async () => {
    if (!imageResult?.downloadUrl) return;
    await navigator.clipboard.writeText(imageResult.downloadUrl);
    setImageCopied(true);
    setTimeout(() => setImageCopied(false), 1200);
  };

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[980px] px-6 py-20 space-y-16">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-black tracking-tight">
              Upload Assets to URL
            </h1>
            <p className="text-base text-[#666666] max-w-2xl">
              Upload a video or image and get a temporary download URL. Files are stored for up to 3 days.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Video className="h-5 w-5 text-black" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black">Video upload</h2>
                  <p className="text-sm text-[#666666] mt-1">
                    Best for files larger than 10MB.
                  </p>
                </div>
              </div>
              <label className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select a video file</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="block w-full cursor-pointer rounded-lg border border-[#E5E5E5] px-4 py-3 text-sm text-black file:mr-4 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#333333]"
                />
              </label>

              {isUploading && (
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm text-black">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-black" />
                    <span>Uploading... this may take a moment.</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {result?.downloadUrl && (
                <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-4 text-sm text-black">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4 text-black" />
                    <span>Upload successful</span>
                  </div>
                  <div className="mt-2 break-all text-[#666666]">{result.downloadUrl}</div>
                  {selectedFileName && (
                    <div className="mt-3 text-xs text-[#666666]">File: {selectedFileName}</div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333333] flex items-center gap-2"
                    >
                      {videoCopied ? (
                        <>
                          <Check className="h-4 w-4 animate-pulse" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                    <a
                      href={result.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#F7F7F7] flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open URL</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <ImageIcon className="h-5 w-5 text-black" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black">Image upload</h2>
                  <p className="text-sm text-[#666666] mt-1">
                    Base64 upload for small image files.
                  </p>
                </div>
              </div>
              <label className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select an image file</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isImageUploading}
                  className="block w-full cursor-pointer rounded-lg border border-[#E5E5E5] px-4 py-3 text-sm text-black file:mr-4 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#333333]"
                />
              </label>

              {isImageUploading && (
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm text-black">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-black" />
                    <span>Uploading... this may take a moment.</span>
                  </div>
                </div>
              )}

              {imageError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {imageError}
                </div>
              )}

              {imageResult?.downloadUrl && (
                <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-4 text-sm text-black">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4 text-black" />
                    <span>Upload successful</span>
                  </div>
                  <div className="mt-2 break-all text-[#666666]">{imageResult.downloadUrl}</div>
                  {selectedImageName && (
                    <div className="mt-3 text-xs text-[#666666]">File: {selectedImageName}</div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleCopyImageUrl}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333333] flex items-center gap-2"
                    >
                      {imageCopied ? (
                        <>
                          <Check className="h-4 w-4 animate-pulse" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                    <a
                      href={imageResult.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#F7F7F7] flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open URL</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
