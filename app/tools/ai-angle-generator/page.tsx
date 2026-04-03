"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Copy, Download, Loader2, Sparkles, Upload } from "lucide-react";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { useSupabaseBrowserClient } from "@/lib/supabase/client";
import { waitForAiReferenceAngleJobs } from "@/lib/ai-reference-angle-jobs-client";
import type { AiReferenceAngleCreateJobResponse } from "@/lib/ai-reference-angle-jobs";

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

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function AngleSkeletonCard({ label, description }: AngleSlot) {
  const lineWidths = ["w-[82%]", "w-[68%]", "w-[74%]", "w-[56%]"];

  return (
    <article className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div className="relative overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F3F3F3]">
        <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
        <div className="aspect-square w-full bg-[#F3F3F3]" />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-black">{label}</h4>
          <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#666666]">
            Generating
          </span>
        </div>
        <p className="text-xs leading-5 text-[#666666]">{description}</p>
      </div>
    </article>
  );
}

export default function AiAngleGeneratorPage() {
  const supabase = useSupabaseBrowserClient();
  const imageInputId = "tool-angle-image-upload";
  const primaryButtonClass =
    "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frontalPreview, setFrontalPreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  const isBusy = status === "uploading" || status === "generating";

  const helperText = useMemo(() => {
    if (status === "uploading") return "Optimizing, validating, and uploading your image...";
    if (status === "generating") return "Generating 3 angle photos while preserving the original style. This can take up to 2 minutes.";
    return null;
  }, [status]);

  const generatedImagesByKey = useMemo(
    () => new Map(generatedImages.map((item) => [item.key, item])),
    [generatedImages]
  );

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

  const persistRecoveryState = (jobs: AiReferenceAngleCreateJobResponse[], fileName: string | null) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        jobs,
        fileName,
      })
    );
  };

  const clearRecoveryState = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  }, []);

  const buildGeneratedImages = useCallback((
    jobs: AiReferenceAngleCreateJobResponse[],
    resolvedJobs: Array<{ id: string; result_image_url: string | null; status: string }>
  ) =>
    jobs.reduce<GeneratedImage[]>((accumulator, job) => {
      const resolvedJob = resolvedJobs.find((item) => item.id === job.id);
      if (!resolvedJob?.result_image_url || resolvedJob.status !== "completed") {
        return accumulator;
      }

      accumulator.push({
        jobId: job.id,
        label: job.presetLabel,
        key: job.presetKey,
        imageUrl: resolvedJob.result_image_url,
      });
      return accumulator;
    }, []), []);

  const resolveGeneration = useCallback(async (jobs: AiReferenceAngleCreateJobResponse[], fileName: string | null) => {
    setStatus("generating");
    setError(null);
    setSelectedFileName(fileName);

    try {
      const resolvedJobs = await waitForAiReferenceAngleJobs({
        supabase,
        jobIds: jobs.map((job) => job.id),
        onJobsUpdated: (updatedJobs) => {
          setGeneratedImages(buildGeneratedImages(jobs, updatedJobs));
        },
      });

      const images = buildGeneratedImages(jobs, resolvedJobs);
      if (images.length !== jobs.length) {
        throw new Error("Generated image URL is missing.");
      }

      setGeneratedImages(images);
      setStatus("success");
      clearRecoveryState();
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate AI angle images.";
      if (!message.includes("still in progress")) {
        clearRecoveryState();
      }
      setError(message);
      setStatus("error");
    }
  }, [buildGeneratedImages, clearRecoveryState, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { jobs?: AiReferenceAngleCreateJobResponse[]; fileName?: string | null };
      if (!Array.isArray(parsed.jobs) || !parsed.jobs.length) return;
      void resolveGeneration(parsed.jobs, parsed.fileName ?? null);
    } catch {
      clearRecoveryState();
    }
  }, [clearRecoveryState, resolveGeneration]);

  const handleCopyUrl = async (taskId: string, imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId((current) => (current === taskId ? null : current)), 1200);
    } catch {
      setError("Failed to copy URL. Please copy it manually.");
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
    setGeneratedImages([]);
    setCopiedTaskId(null);
    setSelectedFileName(file.name);

    try {
      const { imageDataUrl, sourceAspect } = await validateAndReadDataUrl(file);
      setFrontalPreview(imageDataUrl);
      setStatus("generating");

      const createResponse = await fetch("/api/assets/ai-reference-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "universal",
          sourceAspect,
          imageDataUrl,
          existingReferenceCount: 0,
          count: 3,
        }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));

      if (createResponse.status === 401) {
        throw new Error("Please sign in to use this tool.");
      }

      if (createResponse.status === 429) {
        throw new Error(createPayload?.error || "Daily limit reached. You can use this tool once per day.");
      }

      if (!createResponse.ok || !Array.isArray(createPayload?.jobs) || createPayload.jobs.length !== 3) {
        throw new Error(createPayload?.error || "Failed to start AI generation.");
      }

      const jobs = createPayload.jobs as AiReferenceAngleCreateJobResponse[];
      persistRecoveryState(jobs, file.name);
      await resolveGeneration(jobs, file.name);
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
        <section className="mx-auto max-w-[1040px] px-4 sm:px-6 py-14 md:py-20 space-y-8 sm:space-y-10">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-3xl sm:text-5xl font-semibold text-black tracking-tight">AI Multi-Angle Photo</h1>
            <p className="max-w-2xl text-base text-[#666666]">
              Upload one frontal photo to generate 3 additional viewing angles. Supports products, people, and pets.
            </p>
          </div>

          <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Sparkles className="h-5 w-5 text-black" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black">Generate 3 additional angles</h2>
                  <p className="text-sm text-[#666666] mt-1">
                    Upload a JPG or PNG frontal image (minimum 300x300). Large images are automatically optimized before upload to avoid production payload limits.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select frontal image</span>
                <input
                  id={imageInputId}
                  type="file"
                  accept={getAcceptedImageFormats()}
                  onChange={handleFileChange}
                  disabled={isBusy}
                  className="sr-only"
                />
                <label
                  htmlFor={imageInputId}
                  className={`${secondaryButtonClass} w-fit ${isBusy ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Upload className="h-4 w-4" />
                  <span>{isBusy ? "Processing..." : "Choose Image"}</span>
                </label>
                <input
                  readOnly
                  value={selectedFileName ?? ""}
                  placeholder="No image selected"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none"
                />
              </div>

              {selectedFileName && (
                <p className="text-xs text-[#666666]">Selected file: {selectedFileName}</p>
              )}

              {helperText && (
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm text-black">
                  <div className="flex items-center gap-2">
                    {status === "uploading" ? (
                      <Upload className="h-4 w-4 text-black" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                    )}
                    <span>{helperText}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div>{error}</div>
                  {needsSignIn && (
                    <Link
                      href="/sign-in?redirect_url=/tools/ai-angle-generator"
                      className={`${secondaryButtonClass} mt-3 w-fit`}
                    >
                      Sign in and try again
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          {frontalPreview && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-black tracking-tight">Photo set</h3>
                <p className="text-sm text-[#666666]">
                  The generated angles stay locked to your reference image style instead of switching to a new rendering look.
                </p>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
                  <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F7F7F7]">
                    <Image
                      src={frontalPreview}
                      alt="Uploaded frontal preview"
                      width={560}
                      height={560}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-black">Frontal Input</h4>
                  <p className="mt-1 text-xs leading-5 text-[#666666]">
                    This image acts as the style anchor for all generated viewing angles.
                  </p>
                </article>

                {ANGLE_SLOTS.map((slot) => {
                  const image = generatedImagesByKey.get(slot.key);

                  if (!image) {
                    return status === "generating" ? (
                      <AngleSkeletonCard key={slot.key} label={slot.label} description={slot.description} />
                    ) : null;
                  }

                  return (
                    <article
                      key={image.jobId}
                      className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_20px_45px_rgba(0,0,0,0.08)]"
                    >
                      <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F7F7F7]">
                        <Image
                          src={image.imageUrl}
                          alt={slot.label}
                          width={560}
                          height={560}
                          className="h-auto w-full object-cover"
                          unoptimized
                        />
                      </div>
                      <h4 className="mt-3 text-sm font-semibold text-black">{slot.label}</h4>
                      <p className="mt-1 text-xs leading-5 text-[#666666]">{slot.description}</p>
                      <div className="mt-4 flex w-full flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(image.jobId, image.imageUrl)}
                          className={`${primaryButtonClass} w-full justify-center gap-2 text-xs`}
                        >
                          {copiedTaskId === image.jobId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedTaskId === image.jobId ? "Copied" : "Copy URL"}</span>
                        </button>

                        <a
                          href={image.imageUrl}
                          download={`${image.key}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className={`${secondaryButtonClass} w-full justify-center gap-2 text-xs`}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
