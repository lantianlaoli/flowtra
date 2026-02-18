"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

const POLL_MAX_ATTEMPTS = 45;
const POLL_INTERVAL_MS = 2500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (status === "uploading") return "Reading and validating your image...";
    if (status === "generating") return "Generating 3 angle photos. This can take up to 2 minutes.";
    return null;
  }, [status]);

  const getSourceAspect = (width: number, height: number): SourceAspect => {
    if (height > width) return "portrait";
    if (width === height) return "square";
    return "landscape";
  };

  const validateAndReadDataUrl = async (file: File): Promise<{ imageDataUrl: string; sourceAspect: SourceAspect }> => {
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

    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
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
        <section className="mx-auto max-w-[1040px] px-6 py-20 space-y-10">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-black tracking-tight">AI Multi-Angle Photo</h1>
            <p className="max-w-2xl text-base text-[#666666]">
              Upload one frontal photo to generate 3 additional viewing angles. Supports products, people, and pets.
            </p>
          </div>

          <section className="rounded-2xl border border-[#E5E5E5] bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Sparkles className="h-5 w-5 text-black" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black">Generate 3 additional angles</h2>
                  <p className="text-sm text-[#666666] mt-1">
                    Upload a JPG or PNG frontal image (minimum 300x300).
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
              <h3 className="text-2xl font-semibold text-black tracking-tight">Photo set</h3>
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
                </article>

                {generatedImages.map((item) => (
                  <article
                    key={item.taskId}
                    className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_20px_45px_rgba(0,0,0,0.08)]"
                  >
                    <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F7F7F7]">
                      <Image
                        src={item.imageUrl}
                        alt={item.label}
                        width={560}
                        height={560}
                        className="h-auto w-full object-cover"
                        unoptimized
                      />
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-black">{item.label}</h4>
                    <div className="mt-4 flex w-full flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.taskId, item.imageUrl)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-[#333333]"
                      >
                        {copiedTaskId === item.taskId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedTaskId === item.taskId ? "Copied" : "Copy URL"}</span>
                      </button>

                      <a
                        href={item.imageUrl}
                        download={`${item.key}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs font-medium text-black transition hover:bg-[#F7F7F7]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </article>
                ))}

                {status === "generating" &&
                  Array.from({ length: Math.max(0, 3 - generatedImages.length) }).map((_, index) => (
                    <article
                      key={`placeholder-${index}`}
                      className="rounded-2xl border border-dashed border-[#D9D9D9] bg-[#FAFAFA] p-4"
                    >
                      <div className="aspect-square w-full rounded-xl border border-dashed border-[#D9D9D9] bg-white" />
                      <h4 className="mt-3 text-sm font-semibold text-black">Generating...</h4>
                      <p className="mt-1 text-xs text-[#666666]">Angle photo is being created.</p>
                    </article>
                  ))}
              </div>
            </section>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
