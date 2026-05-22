"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Languages,
  Loader2,
  Monitor,
  PackageSearch,
  Settings2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { ByteDance } from "@lobehub/icons";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { cn } from "@/lib/utils";
import { useToolUsageAccess } from "@/lib/tools/use-tool-usage-access";
import { useToolGenerationRealtime } from "@/lib/tools/use-tool-generation-realtime";
import {
  getEcommerceListingStudioCreditCost,
} from "@/lib/tools/billing-constants";
import type { ToolGenerationJob } from "@/lib/tools/job-store";
import type {
  EcommerceListingAssetScope,
  EcommerceListingImageAspectRatio,
  EcommerceListingImageResolution,
  EcommerceListingImageSlot,
  EcommerceListingMetadata,
  EcommerceListingTextLanguage,
  EcommerceListingVideoAspectRatio,
  EcommerceListingVideoModel,
  EcommerceListingVideoResolution,
} from "@/lib/tools/ecommerce-listing-studio";

type ProductView = "front" | "side" | "back";
type PageStatus = "idle" | "uploading" | "starting" | "processing" | "completed" | "error";
type ProductPhoto = { view: ProductView; label: string; helper: string; dataUrl: string | null; fileName: string | null; required?: boolean };

const SESSION_KEY = "flowtra:ecommerce-listing-studio";
const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;
const IMAGE_RATIOS: EcommerceListingImageAspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const VIDEO_RATIOS: EcommerceListingVideoAspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const IMAGE_RESOLUTIONS: EcommerceListingImageResolution[] = ["1K", "2K", "4K"];
const VIDEO_MODELS: { value: EcommerceListingVideoModel; label: string; icon: ReactNode }[] = [
  { value: "seedance_2_fast", label: "Seedance 2 Fast", icon: <ByteDance className="h-4 w-4" /> },
  { value: "seedance_2", label: "Seedance 2", icon: <ByteDance className="h-4 w-4" /> },
];
const VIDEO_RESOLUTIONS_BY_MODEL: Record<EcommerceListingVideoModel, EcommerceListingVideoResolution[]> = {
  seedance_2_fast: ["480p", "720p"],
  seedance_2: ["480p", "720p", "1080p"],
};
const ALL_SCOPES: EcommerceListingAssetScope[] = ["carousel", "detail", "video"];
const ASSET_SCOPE_OPTIONS: { scope: EcommerceListingAssetScope; label: string; helper: string }[] = [
  { scope: "carousel", label: "Carousel", helper: "6 images" },
  { scope: "detail", label: "Detail", helper: "6 images" },
  { scope: "video", label: "Video", helper: "15s" },
];

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function initialProductPhotos(): ProductPhoto[] {
  return [
    { view: "front", label: "Front View", helper: "Required primary product angle.", dataUrl: null, fileName: null, required: true },
    { view: "side", label: "Side View", helper: "Optional depth and shape reference.", dataUrl: null, fileName: null },
    { view: "back", label: "Back View", helper: "Optional rear and detail reference.", dataUrl: null, fileName: null },
  ];
}

function imageAspectClass(ratio: EcommerceListingImageAspectRatio | EcommerceListingVideoAspectRatio) {
  if (ratio === "16:9") return "aspect-[16/9]";
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "4:3") return "aspect-[4/3]";
  if (ratio === "3:4") return "aspect-[3/4]";
  return "aspect-square";
}

function terminalJob(job: ToolGenerationJob | null) {
  return job?.status === "completed" || job?.status === "failed";
}

function progressLabel(job: ToolGenerationJob | null, metadata: EcommerceListingMetadata) {
  if (!job) return "";
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return "Failed";
  if (job.status === "uploading") return "Uploading product photos";
  if (job.status === "generating_video") return "Generating product video";
  const completed = metadata.completed_outputs ?? 0;
  const total = metadata.total_outputs ?? 0;
  return total > 0 ? `Generating ${completed}/${total}` : "Preparing generation";
}

function statusBadgeClass(status?: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "fail") return "border-red-200 bg-red-50 text-red-700";
  if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#E5E5E5] bg-[#F7F7F7] text-[#666666]";
}

function statusLabel(status?: string) {
  if (status === "success") return "Ready";
  if (status === "fail") return "Failed";
  if (status === "processing") return "Generating";
  return "Queued";
}

export default function EcommerceListingStudioPage() {
  const { isLoading: isToolAccessLoading, hasUnlimitedAccess } = useToolUsageAccess();
  const primaryButtonClass = "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const [status, setStatus] = useState<PageStatus>("idle");
  const [productPhotos, setProductPhotos] = useState<ProductPhoto[]>(initialProductPhotos);
  const [readingView, setReadingView] = useState<ProductView | null>(null);
  const [customRequirements, setCustomRequirements] = useState("");
  const [textLanguage, setTextLanguage] = useState<EcommerceListingTextLanguage>("en");
  const [imageAspectRatio, setImageAspectRatio] = useState<EcommerceListingImageAspectRatio>("1:1");
  const [imageResolution, setImageResolution] = useState<EcommerceListingImageResolution>("1K");
  const [videoModel, setVideoModel] = useState<EcommerceListingVideoModel>("seedance_2_fast");
  const [videoAspectRatio, setVideoAspectRatio] = useState<EcommerceListingVideoAspectRatio>("1:1");
  const [videoResolution, setVideoResolution] = useState<EcommerceListingVideoResolution>("480p");
  const [assetScopes, setAssetScopes] = useState<EcommerceListingAssetScope[]>(ALL_SCOPES);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ToolGenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const inputRefs = {
    front: useRef<HTMLInputElement | null>(null),
    side: useRef<HTMLInputElement | null>(null),
    back: useRef<HTMLInputElement | null>(null),
  };

  const { job } = useToolGenerationRealtime(jobId);
  const metadata = (currentJob?.metadata ?? {}) as EcommerceListingMetadata;
  const isBusy = status === "uploading" || status === "starting" || status === "processing";
  const frontPhoto = productPhotos.find((photo) => photo.view === "front");
  const canGenerate = Boolean(frontPhoto?.dataUrl) && assetScopes.length > 0 && !isBusy && !isToolAccessLoading;
  const creditCost = useMemo(
    () =>
      getEcommerceListingStudioCreditCost({
        carousel: assetScopes.includes("carousel"),
        detail: assetScopes.includes("detail"),
        video: assetScopes.includes("video"),
        videoModel,
        videoResolution,
      }),
    [assetScopes, videoModel, videoResolution]
  );

  const restoreJob = useCallback((nextJob: ToolGenerationJob) => {
    setCurrentJob(nextJob);
    setStatus(nextJob.status === "completed" ? "completed" : nextJob.status === "failed" ? "error" : "processing");
    if (!terminalJob(nextJob)) setJobId(nextJob.id);
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ jobId: nextJob.id }));
    } catch {}
  }, []);

  useEffect(() => {
    if (job) restoreJob(job);
  }, [job, restoreJob]);

  useEffect(() => {
    if (!VIDEO_RESOLUTIONS_BY_MODEL[videoModel].includes(videoResolution)) {
      setVideoResolution("720p");
    }
  }, [videoModel, videoResolution]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const saved = window.sessionStorage.getItem(SESSION_KEY);
        const savedJobId = saved ? (JSON.parse(saved) as { jobId?: string }).jobId : null;
        if (savedJobId) {
          setJobId(savedJobId);
          return;
        }
        const response = await fetch("/api/tools/jobs/latest?toolKey=ecommerce-listing-studio&maxAgeMinutes=180");
        if (!response.ok) return;
        const payload = (await response.json()) as { job?: ToolGenerationJob | null };
        if (!cancelled && payload.job) restoreJob(payload.job);
      } catch {
        // Best-effort recovery only.
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [restoreJob]);

  const validateAndReadDataUrl = useCallback(async (file: File): Promise<string> => {
    const formatCheck = validateImageFormat(file);
    if (!formatCheck.isValid) throw new Error(formatCheck.error);

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
      throw new Error(`Image too small. Minimum size is 300x300px. Your image is ${dimensions.width}x${dimensions.height}px.`);
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

    const requestSize = estimateDataUrlRequestSize(uploadFile.size, uploadFile.type || file.type || "image/jpeg");
    if (requestSize > VERCEL_FUNCTION_BODY_LIMIT_BYTES - REQUEST_SIZE_BUFFER_BYTES) {
      throw new Error("This image is still too large after optimization. Please use a smaller image.");
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(uploadFile);
    });
  }, []);

  async function handlePhotoUpload(view: ProductView, file: File) {
    setReadingView(view);
    setStatus("uploading");
    setError(null);
    try {
      const dataUrl = await validateAndReadDataUrl(file);
      setProductPhotos((photos) =>
        photos.map((photo) => (photo.view === view ? { ...photo, dataUrl, fileName: file.name } : photo))
      );
      setCurrentJob(null);
      setJobId(null);
      setStatus("idle");
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to process image.");
      setStatus("error");
    } finally {
      setReadingView(null);
      if (inputRefs[view].current) inputRefs[view].current.value = "";
    }
  }

  function removePhoto(view: ProductView) {
    setProductPhotos((photos) =>
      photos.map((photo) => (photo.view === view ? { ...photo, dataUrl: null, fileName: null } : photo))
    );
    setCurrentJob(null);
    setJobId(null);
    setStatus("idle");
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  function toggleScope(scope: EcommerceListingAssetScope) {
    if (isBusy) return;
    setAssetScopes((current) => {
      if (current.includes(scope)) {
        return current.length === 1 ? current : current.filter((item) => item !== scope);
      }
      return ALL_SCOPES.filter((item) => item === scope || current.includes(item));
    });
  }

  async function startGeneration() {
    const productPhotoDataUrls = productPhotos
      .filter((photo) => photo.dataUrl)
      .map((photo) => photo.dataUrl!);
    if (!productPhotoDataUrls.length) {
      setError("Upload a front product photo first.");
      return;
    }
    setStatus("starting");
    setError(null);
    setCurrentJob(null);
    setJobId(null);
    setManualCopyUrl(null);

    try {
      if (isToolAccessLoading) throw new Error("Checking subscription status. Please try again in a moment.");
      if (!hasUnlimitedAccess) throw new Error("An active subscription is required to use this generation tool.");

      const response = await fetch("/api/tools/ecommerce-listing-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productPhotoDataUrls,
          customRequirements,
          textLanguage,
          imageAspectRatio,
          imageResolution,
          videoModel,
          videoAspectRatio,
          videoResolution,
          assetScopes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to start generation.");
      setJobId(payload.jobId);
      setStatus("processing");
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ jobId: payload.jobId }));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start generation.");
      setStatus("error");
    }
  }

  function resetTool() {
    setStatus("idle");
    setProductPhotos(initialProductPhotos());
    setCurrentJob(null);
    setJobId(null);
    setError(null);
    setCopiedUrl(null);
    setManualCopyUrl(null);
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  async function copyUrl(url: string) {
    const copyWithTextarea = () => {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("Copy command was blocked.");
    };

    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else copyWithTextarea();
      setCopiedUrl(url);
      setManualCopyUrl(null);
      setTimeout(() => setCopiedUrl(null), 1200);
    } catch {
      try {
        copyWithTextarea();
        setCopiedUrl(url);
        setManualCopyUrl(null);
        setTimeout(() => setCopiedUrl(null), 1200);
      } catch {
        setManualCopyUrl(url);
      }
    }
  }

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:py-20">
          <div className="mb-8 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-5xl">
              Ecommerce Listing Studio
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[#666666]">
              Generate marketplace listing images, detail images, and product ad videos from product photos for Temu-style ecommerce workflows.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-black">Product References</h2>
                    <p className="mt-1 text-sm text-[#666666]">Upload a front view and optional side/back views for better product accuracy.</p>
                  </div>
                  {currentJob ? (
                    <button type="button" onClick={resetTool} className={`${secondaryButtonClass} justify-center`}>
                      New Listing
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {productPhotos.map((photo) => (
                    <PhotoUploadCard
                      key={photo.view}
                      photo={photo}
                      inputRef={inputRefs[photo.view]}
                      isBusy={isBusy}
                      isLoading={readingView === photo.view}
                      onFile={(file) => void handlePhotoUpload(photo.view, file)}
                      onRemove={() => removePhoto(photo.view)}
                    />
                  ))}
                </div>
              </div>

              <ResultsPanel
                job={currentJob}
                metadata={metadata}
                imageAspectRatio={metadata.image_aspect_ratio ?? imageAspectRatio}
                videoAspectRatio={metadata.video_aspect_ratio ?? videoAspectRatio}
                primaryButtonClass={primaryButtonClass}
                secondaryButtonClass={secondaryButtonClass}
                copiedUrl={copiedUrl}
                manualCopyUrl={manualCopyUrl}
                onCopy={copyUrl}
              />
            </section>

            <aside className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] lg:sticky lg:top-5 lg:self-start">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-black">Generation Settings</h2>
                <p className="mt-1 text-xs leading-5 text-[#666666]">Choose language, formats, and assets.</p>
              </div>
              <div className="space-y-4">
                <SettingsGroup icon={<Languages className="h-4 w-4" />} label="Language">
                  <SettingSelect
                    value={textLanguage}
                    disabled={isBusy}
                    onValueChange={(value) => setTextLanguage(value as EcommerceListingTextLanguage)}
                    options={[
                      { value: "en", label: "English" },
                      { value: "zh", label: "中文" },
                    ]}
                  />
                </SettingsGroup>

                <SettingsGroup icon={<Monitor className="h-4 w-4" />} label="Image Format">
                  <div className="grid grid-cols-2 gap-2">
                    <SettingSelect
                      value={imageAspectRatio}
                      disabled={isBusy}
                      onValueChange={(value) => setImageAspectRatio(value as EcommerceListingImageAspectRatio)}
                      options={IMAGE_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))}
                    />
                    <SettingSelect
                      value={imageResolution}
                      disabled={isBusy}
                      onValueChange={(value) => setImageResolution(value as EcommerceListingImageResolution)}
                      options={IMAGE_RESOLUTIONS.map((resolution) => ({ value: resolution, label: resolution }))}
                    />
                  </div>
                </SettingsGroup>

                <SettingsGroup icon={<Film className="h-4 w-4" />} label="Video Format">
                  <SettingSelect
                    value={videoModel}
                    disabled={isBusy}
                    onValueChange={(value) => setVideoModel(value as EcommerceListingVideoModel)}
                    options={VIDEO_MODELS}
                    leadingIcon={VIDEO_MODELS.find((model) => model.value === videoModel)?.icon}
                  />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <SettingSelect
                      value={videoAspectRatio}
                      disabled={isBusy}
                      onValueChange={(value) => setVideoAspectRatio(value as EcommerceListingVideoAspectRatio)}
                      options={VIDEO_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))}
                    />
                    <SettingSelect
                      value={videoResolution}
                      disabled={isBusy}
                      onValueChange={(value) => setVideoResolution(value as EcommerceListingVideoResolution)}
                      options={VIDEO_RESOLUTIONS_BY_MODEL[videoModel].map((resolution) => ({ value: resolution, label: resolution }))}
                    />
                    <div className="flex h-9 items-center justify-center rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-medium text-[#666666]">
                      15s
                    </div>
                  </div>
                </SettingsGroup>

                <SettingsGroup icon={<Settings2 className="h-4 w-4" />} label="Assets to Generate">
                  <div className="grid grid-cols-3 gap-2">
                    {ASSET_SCOPE_OPTIONS.map((item) => {
                      const active = assetScopes.includes(item.scope);
                      return (
                        <button
                          key={item.scope}
                          type="button"
                          disabled={isBusy}
                          onClick={() => toggleScope(item.scope)}
                          className={`rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-50 ${
                            active ? "border-black bg-white text-black" : "border-[#E5E5E5] bg-white text-[#666666] hover:border-black"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${active ? "border-black bg-black" : "border-[#D6D6D6] bg-white"}`}>
                              {active ? <Check className="h-3 w-3 text-white" /> : null}
                            </span>
                            {item.label}
                          </span>
                          <span className="mt-0.5 block pl-5 text-[11px] text-[#777777]">{item.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </SettingsGroup>

                <SettingsGroup icon={<PackageSearch className="h-4 w-4" />} label="Custom Requirements">
                  <textarea
                    value={customRequirements}
                    onChange={(event) => setCustomRequirements(event.target.value)}
                    disabled={isBusy}
                    placeholder="Optional: keep the style minimal, avoid on-image text, emphasize material quality..."
                    className="min-h-20 w-full resize-y rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm leading-5 text-black outline-none placeholder:text-[#999999] focus:border-black disabled:opacity-50"
                  />
                </SettingsGroup>
              </div>

              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void startGeneration()}
                className={`${primaryButtonClass} mt-5 w-full justify-center ${!canGenerate ? "opacity-50" : ""}`}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Listing Assets
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-4 w-4" />
                      {creditCost}
                    </span>
                  </>
                )}
              </button>

              {currentJob ? (
                <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#666666]">
                  {progressLabel(currentJob, metadata)}
                </div>
              ) : null}

              {error ? (
                <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function SettingSelect({
  value,
  options,
  disabled,
  leadingIcon,
  onValueChange,
}: {
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  disabled?: boolean;
  leadingIcon?: ReactNode;
  onValueChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "group/select flex min-h-9 w-full items-center justify-between gap-3 rounded-lg border border-[#E3E3E3] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFAFA_100%)] px-3 py-1.5 text-left text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(0,0,0,0.04)]",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-[#C9C9C9] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_18px_rgba(0,0,0,0.07)]",
          "outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7D7D7]",
          isOpen && "border-[#BDBDBD] shadow-[0_0_0_3px_rgba(0,0,0,0.035),0_12px_26px_rgba(0,0,0,0.10)]",
          "motion-reduce:transition-none"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leadingIcon ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#ECECEC] bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {leadingIcon}
            </span>
          ) : null}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#666666] transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-xl border border-[#DCDCDC] bg-white/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.16)] backdrop-blur-xl",
            "animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none"
          )}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-black outline-none transition-colors duration-150 hover:bg-[#F2F2F2] focus:bg-[#F2F2F2] motion-reduce:transition-none"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.icon ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#ECECEC] bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      {option.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-black" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SettingsGroup({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666666]">
        {icon}
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PhotoUploadCard({
  photo,
  inputRef,
  isBusy,
  isLoading,
  onFile,
  onRemove,
}: {
  photo: ProductPhoto;
  inputRef: RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  isLoading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-black">{photo.label}</h3>
          <p className="mt-0.5 text-xs text-[#666666]">{photo.helper}</p>
        </div>
        {photo.required ? <span className="rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#666666]">Required</span> : null}
      </div>
      <label className={`group relative block cursor-pointer overflow-hidden rounded-lg border border-dashed border-[#BEBEBE] bg-white ${isBusy ? "pointer-events-none opacity-60" : "hover:border-black"}`}>
        {photo.dataUrl ? (
          <Image src={photo.dataUrl} alt={photo.label} width={420} height={420} className="aspect-square w-full object-contain" unoptimized />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-black" /> : <Upload className="h-5 w-5 text-black" />}
            <span className="text-xs font-medium text-black">Upload</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={getAcceptedImageFormats()}
          disabled={isBusy}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      {photo.dataUrl && !isBusy ? (
        <button type="button" onClick={onRemove} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#666666] hover:text-black">
          <X className="h-3.5 w-3.5" />
          Remove
        </button>
      ) : null}
    </div>
  );
}

function ResultsPanel({
  job,
  metadata,
  imageAspectRatio,
  videoAspectRatio,
  primaryButtonClass,
  secondaryButtonClass,
  copiedUrl,
  manualCopyUrl,
  onCopy,
}: {
  job: ToolGenerationJob | null;
  metadata: EcommerceListingMetadata;
  imageAspectRatio: EcommerceListingImageAspectRatio;
  videoAspectRatio: EcommerceListingVideoAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  manualCopyUrl: string | null;
  onCopy: (url: string) => void;
}) {
  const carousel = metadata.carousel_images ?? [];
  const detail = metadata.detail_images ?? [];
  const video = metadata.video;
  const hasResult = carousel.length > 0 || detail.length > 0 || Boolean(video) || Boolean(job);

  if (!hasResult) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-8 text-center">
        <ImageIcon className="mx-auto h-8 w-8 text-[#CCCCCC]" />
        <h2 className="mt-3 text-base font-semibold text-black">Generated assets will appear here</h2>
        <p className="mt-1 text-sm text-[#666666]">Upload product photos and start generation to create listing assets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AssetSection title="Carousel Images" subtitle="Marketplace listing visuals" slots={carousel} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} />
      <AssetSection title="Detail Images" subtitle="Benefit, material, usage, and trust visuals" slots={detail} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} />
      <VideoSection video={video} aspectRatio={videoAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} />
      {manualCopyUrl ? (
        <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#666666]">
          <p className="mb-1">Browser blocked clipboard access. Select and copy this URL:</p>
          <input readOnly value={manualCopyUrl} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-md border border-[#E5E5E5] bg-[#F8F8F8] px-2 py-1 font-mono text-[11px] text-black" />
        </div>
      ) : null}
    </div>
  );
}

function AssetSection({
  title,
  subtitle,
  slots,
  aspectRatio,
  primaryButtonClass,
  secondaryButtonClass,
  copiedUrl,
  onCopy,
}: {
  title: string;
  subtitle: string;
  slots: EcommerceListingImageSlot[];
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-black">{title}</h2>
          <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
        </div>
        <span className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1 text-xs font-mono text-[#666666]">
          {slots.filter((slot) => slot.status === "success" || slot.status === "fail").length}/{slots.length}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slot) => (
          <ResultCard key={slot.id} slot={slot} aspectRatio={aspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  slot,
  aspectRatio,
  primaryButtonClass,
  secondaryButtonClass,
  copiedUrl,
  onCopy,
}: {
  slot: EcommerceListingImageSlot;
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
}) {
  return (
    <article className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-2">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className="truncate text-sm font-semibold text-black">{slot.title}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(slot.status)}`}>
          {statusLabel(slot.status)}
        </span>
      </div>
      {slot.resultUrl ? (
        <Image src={slot.resultUrl} alt={slot.title} width={520} height={520} className={`${imageAspectClass(aspectRatio)} w-full rounded-lg border border-[#E5E5E5] bg-white object-cover`} unoptimized />
      ) : slot.status === "fail" ? (
        <div className={`${imageAspectClass(aspectRatio)} flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700`}>
          {slot.error || "Generation failed"}
        </div>
      ) : (
        <div className={`${imageAspectClass(aspectRatio)} relative flex items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8] text-xs text-[#888888]`}>
          {slot.status === "processing" ? <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%]" /> : null}
          <span className="relative z-10">{statusLabel(slot.status)}</span>
        </div>
      )}
      {slot.resultUrl ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => onCopy(slot.resultUrl!)} className={`${primaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Copy image URL">
            {copiedUrl === slot.resultUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <a href={slot.resultUrl} download={`${slot.id}.png`} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Download image">
            <Download className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </article>
  );
}

function VideoSection({
  video,
  aspectRatio,
  primaryButtonClass,
  secondaryButtonClass,
  copiedUrl,
  onCopy,
}: {
  video: EcommerceListingMetadata["video"];
  aspectRatio: EcommerceListingVideoAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
}) {
  if (!video) return null;
  return (
    <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-black">Product Ad Video</h2>
          <p className="mt-1 text-sm text-[#666666]">Storyboard-driven 15-second ecommerce short video.</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(video.status)}`}>
          {statusLabel(video.status)}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-2">
          {video.resultUrl ? (
            <video src={video.resultUrl} controls className={`${imageAspectClass(aspectRatio)} w-full rounded-lg border border-[#E5E5E5] bg-black object-cover`} />
          ) : video.status === "fail" ? (
            <div className={`${imageAspectClass(aspectRatio)} flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700`}>
              {video.error || "Video generation failed"}
            </div>
          ) : (
            <div className={`${imageAspectClass(aspectRatio)} relative flex items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8] text-xs text-[#888888]`}>
              {video.status === "processing" ? <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%]" /> : null}
              <span className="relative z-10">{video.storyboardUrl ? "Generating video..." : "Generating storyboard..."}</span>
            </div>
          )}
          {video.resultUrl ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => onCopy(video.resultUrl!)} className={`${primaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Copy video URL">
                {copiedUrl === video.resultUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <a href={video.resultUrl} download="ecommerce-listing-video.mp4" target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Download video">
                <Download className="h-3 w-3" />
              </a>
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
          <h3 className="text-sm font-semibold text-black">Video Progress</h3>
          <div className="mt-4 space-y-3 text-sm text-[#666666]">
            <ProgressLine label="Creative storyboard" active={Boolean(video.storyboardUrl)} />
            <ProgressLine label="Final ad video" active={video.status === "success"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressLine({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-black bg-black text-white" : "border-[#D8D8D8] bg-white text-transparent"}`}>
        <Check className="h-3 w-3" />
      </span>
      <span className={active ? "text-black" : "text-[#666666]"}>{label}</span>
    </div>
  );
}
