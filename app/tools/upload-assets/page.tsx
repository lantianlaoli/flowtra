"use client";

import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { Check, Copy, ExternalLink, Image as ImageIcon, Upload, Video } from "lucide-react";
import { getToolCreditBalanceHeroState, useToolCreditBalance } from "@/lib/tools/use-tool-credit-balance";

type UploadResult = {
  downloadUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
};

export default function ToolsPage() {
  const videoInputId = "tool-video-upload";
  const imageInputId = "tool-image-upload";
  const primaryButtonClass =
    "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const creditBalance = useToolCreditBalance();
  const heroCreditState = getToolCreditBalanceHeroState(creditBalance);
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
  const SIGN_IN_REQUIRED_ERROR = "__SIGN_IN_REQUIRED__";

  const promptSignIn = () => {
    openSignIn({ forceRedirectUrl: "/tools/upload-assets" });
  };

  const uploadToSupabase = async (file: File) => {
    const response = await fetch("/api/tools/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filename: file.name,
        fileType: file.type,
        kind: "video"
      })
    });

    const data = await response.json();
    if (response.status === 401) {
      promptSignIn();
      throw new Error(SIGN_IN_REQUIRED_ERROR);
    }
    if (!response.ok) {
      throw new Error(data?.error || "Failed to get upload URL");
    }

    const uploadResponse = await fetch(data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(errorText || "Supabase upload failed");
    }

    return { path: data.path as string, fileName: data.fileName as string };
  };

  const uploadImageToSupabase = async (file: File) => {
    const response = await fetch("/api/tools/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filename: file.name,
        fileType: file.type,
        kind: "image"
      })
    });

    const data = await response.json();
    if (response.status === 401) {
      promptSignIn();
      throw new Error(SIGN_IN_REQUIRED_ERROR);
    }
    if (!response.ok) {
      throw new Error(data?.error || "Failed to get upload URL");
    }

    const uploadResponse = await fetch(data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(errorText || "Supabase upload failed");
    }

    return { path: data.path as string, fileName: data.fileName as string };
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setSelectedFileName(file.name);

    try {
      const { path, fileName } = await uploadToSupabase(file);
      const response = await fetch("/api/tools/upload-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path, fileName, fileType: file.type })
      });

      const data = await response.json();
      if (response.status === 401) {
        promptSignIn();
        return;
      }
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
      if (message === SIGN_IN_REQUIRED_ERROR) {
        return;
      }
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!isLoaded || !isSignedIn) {
        setError(null);
        promptSignIn();
        event.target.value = "";
        return;
      }
      handleUpload(file);
    }
  };

  const handleCopy = async () => {
    if (!result?.downloadUrl) return;
    await navigator.clipboard.writeText(result.downloadUrl);
    setVideoCopied(true);
    setTimeout(() => setVideoCopied(false), 1200);
  };

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    setImageError(null);
    setImageResult(null);
    setSelectedImageName(file.name);

    try {
      const { path, fileName } = await uploadImageToSupabase(file);
      const response = await fetch("/api/tools/upload-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path, fileName, fileType: file.type }),
      });

      const data = await response.json();
      if (response.status === 401) {
        promptSignIn();
        return;
      }
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
      if (message === SIGN_IN_REQUIRED_ERROR) {
        return;
      }
      setImageError(message);
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!isLoaded || !isSignedIn) {
        setImageError(null);
        promptSignIn();
        event.target.value = "";
        return;
      }
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
    <ToolPageShell
      toolSlug="upload-assets"
      title="Upload Assets to URL"
      titleBadge="Free"
      description="Upload a video or image and get a temporary download URL. Files are stored for up to 3 days."
      statusLabel={heroCreditState.label}
      statusTone={heroCreditState.tone}
      contentClassName="space-y-10 md:space-y-16"
    >

          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
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
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select a video file</span>
                <input
                  id={videoInputId}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="sr-only"
                />
                <label
                  htmlFor={videoInputId}
                  className={`${secondaryButtonClass} w-fit ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Upload className="h-4 w-4" />
                  <span>{isUploading ? "Uploading..." : "Choose Video"}</span>
                </label>
                <input
                  readOnly
                  value={selectedFileName ?? ""}
                  placeholder="No video selected"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none"
                />
              </div>

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
                      className={`${primaryButtonClass} flex items-center gap-2`}
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
                      className={`${secondaryButtonClass} flex items-center gap-2`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open URL</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
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
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select an image file</span>
                <input
                  id={imageInputId}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isImageUploading}
                  className="sr-only"
                />
                <label
                  htmlFor={imageInputId}
                  className={`${secondaryButtonClass} w-fit ${isImageUploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Upload className="h-4 w-4" />
                  <span>{isImageUploading ? "Uploading..." : "Choose Image"}</span>
                </label>
                <input
                  readOnly
                  value={selectedImageName ?? ""}
                  placeholder="No image selected"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none"
                />
              </div>

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
                      className={`${primaryButtonClass} flex items-center gap-2`}
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
                      className={`${secondaryButtonClass} flex items-center gap-2`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open URL</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
    </ToolPageShell>
  );
}
