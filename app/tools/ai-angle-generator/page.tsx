"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Check, Copy, Download, Loader2, Sparkles, Upload } from "lucide-react";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";

type GenerationStatus = "idle" | "uploading" | "generating" | "success" | "error";

type CreateTaskResponse = {
  taskId: string;
  key: string;
  label: string;
};

type TaskStatus = {
  taskId: string;
  status: "pending" | "success" | "failed";
  imageUrl?: string | null;
  failMsg?: string | null;
};

type GeneratedImage = {
  taskId: string;
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

const POLL_MAX_ATTEMPTS = 45;
const POLL_INTERVAL_MS = 2500;
const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const handleCopyUrl = async (taskId: string, imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId((current) => (current === taskId ? null : current)), 1200);
    } catch {
      setError("Failed to copy URL. Please copy it manually.");
    }
  };

  const pollStatuses = async (tasks: CreateTaskResponse[]) => {
    let latestStatuses: TaskStatus[] = [];

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      const params = new URLSearchParams();
      tasks.forEach((task) => params.append("taskId", task.taskId));

      const response = await fetch(`/api/assets/ai-reference-angles?${params.toString()}`, {
        method: "GET",
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("Please sign in to use this tool.");
      }

      if (!response.ok || !Array.isArray(payload?.statuses)) {
        throw new Error(payload?.error || "Failed to check generation progress.");
      }

      latestStatuses = payload.statuses as TaskStatus[];
      const allFinished = latestStatuses.every((item) => item.status === "success" || item.status === "failed");

      if (allFinished) {
        return latestStatuses;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return latestStatuses;
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

      if (!createResponse.ok || !Array.isArray(createPayload?.tasks) || createPayload.tasks.length !== 3) {
        throw new Error(createPayload?.error || "Failed to start AI generation.");
      }

      const tasks = createPayload.tasks as CreateTaskResponse[];
      const statuses = await pollStatuses(tasks);

      if (!statuses.length) {
        throw new Error("Generation timed out. Please try again.");
      }

      const failed = statuses.find((item) => item.status === "failed");
      if (failed) {
        throw new Error(failed.failMsg || "One generation task failed. Please try again.");
      }

      if (statuses.some((item) => item.status !== "success")) {
        throw new Error("Generation timed out. Please try again.");
      }

      const orderedImages = tasks.map((task) => {
        const statusItem = statuses.find((item) => item.taskId === task.taskId);
        if (!statusItem?.imageUrl) {
          throw new Error("Generated image URL is missing.");
        }
        return {
          taskId: task.taskId,
          key: task.key,
          label: task.label,
          imageUrl: statusItem.imageUrl,
        };
      });

      setGeneratedImages(orderedImages);
      setStatus("success");
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

              <label className="flex flex-col gap-3">
                <span className="text-sm font-medium text-black">Select frontal image</span>
                <input
                  type="file"
                  accept={getAcceptedImageFormats()}
                  onChange={handleFileChange}
                  disabled={isBusy}
                  className="block w-full cursor-pointer rounded-lg border border-[#E5E5E5] px-4 py-3 text-sm text-black file:mr-4 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#333333]"
                />
              </label>

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
                      className="mt-2 inline-flex items-center font-medium underline"
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
                      key={image.taskId}
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
                          onClick={() => handleCopyUrl(image.taskId, image.imageUrl)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-[#333333]"
                        >
                          {copiedTaskId === image.taskId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedTaskId === image.taskId ? "Copied" : "Copy URL"}</span>
                        </button>

                        <a
                          href={image.imageUrl}
                          download={`${image.key}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs font-medium text-black transition hover:bg-[#F7F7F7]"
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
