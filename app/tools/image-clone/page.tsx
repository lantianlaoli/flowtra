"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Copy, Download, Loader2, Upload, X, FileText, Type, Crop, Image as ImageIcon } from "lucide-react";
import { OpenAI } from "@lobehub/icons";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { useI18n } from "@/providers/I18nProvider";

type GenerationStatus = "idle" | "uploading" | "generating" | "success" | "error";

const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;

const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
const RESOLUTIONS = ["1K", "2K", "4K"] as const;

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function ImageSlotCard({
  label,
  imageUrl,
  isLoading,
  onFileSelect,
  onRemove,
  disabled,
  required = false,
}: {
  label: string;
  imageUrl: string | null;
  isLoading?: boolean;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const { messages } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-black">{label}</span>
        {required && (
          <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
            Required
          </span>
        )}
      </div>
      <label
        className={`group relative block cursor-pointer overflow-hidden rounded-xl border border-dashed border-[#BEBEBE] bg-[#F8F8F8] transition-colors ${disabled || isLoading ? "pointer-events-none opacity-50" : "hover:border-black"}`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={label}
            width={400}
            height={400}
            className="aspect-square h-auto w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-black" />
            ) : (
              <Upload className="h-5 w-5 text-black" />
            )}
            <span className="text-xs font-medium text-black">{messages.tools.imageClone.selectProductPhoto}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={getAcceptedImageFormats()}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className="sr-only"
        />
      </label>
      {imageUrl && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-1.5 flex h-7 w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2 text-[11px] font-medium text-[#666666] hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-3 w-3" />
          Remove
        </button>
      )}
    </div>
  );
}

export default function ImageClonePage() {
  const { messages } = useI18n();
  const toolMessages = messages.tools.imageClone;

  const primaryButtonClass = "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass = "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [productPhotoUrl, setProductPhotoUrl] = useState<string | null>(null);
  const [referencePhotoUrl, setReferencePhotoUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [copyText, setCopyText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<typeof ASPECT_RATIOS[number]>("1:1");
  const [resolution, setResolution] = useState<typeof RESOLUTIONS[number]>("2K");

  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isBusy = status === "uploading" || status === "generating";

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

  const handleProductPhotoUpload = async (file: File) => {
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
  };

  const handleReferencePhotoUpload = async (file: File) => {
    setStatus("uploading");
    setError(null);

    try {
      const imageDataUrl = await validateAndReadDataUrl(file);
      setReferencePhotoUrl(imageDataUrl);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process reference image.";
      setError(message);
      setStatus("error");
    }
  };

  const pollJobStatus = async (jobId: string, maxAttempts = 90) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const response = await fetch(`/api/tools/image-clone?jobId=${encodeURIComponent(jobId)}`);
        const data = await response.json();

        if (data.status === "completed" && data.resultImageUrl) {
          return data.resultImageUrl;
        }

        if (data.status === "failed") {
          throw new Error(data.errorMessage || "Generation failed");
        }
      } catch (err) {
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

    setStatus("generating");
    setError(null);

    try {
      const response = await fetch("/api/tools/image-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          productPhotoDataUrl: productPhotoUrl,
          referencePhotoDataUrls: referencePhotoUrl ? [referencePhotoUrl] : [],
          copyText: copyText,
          aspectRatio,
          resolution,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation.");
      }

      const resultImageUrl = await pollJobStatus(data.jobId);
      setResultUrls((prev) => [...prev, resultImageUrl]);
      setCurrentJobId(data.jobId);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate image.";
      setError(message);
      setStatus("error");
    }
  };

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setError("Failed to copy URL.");
    }
  };

  const handleReset = () => {
    setProductPhotoUrl(null);
    setReferencePhotoUrl(null);
    setCopyText("");
    setResultUrls([]);
    setCurrentJobId(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[1040px] px-4 py-14 sm:px-6 md:py-20">
          <div className="relative mb-6 space-y-2">
            <div className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold text-yellow-800 shadow-sm sm:text-xs">
              <OpenAI className="h-3.5 w-3.5" />
              <span>Powered by GPT Image 2</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">{toolMessages.eyebrow}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">{toolMessages.title}</h1>
            <p className="max-w-2xl text-sm text-[#666666]">{toolMessages.description}</p>
          </div>

          <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:p-6">
            {/* Left-Right Layout */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Images */}
              <div className="grid grid-cols-2 gap-3">
                <ImageSlotCard
                  label="Your Product"
                  imageUrl={productPhotoUrl}
                  isLoading={status === "uploading"}
                  onFileSelect={handleProductPhotoUpload}
                  disabled={isBusy}
                />
                <ImageSlotCard
                  label="Competitor Ref"
                  imageUrl={referencePhotoUrl}
                  isLoading={status === "uploading"}
                  onFileSelect={handleReferencePhotoUpload}
                  onRemove={referencePhotoUrl ? () => setReferencePhotoUrl(null) : undefined}
                  disabled={isBusy}
                />
              </div>

              {/* Right: Form */}
              <div className="flex h-full flex-col justify-between space-y-3">
                <div className="flex h-[120px] flex-col">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black">
                    <Type className="h-3.5 w-3.5" />
                    {toolMessages.copyTextLabel}
                  </label>
                  <textarea
                    value={copyText}
                    onChange={(e) => setCopyText(e.target.value)}
                    placeholder={toolMessages.copyTextPlaceholder}
                    disabled={isBusy}
                    className="flex-1 w-full resize-none rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] px-3 py-2 text-sm text-black placeholder-[#888888] focus:border-black focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="flex items-end gap-6">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                      <Crop className="h-3.5 w-3.5" />
                      {toolMessages.aspectRatioLabel}
                    </div>
                    <div className="relative flex rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-0.5">
                      <div
                        className="absolute top-0.5 h-[calc(100%-4px)] rounded-lg bg-white shadow-sm transition-all duration-200"
                        style={{
                          left: '2px',
                          width: `calc(${100 / ASPECT_RATIOS.length}% - 4px)`,
                          transform: `translateX(calc(${ASPECT_RATIOS.indexOf(aspectRatio)} * (100% + 4px)))`,
                        }}
                      />
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          disabled={isBusy}
                          className="relative z-10 flex-1 py-1.5 text-xs font-medium text-black"
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-36">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {toolMessages.resolutionLabel}
                    </div>
                    <div className="relative flex rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-0.5">
                      <div
                        className="absolute top-0.5 h-[calc(100%-4px)] rounded-lg bg-white shadow-sm transition-all duration-200"
                        style={{
                          left: '2px',
                          width: `calc(${100 / RESOLUTIONS.length}% - 4px)`,
                          transform: `translateX(calc(${RESOLUTIONS.indexOf(resolution)} * (100% + 4px)))`,
                        }}
                      />
                      {RESOLUTIONS.map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setResolution(res)}
                          disabled={isBusy}
                          className="relative z-10 flex-1 py-1.5 text-xs font-medium text-black"
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isBusy || !productPhotoUrl}
                  className={`landing-press-button w-full justify-center text-sm font-medium ${primaryButtonClass} ${isBusy || !productPhotoUrl ? "opacity-50" : ""}`}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {toolMessages.generating}
                    </>
                  ) : (
                    toolMessages.generate
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Result Section */}
            <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
              {(status === "generating" || resultUrls.length > 0) && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-black">
                  <ImageIcon className="h-4 w-4" /> {toolMessages.resultTitle}
                </h2>
              )}
              <div className="grid grid-cols-3 gap-3">
                {/* Skeleton during generation */}
                {status === "generating" && (
                  <div className="rounded-xl border border-[#E3E3E3] bg-white p-1.5">
                    <div className="relative overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8]">
                      <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
                      <div className="aspect-square w-full bg-[#F8F8F8]" />
                    </div>
                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[10px] text-[#888888]">Generating...</span>
                    </div>
                  </div>
                )}
                {/* Result cards */}
                {resultUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="rounded-xl border border-[#E3E3E3] bg-white p-1.5">
                    <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8]">
                      <Image
                        src={url}
                        alt={`Result ${index + 1}`}
                        width={400}
                        height={400}
                        className="h-auto w-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(url, `${index}`)}
                        className={`${primaryButtonClass} h-7 flex-1 justify-center text-[11px]`}
                      >
                        {copiedId === `${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a
                        href={url}
                        download={`image-clone-${index + 1}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className={`${secondaryButtonClass} h-7 flex-1 justify-center text-[11px]`}
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* No Result Yet */}
              {status !== "generating" && resultUrls.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <ImageIcon className="mb-2 h-8 w-8 text-[#CCCCCC]" />
                  <p className="text-sm text-[#888888]">Result will appear here</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
