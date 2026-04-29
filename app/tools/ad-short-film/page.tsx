"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Copy, Download, Loader2, Upload, Video, X, Play } from "lucide-react";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { useI18n } from "@/providers/I18nProvider";
import {
  canUseTool,
  incrementLimitedToolUsage,
  TOOL_LIMIT_MESSAGES,
} from "@/lib/tools/usage-limits";
import { useToolUsageAccess } from "@/lib/tools/use-tool-usage-access";

type GenerationStatus =
  | "idle"
  | "uploading"
  | "generating_storyboard"
  | "generating_storyboard_image"
  | "generating_video"
  | "completed"
  | "error";

const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function getStatusLabel(status: GenerationStatus, messages: { [key: string]: string }): string {
  switch (status) {
    case "uploading":
      return messages.uploading || "Uploading product photo...";
    case "generating_storyboard":
      return messages.generatingStoryboard || "Generating storyboard prompt...";
    case "generating_storyboard_image":
      return messages.generatingStoryboardImage || "Generating storyboard image...";
    case "generating_video":
      return messages.generatingVideo || "Generating ad video...";
    case "completed":
      return messages.completed || "Video generated successfully!";
    default:
      return "";
  }
}

export default function AdShortFilmPage() {
  const { messages } = useI18n();
  const toolMessages = messages.tools.adShortFilm || {};
  const { isLoading: isToolAccessLoading, hasUnlimitedAccess } = useToolUsageAccess();

  const primaryButtonClass = "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass = "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [productPhotoUrl, setProductPhotoUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [storyboardImageUrl, setStoryboardImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = status !== "idle" && status !== "completed" && status !== "error";

  const validateAndReadDataUrl = useCallback(async (file: File): Promise<string> => {
    const formatCheck = validateImageFormat(file);
    if (!formatCheck.isValid) {
      throw new Error(formatCheck.error);
    }

    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image. Please try another file."));
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    });

    if (dimensions.width < 300 || dimensions.height < 300) {
      throw new Error(
        `Image too small. Minimum size is 300x300px. Your image is ${dimensions.width}x${dimensions.height}px.`
      );
    }

    const needsOptimization =
      file.size > MAX_CLIENT_UPLOAD_SIZE_MB * 1024 * 1024 ||
      Math.max(dimensions.width, dimensions.height) > MAX_CLIENT_UPLOAD_DIMENSION;

    const uploadFile = needsOptimization
      ? await imageCompression(file, {
          maxSizeMB: MAX_CLIENT_UPLOAD_SIZE_MB,
          maxWidthOrHeight: MAX_CLIENT_UPLOAD_DIMENSION,
          useWebWorker: true,
          initialQuality: 0.92,
          preserveExif: false,
          fileType: file.type || undefined,
        })
      : file;

    const estimatedRequestSize = estimateDataUrlRequestSize(
      uploadFile.size,
      uploadFile.type || file.type || "image/jpeg"
    );

    if (estimatedRequestSize > VERCEL_FUNCTION_BODY_LIMIT_BYTES - REQUEST_SIZE_BUFFER_BYTES) {
      const optimizedSizeMb = (uploadFile.size / 1024 / 1024).toFixed(2);
      throw new Error(
        `This image is still too large for production upload after optimization (${optimizedSizeMb} MB). Please use a smaller image or reduce the dimensions before uploading.`
      );
    }

    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(uploadFile);
    });

    return imageDataUrl;
  }, []);

  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);
    setSelectedFileName(file.name);

    try {
      const imageDataUrl = await validateAndReadDataUrl(file);
      setProductPhotoUrl(imageDataUrl);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process image.";
      setError(message);
      setStatus("error");
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const pollJobStatus = async (jobId: string, maxAttempts = 450) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const response = await fetch(`/api/tools/ad-short-film?jobId=${encodeURIComponent(jobId)}`);
        const data = await response.json();

        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setStatus("completed");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Failed to check generation status.");
        }

        if (data.status === "failed") {
          throw new Error(`JOB_FAILED:${data.errorMessage || "Generation failed"}`);
        }

        // Update status based on current processing step
        if (data.status === "generating_storyboard") {
          setStatus("generating_storyboard");
        } else if (data.status === "generating_storyboard_image") {
          setStatus("generating_storyboard_image");
          if (data.storyboardImageUrl) {
            setStoryboardImageUrl(data.storyboardImageUrl);
          }
        } else if (data.status === "generating_video") {
          setStatus("generating_video");
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("JOB_FAILED:")) {
          throw new Error(err.message.replace("JOB_FAILED:", ""));
        }

        if (attempt === maxAttempts - 1) {
          throw new Error("Generation timed out. Please try again.");
        }
      }
    }

    throw new Error("Generation timed out. Please try again.");
  };

  const handleGenerate = async () => {
    if (!productPhotoUrl) {
      setError("Please upload a product photo first.");
      return;
    }

    setStatus("uploading");
    setError(null);
    setVideoUrl(null);
    setStoryboardImageUrl(null);

    try {
      if (isToolAccessLoading) {
        throw new Error("Checking subscription status. Please try again in a moment.");
      }

      if (!canUseTool("ad-short-film", { hasUnlimitedAccess })) {
        throw new Error(TOOL_LIMIT_MESSAGES["ad-short-film"]);
      }

      const response = await fetch("/api/tools/ad-short-film", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productPhotoDataUrl: productPhotoUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation.");
      }

      incrementLimitedToolUsage("ad-short-film", { hasUnlimitedAccess });
      setStatus("generating_storyboard");

      await pollJobStatus(data.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate ad video.";
      setError(message);
      setStatus("error");
    }
  };

  const handleReset = () => {
    setProductPhotoUrl(null);
    setSelectedFileName(null);
    setVideoUrl(null);
    setStoryboardImageUrl(null);
    setCopied(false);
    setStatus("idle");
    setError(null);
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Failed to copy URL.");
    }
  };

  const isGenerating = status !== "idle" && status !== "completed" && status !== "error";
  const isCompleted = status === "completed";
  const isError = status === "error";

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[980px] px-4 py-14 sm:px-6 md:py-20">
          <div className="relative mb-6 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">
              {toolMessages.eyebrow || "Tools"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">
              {toolMessages.title || "AI Ad Short Film"}
            </h1>
            <p className="max-w-2xl text-sm text-[#666666]">
              {toolMessages.description ||
                "Upload a product photo and generate a 15-second cinematic ad video."}
            </p>
          </div>

          <section className="rounded-xl border border-[#E5E5E5] bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.06)] sm:p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-black">
                    {toolMessages.productPhotoLabel || "Product Photo"}
                  </span>
                  <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                    Required
                  </span>
                </div>
                <div className="group relative">
                  <label
                    className={`relative block cursor-pointer overflow-hidden rounded-lg border border-dashed border-[#BEBEBE] bg-[#F8F8F8] transition-colors ${isGenerating ? "pointer-events-none opacity-50" : "hover:border-black"}`}
                  >
                    {productPhotoUrl ? (
                      <Image
                        src={productPhotoUrl}
                        alt="Product"
                        width={520}
                        height={924}
                        className="aspect-[9/16] h-auto w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1.5">
                        {status === "uploading" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-black" />
                        ) : (
                          <Upload className="h-5 w-5 text-black" />
                        )}
                        <span className="text-xs font-medium text-black">
                          {toolMessages.selectProductPhoto || "Upload"}
                        </span>
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      onChange={handleProductPhotoUpload}
                      disabled={isGenerating}
                      className="sr-only"
                    />
                  </label>
                  {productPhotoUrl && !isGenerating && (
                    <button
                      type="button"
                      onClick={handleReset}
                      aria-label="Remove product photo"
                      title="Remove product photo"
                      className="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-black/70 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 hover:bg-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-black">Storyboard Image</span>
                  <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                    Preview
                  </span>
                </div>
                <div className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8]">
                  {storyboardImageUrl ? (
                    <Image
                      src={storyboardImageUrl}
                      alt="Storyboard preview"
                      width={520}
                      height={924}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : status === "generating_storyboard_image" ? (
                    <>
                      <span className="sr-only">{getStatusLabel(status, toolMessages)}</span>
                      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,transparent_34%,rgba(255,255,255,0.82)_48%,transparent_62%,transparent_100%)] animate-[ad-short-film-wave_1.25s_ease-in-out_infinite]" />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[#999999]">
                      <Video className="h-6 w-6 text-[#CCCCCC]" />
                      <span className="text-xs">Generated storyboard appears here</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !productPhotoUrl}
              className={`${primaryButtonClass} mt-3 flex w-full items-center justify-center gap-2 rounded-lg ${isGenerating || !productPhotoUrl ? "opacity-50" : ""}`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {toolMessages.generating || "Generating..."}
                </>
              ) : isCompleted ? (
                <>
                  <Play className="h-4 w-4" />
                  {toolMessages.completed || "Completed!"}
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  {toolMessages.generate || "Generate Ad Video"}
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {((status === "generating_video" && storyboardImageUrl) || (isCompleted && videoUrl)) && (
              <div className="mt-3">
                <div className="w-full max-w-[280px] rounded-xl border border-[#E3E3E3] bg-white p-1.5">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F1F1F1]">
                    {isCompleted && videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        className="h-full w-full bg-black object-cover"
                      />
                    ) : (
                      <>
                        <span className="sr-only">{getStatusLabel(status, toolMessages)}</span>
                        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,transparent_34%,rgba(255,255,255,0.82)_48%,transparent_62%,transparent_100%)] animate-[ad-short-film-wave_1.25s_ease-in-out_infinite]" />
                      </>
                    )}
                  </div>
                  {isCompleted && videoUrl && (
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(videoUrl)}
                        className={`${primaryButtonClass} h-7 flex-1 justify-center text-[11px]`}
                        aria-label={copied ? "Copied video URL" : "Copy video URL"}
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a
                        href={videoUrl}
                        download="ad-short-film.mp4"
                        target="_blank"
                        rel="noreferrer"
                        className={`${secondaryButtonClass} h-7 flex-1 justify-center text-[11px]`}
                        aria-label="Download video"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <style jsx global>{`
              @keyframes ad-short-film-wave {
                0% {
                  transform: translateX(-110%);
                }
                100% {
                  transform: translateX(110%);
                }
              }
            `}</style>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
