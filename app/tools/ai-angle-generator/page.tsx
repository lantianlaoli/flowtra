"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Coins, Copy, Download, Loader2, Upload } from "lucide-react";
import { OpenAI } from "@lobehub/icons";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { useI18n } from "@/providers/I18nProvider";
import { useToolUsageAccess } from "@/lib/tools/use-tool-usage-access";
import { useToolGenerationRealtime } from "@/lib/tools/use-tool-generation-realtime";
import {
  getImageGenerationCreditCost,
} from "@/lib/tools/billing-constants";

type GenerationStatus = "idle" | "uploading" | "generating" | "success" | "error";

type GeneratedImage = {
  jobId: string;
  label: string;
  key: string;
  imageUrl: string;
};

type SourceAspect = "portrait" | "square" | "landscape";

type AngleSlot = {
  key: string;
  label: string;
  description: string;
};

const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;
const RECOVERY_STORAGE_KEY = "ai-angle-generator-jobs";
const ANGLE_SLOTS: AngleSlot[] = [
  {
    key: "front_left_45",
    label: "45° Front Left",
    description: "Camera positioned at the subject's front-left, with the left side more visible than the right.",
  },
  {
    key: "front_right_45",
    label: "45° Front Right",
    description: "Camera positioned at the subject's front-right, with the right side more visible than the left.",
  },
  {
    key: "back_view",
    label: "Back View",
    description: "Completes the rear view while preserving the same finish, palette, and overall image atmosphere.",
  },
];
const INITIAL_GENERATION_COUNT = 3;
const INITIAL_GENERATION_CREDIT_COST = getImageGenerationCreditCost(INITIAL_GENERATION_COUNT);

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function AngleSkeletonCard({ label }: { label: string }) {
  return (
    <article className="rounded-2xl border border-[#E3E3E3] bg-white p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
      <div className="relative overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F8F8F8]">
        <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
        <div className="aspect-square w-full bg-[#F8F8F8]" />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <h4 className="truncate text-xs font-semibold text-black">{label}</h4>
        <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#666666]">
          Gen
        </span>
      </div>
    </article>
  );
}

export default function AiAngleGeneratorPage() {
  const { messages } = useI18n();
  const { isLoading: isToolAccessLoading, hasUnlimitedAccess } = useToolUsageAccess();
  const toolMessages = messages.tools.aiAngleGenerator;
  const imageInputId = "tool-angle-image-upload";
  const primaryButtonClass =
    "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";
  const slotCardClass =
    "rounded-2xl border border-[#E3E3E3] bg-white p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.06)]";
  const slotMediaClass =
    "overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F8F8F8]";

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frontalPreview, setFrontalPreview] = useState<string | null>(null);
  const [sourceAspect, setSourceAspect] = useState<SourceAspect>("square");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const { job, tasks } = useToolGenerationRealtime(jobId);

  const isBusy = status === "uploading" || status === "generating";

  const helperText = useMemo(() => {
    if (status === "uploading") return toolMessages.uploadingHelper;
    return null;
  }, [status, toolMessages.uploadingHelper]);

  const generatedImagesByKey = useMemo(
    () => new Map(generatedImages.map((item) => [item.key, item])),
    [generatedImages]
  );
  const angleSlots = toolMessages.angleSlots.length === ANGLE_SLOTS.length ? toolMessages.angleSlots : ANGLE_SLOTS;
  const allResultsReady = generatedImages.length === angleSlots.length;

  const getSourceAspect = (width: number, height: number): SourceAspect => {
    if (height > width) return "portrait";
    if (width === height) return "square";
    return "landscape";
  };

  const validateAndReadDataUrl = async (
    file: File
  ): Promise<{ imageDataUrl: string; sourceAspect: SourceAspect }> => {
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

    return {
      imageDataUrl,
      sourceAspect: getSourceAspect(dimensions.width, dimensions.height),
    };
  };

  const persistRecoveryState = (
    id: string,
    fileName: string | null,
    sourcePreview: string | null,
    nextSourceAspect: SourceAspect
  ) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({ jobId: id, fileName, sourcePreview, sourceAspect: nextSourceAspect })
    );
  };

  const persistCompletedState = useCallback((
    images: GeneratedImage[],
    fileName: string | null,
    sourcePreview: string | null,
    nextSourceAspect: SourceAspect
  ) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({ completed: true, images, fileName, sourcePreview, sourceAspect: nextSourceAspect })
    );
  }, []);

  const clearRecoveryState = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  }, []);

  // Map Realtime tasks to GeneratedImage[]
  useEffect(() => {
    if (!tasks.length) return;
    const images: GeneratedImage[] = [];
    for (const task of tasks) {
      if (task.status === 'completed' && task.result_url) {
        const meta = task.metadata as Record<string, unknown> | undefined;
        images.push({
          jobId: task.kie_task_id,
          label: (meta?.preset_label as string) || '',
          key: (meta?.preset_key as string) || '',
          imageUrl: task.result_url,
        });
      }
    }
    setGeneratedImages(images);

    const failedTask = tasks.find((t) => t.status === 'failed');
    if (failedTask) {
      setError(failedTask.error_message || 'AI reference generation failed.');
      setStatus('error');
      clearRecoveryState();
      return;
    }

    const expectedCount = (job?.metadata as Record<string, unknown> | undefined)?.count as number || 0;
    if (expectedCount > 0 && images.length === expectedCount) {
      setStatus('success');
      persistCompletedState(images, selectedFileName, frontalPreview, sourceAspect);
    }
  }, [tasks, job, clearRecoveryState, persistCompletedState, selectedFileName, frontalPreview, sourceAspect]);

  // Recovery on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        jobId?: string;
        fileName?: string | null;
        sourcePreview?: string | null;
        sourceAspect?: SourceAspect;
        completed?: boolean;
        images?: GeneratedImage[];
      };
      if (parsed.completed && Array.isArray(parsed.images) && parsed.images.length > 0) {
        setGeneratedImages(parsed.images);
        setStatus('success');
        setSelectedFileName(parsed.fileName ?? null);
        if (parsed.sourcePreview) setFrontalPreview(parsed.sourcePreview);
        if (parsed.sourceAspect) setSourceAspect(parsed.sourceAspect);
        return;
      }
      if (!parsed.jobId) return;
      setJobId(parsed.jobId);
      setStatus('generating');
      setSelectedFileName(parsed.fileName ?? null);
      if (parsed.sourcePreview) setFrontalPreview(parsed.sourcePreview);
      if (parsed.sourceAspect) setSourceAspect(parsed.sourceAspect);
    } catch {
      clearRecoveryState();
    }
  }, [clearRecoveryState]);

  const handleCopyUrl = async (taskId: string, imageUrl: string) => {
    try {
      let didCopy = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(imageUrl);
          didCopy = true;
        } catch {
          didCopy = false;
        }
      }

      if (!didCopy) {
        const textarea = document.createElement("textarea");
        textarea.value = imageUrl;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Copy command failed");
      }
      setError(null);
      setManualCopyUrl(null);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId((current) => (current === taskId ? null : current)), 1200);
    } catch {
      setError(null);
      setManualCopyUrl(imageUrl);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) {
      event.target.value = "";
    }
    if (!file) return;

    setStatus("uploading");
    setError(null);
    setManualCopyUrl(null);
    setGeneratedImages([]);
    setCopiedTaskId(null);
    setSelectedFileName(file.name);

    try {
      const { imageDataUrl, sourceAspect } = await validateAndReadDataUrl(file);
      setFrontalPreview(imageDataUrl);
      setSourceAspect(sourceAspect);

      if (isToolAccessLoading) {
        throw new Error("Checking subscription status. Please try again in a moment.");
      }

      if (!hasUnlimitedAccess) {
        throw new Error("An active subscription is required to use this generation tool.");
      }

      setStatus("generating");

      const createResponse = await fetch("/api/assets/ai-reference-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "universal",
          sourceAspect,
          imageDataUrl,
          existingReferenceCount: 0,
          count: INITIAL_GENERATION_COUNT,
        }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));

      if (createResponse.status === 401) {
        throw new Error("Please sign in to use this tool.");
      }

      if (!createResponse.ok || !createPayload?.jobId || !Array.isArray(createPayload?.tasks) || createPayload.tasks.length === 0) {
        throw new Error(createPayload?.error || "Failed to start AI generation.");
      }

      setJobId(createPayload.jobId);
      persistRecoveryState(createPayload.jobId, file.name, imageDataUrl, sourceAspect);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate angle photos.";
      setError(message);
      setStatus("error");
    }
  };

  const needsSignIn = error === "Please sign in to use this tool.";

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[1040px] px-4 py-14 sm:px-6 md:py-20">
          <div className="relative space-y-4">
            <div className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold text-yellow-800 shadow-sm sm:text-xs">
              <OpenAI className="h-3.5 w-3.5" />
              <span>Powered by GPT Image 2</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">{toolMessages.eyebrow}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-5xl">{toolMessages.title}</h1>
            <p className="max-w-2xl text-base text-[#666666]">{toolMessages.description}</p>
          </div>

          <section className="mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:mt-8 sm:p-6">
            <input
              id={imageInputId}
              type="file"
              accept={getAcceptedImageFormats()}
              onChange={handleFileChange}
              disabled={isBusy || isToolAccessLoading}
              className="sr-only"
            />

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#888888]">
                Upload source photo
              </p>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#F7F7F7] px-2.5 py-1 text-[11px] font-medium text-[#666666]">
                <Coins className="h-3 w-3" />
                {INITIAL_GENERATION_CREDIT_COST} credits total for {INITIAL_GENERATION_COUNT} photos
              </span>
            </div>

            <div className="grid grid-cols-2 items-start gap-3 xl:grid-cols-4">
              <article className={slotCardClass}>
                <label
                  htmlFor={imageInputId}
                  className={`group block cursor-pointer overflow-hidden rounded-xl border border-dashed border-[#BEBEBE] bg-[#F8F8F8] transition-colors ${isBusy ? "pointer-events-none" : "hover:border-black"}`}
                >
                  {frontalPreview ? (
                    <div className="relative">
                      <Image
                        src={frontalPreview}
                        alt="Uploaded frontal preview"
                        width={560}
                        height={560}
                        className="aspect-square h-auto w-full object-cover"
                        unoptimized
                      />
                      {allResultsReady && !isBusy && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black shadow-sm">
                            <Upload className="h-3.5 w-3.5" />
                            {toolMessages.reupload}
                          </span>
                        </div>
                      )}
                      {!isBusy && !allResultsReady && generatedImages.length > 0 && (
                        <div className="absolute inset-x-2 bottom-2 flex justify-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-black shadow-sm">
                            <Upload className="h-3.5 w-3.5" />
                            {toolMessages.reupload}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5">
                      {status === "uploading" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-black" />
                      ) : (
                        <Upload className="h-5 w-5 text-black" />
                      )}
                      <span className="text-xs font-medium text-black">
                        {isBusy
                          ? messages.common.processing
                          : generatedImages.length > 0
                            ? toolMessages.reupload
                            : toolMessages.chooseImage}
                      </span>
                    </div>
                  )}
                </label>
              </article>

              {angleSlots.map((slot, slotIndex) => {
                const image = generatedImagesByKey.get(slot.key);

                if (!image) {
                  return status === "generating" ? (
                    <AngleSkeletonCard key={slot.key} label={slot.label} />
                  ) : (
                    <article
                      key={slot.key}
                      className={slotCardClass}
                    >
                      <div className={`flex aspect-square w-full items-center justify-center ${slotMediaClass}`}>
                        <span className="text-[11px] font-medium text-[#888888]">{slot.label}</span>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={image.jobId}
                    className={slotCardClass}
                  >
                    <div className={slotMediaClass}>
                      <Image
                        src={image.imageUrl}
                        alt={slot.label}
                        width={560}
                        height={560}
                        className="aspect-square h-auto w-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      <h4 className="truncate text-xs font-semibold text-black">{slot.label}</h4>
                      <div className="grid w-full grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(image.jobId, image.imageUrl)}
                          className={`${primaryButtonClass} h-7 min-w-0 justify-center px-2 text-xs`}
                          aria-label={copiedTaskId === image.jobId ? toolMessages.copied : toolMessages.copyUrl}
                          title={copiedTaskId === image.jobId ? toolMessages.copied : toolMessages.copyUrl}
                        >
                          {copiedTaskId === image.jobId ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={image.imageUrl}
                          download={`${image.key}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className={`${secondaryButtonClass} h-7 min-w-0 justify-center px-2 text-xs`}
                          aria-label={toolMessages.download}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {(helperText || manualCopyUrl || error) && (
              <div className="mt-3 space-y-2">
                {helperText && (
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-xs text-black">
                    <div className="flex items-center gap-2">
                      {status === "uploading" ? (
                        <Upload className="h-3.5 w-3.5 text-black" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
                      )}
                      <span className="truncate">{helperText}</span>
                    </div>
                  </div>
                )}

                {manualCopyUrl && (
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-xs text-black">
                    <label className="mb-1 block font-medium text-[#666666]">
                      Browser blocked clipboard access. Select and copy this URL:
                    </label>
                    <input
                      value={manualCopyUrl}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                      className="w-full rounded-md border border-[#D8D8D8] bg-white px-2 py-1 font-mono text-[11px] text-black"
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <div>{error}</div>
                    {needsSignIn && (
                      <Link
                        href="/sign-in?redirect_url=/tools/ai-angle-generator"
                        className={`${secondaryButtonClass} mt-2 h-7 w-fit px-2 text-[11px]`}
                      >
                        {toolMessages.signInAndRetry}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
