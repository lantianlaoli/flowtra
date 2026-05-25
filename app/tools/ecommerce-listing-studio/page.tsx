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
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { ByteDance, Gemini } from "@lobehub/icons";
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
type ProductPhoto = { view: ProductView; label: string; dataUrl: string | null; fileName: string | null; required?: boolean };
type LocalReferenceImage = { id: string; fileName: string; dataUrl: string };

const SESSION_KEY = "flowtra:ecommerce-listing-studio";
const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;
const IMAGE_RATIOS: EcommerceListingImageAspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const VIDEO_RATIOS: EcommerceListingVideoAspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const IMAGE_RESOLUTIONS: EcommerceListingImageResolution[] = ["1K", "2K", "4K"];
const DEFAULT_VIDEO_MODEL: EcommerceListingVideoModel = "gemini_omni_video";
const VIDEO_MODEL_OPTIONS: Array<{ value: EcommerceListingVideoModel; label: string; icon: ReactNode }> = [
  { value: "gemini_omni_video", label: "Gemini Omni", icon: <Gemini className="h-4 w-4 text-black" /> },
  { value: "seedance_2_fast", label: "Seedance 2 Fast", icon: <ByteDance className="h-4 w-4 text-black" /> },
  { value: "seedance_2", label: "Seedance 2", icon: <ByteDance className="h-4 w-4 text-black" /> },
];
const ALL_SCOPES: EcommerceListingAssetScope[] = ["carousel", "detail", "video"];
const ASSET_SCOPE_OPTIONS: { scope: EcommerceListingAssetScope; label: string }[] = [
  { scope: "carousel", label: "Carousel" },
  { scope: "detail", label: "Detail" },
  { scope: "video", label: "Video" },
];
const TEXT_LANGUAGE_OPTIONS: Array<{ value: EcommerceListingTextLanguage; label: string; group: string }> = [
  { value: "en", label: "English", group: "NA" },
  { value: "fr", label: "Français", group: "EU" },
  { value: "de", label: "Deutsch", group: "EU" },
  { value: "es", label: "Español", group: "EU" },
  { value: "pt", label: "Português", group: "EU" },
  { value: "it", label: "Italiano", group: "EU" },
  { value: "zh", label: "中文", group: "AS" },
  { value: "ja", label: "日本語", group: "AS" },
  { value: "ko", label: "한국어", group: "AS" },
  { value: "ar", label: "العربية", group: "MEA" },
  { value: "he", label: "עברית", group: "MEA" },
  { value: "ru", label: "Cyrillic (Russian etc.)", group: "EU" },
  { value: "hi", label: "हिन्दी", group: "AS" },
];

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function initialProductPhotos(): ProductPhoto[] {
  return [
    { view: "front", label: "Front View", dataUrl: null, fileName: null, required: true },
    { view: "side", label: "Side View", dataUrl: null, fileName: null },
    { view: "back", label: "Back View", dataUrl: null, fileName: null },
  ];
}

function imageAspectClass(ratio: EcommerceListingImageAspectRatio | EcommerceListingVideoAspectRatio) {
  if (ratio === "16:9") return "aspect-[16/9]";
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "4:3") return "aspect-[4/3]";
  if (ratio === "3:4") return "aspect-[3/4]";
  return "aspect-square";
}

function videoRatioOptionsForModel(videoModel: EcommerceListingVideoModel): EcommerceListingVideoAspectRatio[] {
  return videoModel === "gemini_omni_video" ? ["9:16", "16:9"] : VIDEO_RATIOS;
}

function videoResolutionOptionsForModel(videoModel: EcommerceListingVideoModel): EcommerceListingVideoResolution[] {
  if (videoModel === "gemini_omni_video") return ["720p", "1080p", "4k"];
  if (videoModel === "seedance_2") return ["480p", "720p", "1080p"];
  return ["480p", "720p"];
}

function terminalJob(job: ToolGenerationJob | null) {
  return job?.status === "completed" || job?.status === "failed";
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
  const [videoModel, setVideoModel] = useState<EcommerceListingVideoModel>(DEFAULT_VIDEO_MODEL);
  const [videoAspectRatio, setVideoAspectRatio] = useState<EcommerceListingVideoAspectRatio>("9:16");
  const [videoResolution, setVideoResolution] = useState<EcommerceListingVideoResolution>("720p");
  const [assetScopes, setAssetScopes] = useState<EcommerceListingAssetScope[]>(ALL_SCOPES);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ToolGenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const [regenerateSlot, setRegenerateSlot] = useState<EcommerceListingImageSlot | null>(null);
  const [regenerateText, setRegenerateText] = useState("");
  const [regenerateImages, setRegenerateImages] = useState<LocalReferenceImage[]>([]);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
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
  const videoRatioOptions = useMemo(() => videoRatioOptionsForModel(videoModel), [videoModel]);
  const videoResolutionOptions = useMemo(() => videoResolutionOptionsForModel(videoModel), [videoModel]);

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
    const ratioOptions = videoRatioOptionsForModel(videoModel);
    if (!ratioOptions.includes(videoAspectRatio)) setVideoAspectRatio(ratioOptions[0]);

    const resolutionOptions = videoResolutionOptionsForModel(videoModel);
    if (!resolutionOptions.includes(videoResolution)) setVideoResolution(resolutionOptions[0]);
  }, [videoAspectRatio, videoModel, videoResolution]);

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

  function openRegenerateModal(slot: EcommerceListingImageSlot) {
    setRegenerateSlot(slot);
    setRegenerateText("");
    setRegenerateImages([]);
    setRegenerateError(null);
  }

  async function handleRegenerateImageUpload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (regenerateImages.length + selected.length > 4) {
      setRegenerateError("Upload up to 4 reference images.");
      return;
    }
    try {
      const images = await Promise.all(
        selected.map(async (file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          fileName: file.name,
          dataUrl: await validateAndReadDataUrl(file),
        }))
      );
      setRegenerateImages((current) => [...current, ...images].slice(0, 4));
      setRegenerateError(null);
    } catch (uploadError) {
      setRegenerateError(uploadError instanceof Error ? uploadError.message : "Failed to process reference image.");
    }
  }

  async function submitRegeneration() {
    if (!currentJob || !regenerateSlot?.resultUrl) return;
    if (!regenerateText.trim() && regenerateImages.length === 0) {
      setRegenerateError("Describe the edit or upload a reference image.");
      return;
    }

    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      const response = await fetch("/api/tools/ecommerce-listing-studio/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJob.id,
          slotId: regenerateSlot.id,
          resultUrl: regenerateSlot.resultUrl,
          refinement: regenerateText.trim(),
          localImages: regenerateImages.map((image) => ({ fileName: image.fileName, dataUrl: image.dataUrl })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to start image edit.");
      if (payload.job) restoreJob(payload.job);
      setJobId(payload.jobId || currentJob.id);
      setStatus("processing");
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ jobId: payload.jobId || currentJob.id }));
      setRegenerateSlot(null);
      setRegenerateText("");
      setRegenerateImages([]);
    } catch (regenerateFailure) {
      setRegenerateError(regenerateFailure instanceof Error ? regenerateFailure.message : "Failed to start image edit.");
    } finally {
      setIsRegenerating(false);
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
    setRegenerateSlot(null);
    setRegenerateText("");
    setRegenerateImages([]);
    setRegenerateError(null);
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
                onRegenerate={openRegenerateModal}
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
                    options={TEXT_LANGUAGE_OPTIONS}
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
                    options={VIDEO_MODEL_OPTIONS}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <SettingSelect
                      value={videoAspectRatio}
                      disabled={isBusy}
                      onValueChange={(value) => setVideoAspectRatio(value as EcommerceListingVideoAspectRatio)}
                      options={videoRatioOptions.map((ratio) => ({ value: ratio, label: ratio }))}
                    />
                    <SettingSelect
                      value={videoResolution}
                      disabled={isBusy}
                      onValueChange={(value) => setVideoResolution(value as EcommerceListingVideoResolution)}
                      options={videoResolutionOptions.map((resolution) => ({ value: resolution, label: resolution }))}
                    />
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
      {regenerateSlot ? (
        <RegenerateImageModal
          slot={regenerateSlot}
          images={regenerateImages}
          refinement={regenerateText}
          error={regenerateError}
          isRegenerating={isRegenerating}
          onClose={() => {
            if (isRegenerating) return;
            setRegenerateSlot(null);
          }}
          onRefinementChange={setRegenerateText}
          onImageUpload={(files) => void handleRegenerateImageUpload(files)}
          onRemoveImage={(id) => setRegenerateImages((current) => current.filter((image) => image.id !== id))}
          onSubmit={() => void submitRegeneration()}
        />
      ) : null}
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
  options: { value: string; label: string; icon?: ReactNode; group?: string }[];
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
            "absolute left-0 right-0 top-full z-[100] mt-1 max-h-[min(360px,calc(100vh-180px))] overflow-y-auto overscroll-contain rounded-xl border border-[#DCDCDC] bg-white/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.16)] backdrop-blur-xl",
            "animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none"
          )}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const showGroup = option.group && option.group !== options[index - 1]?.group;
            return (
              <div key={option.value}>
                {showGroup ? (
                  <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888888] first:pt-1">
                    {option.group}
                  </div>
                ) : null}
                <button
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
              </div>
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
  onRegenerate,
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
  onRegenerate: (slot: EcommerceListingImageSlot) => void;
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
      <AssetSection title="Carousel Images" subtitle="Marketplace listing visuals" slots={carousel} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRegenerate={onRegenerate} />
      <AssetSection title="Detail Images" subtitle="Benefit, material, usage, and trust visuals" slots={detail} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRegenerate={onRegenerate} />
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
  onRegenerate,
}: {
  title: string;
  subtitle: string;
  slots: EcommerceListingImageSlot[];
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRegenerate: (slot: EcommerceListingImageSlot) => void;
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
          <ResultCard key={slot.id} slot={slot} aspectRatio={aspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRegenerate={onRegenerate} />
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
  onRegenerate,
}: {
  slot: EcommerceListingImageSlot;
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRegenerate: (slot: EcommerceListingImageSlot) => void;
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
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => onRegenerate(slot)} className={`${secondaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Edit image">
            <RefreshCw className="h-3 w-3" />
            <span>Edit</span>
          </button>
          <button type="button" onClick={() => onCopy(slot.resultUrl!)} className={`${primaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Copy image URL">
            {copiedUrl === slot.resultUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copiedUrl === slot.resultUrl ? "Copied" : "Copy"}</span>
          </button>
          <a href={slot.resultUrl} download={`${slot.id}.png`} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Download image">
            <Download className="h-3 w-3" />
            <span>Download</span>
          </a>
        </div>
      ) : null}
    </article>
  );
}

function RegenerateImageModal({
  slot,
  images,
  refinement,
  error,
  isRegenerating,
  onClose,
  onRefinementChange,
  onImageUpload,
  onRemoveImage,
  onSubmit,
}: {
  slot: EcommerceListingImageSlot;
  images: LocalReferenceImage[];
  refinement: string;
  error: string | null;
  isRegenerating: boolean;
  onClose: () => void;
  onRefinementChange: (value: string) => void;
  onImageUpload: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-black">Edit Image</h2>
            <p className="mt-1 text-xs text-[#666666]">{slot.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRegenerating}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#666666] transition hover:border-black hover:text-black disabled:opacity-50"
            aria-label="Close image editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="border-b border-[#E5E5E5] bg-[#FAFAFA] p-4 md:border-b-0 md:border-r">
            {slot.resultUrl ? (
              <Image
                src={slot.resultUrl}
                alt={slot.title}
                width={640}
                height={640}
                className="max-h-[420px] w-full rounded-xl border border-[#E5E5E5] bg-white object-contain"
                unoptimized
              />
            ) : null}
          </div>

          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#666666]">
                Edit Request
              </label>
              <textarea
                value={refinement}
                onChange={(event) => onRefinementChange(event.target.value)}
                rows={5}
                disabled={isRegenerating}
                placeholder="Describe what should change, for example: make the background brighter, remove extra text, emphasize the material texture..."
                className="w-full resize-none rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm leading-6 text-black outline-none placeholder:text-[#999999] focus:border-black disabled:opacity-50"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#666666]">
                  Reference Images
                </label>
                <span className="text-xs text-[#999999]">{images.length}/4</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <label
                  className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#BEBEBE] bg-[#FAFAFA] text-[#666666] transition hover:border-black hover:text-black ${
                    isRegenerating || images.length >= 4 ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <Plus className="h-5 w-5" />
                  <input
                    type="file"
                    accept={getAcceptedImageFormats()}
                    multiple
                    disabled={isRegenerating || images.length >= 4}
                    className="sr-only"
                    onChange={(event) => {
                      onImageUpload(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {images.map((image) => (
                  <div key={image.id} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                    <Image src={image.dataUrl} alt="" width={96} height={96} className="h-full w-full object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(image.id)}
                      disabled={isRegenerating}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
                      aria-label="Remove reference image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={isRegenerating || (!refinement.trim() && images.length === 0)}
              className="landing-press-button landing-press-button--compact h-10 w-full justify-center text-sm font-medium disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Image
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
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
          <p className="mt-1 text-sm text-[#666666]">Storyboard-driven 10-second ecommerce short video.</p>
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
                <span>{copiedUrl === video.resultUrl ? "Copied" : "Copy"}</span>
              </button>
              <a href={video.resultUrl} download="ecommerce-listing-video.mp4" target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-[11px]`} aria-label="Download video">
                <Download className="h-3 w-3" />
                <span>Download</span>
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
