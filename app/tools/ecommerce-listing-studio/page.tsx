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
  HelpCircle,
  Image as ImageIcon,
  Languages,
  Loader2,
  Megaphone,
  Monitor,
  Package,
  PawPrint,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Stamp,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ByteDance, Gemini } from "@lobehub/icons";
import ToolPageShell from "@/components/tools/ToolPageShell";
import CreatePetModal from "@/components/CreatePetModal";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { cn } from "@/lib/utils";
import { useToolUsageAccess } from "@/lib/tools/use-tool-usage-access";
import { useToolGenerationRealtime } from "@/lib/tools/use-tool-generation-realtime";
import { getToolCreditBalanceHeroState, useToolCreditBalance } from "@/lib/tools/use-tool-credit-balance";
import {
  IMAGE_GENERATION_CREDIT_COST,
  getEcommerceListingStudioCreditCost,
} from "@/lib/tools/billing-constants";
import type { ToolGenerationJob } from "@/lib/tools/job-store";
import type { UserPet } from "@/lib/supabase";
import type {
  EcommerceListingAssetScope,
  EcommerceListingCategory,
  EcommerceListingImageAspectRatio,
  EcommerceListingImageResolution,
  EcommerceListingImageSlot,
  EcommerceListingLogoCorner,
  EcommerceListingMetadata,
  EcommerceListingSourceMode,
  EcommerceListingTextLanguage,
  EcommerceListingVideoAspectRatio,
  EcommerceListingVideoModel,
  EcommerceListingVideoResolution,
} from "@/lib/tools/ecommerce-listing-studio";

type ProductView = "front" | "side" | "back";
type PageStatus = "idle" | "uploading" | "starting" | "processing" | "completed" | "error";
type ProductPhoto = { view: ProductView; label: string; dataUrl: string | null; fileName: string | null; required?: boolean };
type LocalUploadImage = { id: string; fileName: string; dataUrl: string };
type LocalReferenceImage = { id: string; fileName: string; dataUrl: string };
type QuickPhrase = { id: string; text: string };

const SESSION_KEY = "flowtra:ecommerce-listing-studio";
const QUICK_PHRASES_STORAGE_KEY = "flowtra:ecommerce-listing-studio:quick-phrases";
const MAX_QUICK_PHRASE_LENGTH = 300;
const MAX_SOURCE_IMAGE_COUNT = 6;
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
const ASSET_SCOPE_OPTIONS: { scope: EcommerceListingAssetScope; label: string; icon: ReactNode; description: string }[] = [
  { scope: "carousel", label: "Carousel", icon: <ImageIcon className="h-4 w-4" />, description: "Marketplace listing visuals" },
  { scope: "detail", label: "Detail", icon: <Sparkles className="h-4 w-4" />, description: "Benefit, material, usage, and trust visuals" },
  { scope: "video", label: "Video", icon: <Film className="h-4 w-4" />, description: "Product ad video" },
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
const DEFAULT_QUICK_PHRASES: QuickPhrase[] = [
  { id: "minimal-premium", text: "Minimal premium style" },
  { id: "avoid-dense-text", text: "Avoid dense text" },
  { id: "material-texture", text: "Emphasize material texture" },
  { id: "clean-marketplace", text: "Clean marketplace-ready composition" },
];

function normalizeQuickPhraseText(text: string) {
  return text.trim().slice(0, MAX_QUICK_PHRASE_LENGTH);
}

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
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

function userFriendlyError(error?: string): string {
  if (!error) return "Generation failed, please try again";
  if (error.includes("PUBLIC_ERROR_UNSAFE_GENERATION") || error.includes("UNSAFE")) {
    return "Generation failed, please try again";
  }
  return "Generation failed, please try again";
}

export default function EcommerceListingStudioPage() {
  const { isLoading: isToolAccessLoading, hasUnlimitedAccess } = useToolUsageAccess();
  const creditBalance = useToolCreditBalance();
  const heroCreditState = getToolCreditBalanceHeroState(creditBalance);
  const primaryButtonClass = "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const [status, setStatus] = useState<PageStatus>("idle");
  const [sourceMode, setSourceMode] = useState<EcommerceListingSourceMode>("product-photos");
  const [category, setCategory] = useState<EcommerceListingCategory>("general");
  const [uploadedImages, setUploadedImages] = useState<LocalUploadImage[]>([]);
  const [isReadingUploads, setIsReadingUploads] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickPhrases, setQuickPhrases] = useState<QuickPhrase[]>(DEFAULT_QUICK_PHRASES);
  const [quickPhraseDraft, setQuickPhraseDraft] = useState("");
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [isAddingPhrase, setIsAddingPhrase] = useState(false);
  const [customRequirements, setCustomRequirements] = useState("");
  const [textLanguage, setTextLanguage] = useState<EcommerceListingTextLanguage>("en");
  const [imageAspectRatio, setImageAspectRatio] = useState<EcommerceListingImageAspectRatio>("1:1");
  const [imageResolution, setImageResolution] = useState<EcommerceListingImageResolution>("1K");
  const [videoModel, setVideoModel] = useState<EcommerceListingVideoModel>(DEFAULT_VIDEO_MODEL);
  const [videoAspectRatio, setVideoAspectRatio] = useState<EcommerceListingVideoAspectRatio>("9:16");
  const [videoResolution, setVideoResolution] = useState<EcommerceListingVideoResolution>("720p");
  const [assetScopes, setAssetScopes] = useState<EcommerceListingAssetScope[]>(ALL_SCOPES);
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState<string | null>(null);
  const [brandLogoFileName, setBrandLogoFileName] = useState<string | null>(null);
  const [brandLogoCorner, setBrandLogoCorner] = useState<EcommerceListingLogoCorner>("top-left");
  const [isReadingBrandLogo, setIsReadingBrandLogo] = useState(false);
  const [savedPets, setSavedPets] = useState<UserPet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [showCreatePetModal, setShowCreatePetModal] = useState(false);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
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
  const [isRetryingVideo, setIsRetryingVideo] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
  const configPopoverRef = useRef<HTMLDivElement | null>(null);

  const { job } = useToolGenerationRealtime(jobId);
  const metadata = (currentJob?.metadata ?? {}) as EcommerceListingMetadata;
  const isBusy = status === "uploading" || status === "starting" || status === "processing";
  const uploadedImageCount = uploadedImages.length;
  const selectedPet = savedPets.find((pet) => pet.id === selectedPetId) ?? null;
  const petReady = Boolean(selectedPet);
  const isManufacturerMode = sourceMode === "manufacturer-promos";
  const petReplacementAvailable = category === "pet" && isManufacturerMode;
  const effectivePetReplacementEnabled = petReplacementAvailable && Boolean(selectedPet);
  const effectiveAssetScopes = isManufacturerMode ? (["carousel"] as EcommerceListingAssetScope[]) : assetScopes;
  const canGenerate =
    uploadedImageCount > 0 &&
    uploadedImageCount <= MAX_SOURCE_IMAGE_COUNT &&
    (!effectivePetReplacementEnabled || petReady) &&
    (isManufacturerMode || assetScopes.length > 0) &&
    !isBusy &&
    !isToolAccessLoading;
  const creditCost = useMemo(
    () =>
      isManufacturerMode
        ? uploadedImageCount * IMAGE_GENERATION_CREDIT_COST
        : getEcommerceListingStudioCreditCost({
            carousel: assetScopes.includes("carousel"),
            detail: assetScopes.includes("detail"),
            video: assetScopes.includes("video"),
            videoModel,
            videoResolution,
          }),
    [assetScopes, isManufacturerMode, uploadedImageCount, videoModel, videoResolution]
  );
  const videoRatioOptions = useMemo(() => videoRatioOptionsForModel(videoModel), [videoModel]);
  const videoResolutionOptions = useMemo(() => videoResolutionOptionsForModel(videoModel), [videoModel]);

  const restoreJob = useCallback((nextJob: ToolGenerationJob) => {
    setCurrentJob(nextJob);
    const nextMetadata = (nextJob.metadata ?? {}) as EcommerceListingMetadata;
    setSourceMode(nextMetadata.source_mode === "manufacturer-promos" ? "manufacturer-promos" : "product-photos");
    setCategory(nextMetadata.category === "pet" ? "pet" : "general");
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
    if (!settingsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!configPopoverRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUICK_PHRASES_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as QuickPhrase[];
      const valid = Array.isArray(parsed)
        ? parsed
            .filter((phrase) => typeof phrase?.id === "string" && typeof phrase?.text === "string" && phrase.text.trim())
            .map((phrase) => ({ ...phrase, text: normalizeQuickPhraseText(phrase.text) }))
        : [];
      if (valid.length > 0) setQuickPhrases(valid.slice(0, 12));
    } catch {
      // Browser-local preferences are optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUICK_PHRASES_STORAGE_KEY, JSON.stringify(quickPhrases));
    } catch {
      // Ignore storage failures in private browsing.
    }
  }, [quickPhrases]);

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

  useEffect(() => {
    let cancelled = false;
    const loadPets = async () => {
      try {
        const response = await fetch("/api/user-pets", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { pets?: UserPet[] };
        if (!cancelled) setSavedPets(Array.isArray(payload.pets) ? payload.pets : []);
      } catch {
        // Pet assets are optional for this flow.
      }
    };
    void loadPets();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function clearGeneratedJobState() {
    setCurrentJob(null);
    setJobId(null);
    setStatus("idle");
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  function changeSourceMode(nextMode: EcommerceListingSourceMode) {
    if (isBusy || sourceMode === nextMode) return;
    setSourceMode(nextMode);
    setError(null);
    if (nextMode === "manufacturer-promos") {
      setAssetScopes(["carousel"]);
    }
    clearGeneratedJobState();
  }

  function changeCategory(nextCategory: EcommerceListingCategory) {
    if (isBusy || category === nextCategory) return;
    setCategory(nextCategory);
    setError(null);
    clearGeneratedJobState();
  }

  async function handleUnifiedImageUpload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (uploadedImages.length + selected.length > MAX_SOURCE_IMAGE_COUNT) {
      setError(`Upload up to ${MAX_SOURCE_IMAGE_COUNT} images.`);
      return;
    }
    setIsReadingUploads(true);
    setStatus("uploading");
    setError(null);
    try {
      const images = await Promise.all(
        selected.map(async (file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          fileName: file.name,
          dataUrl: await validateAndReadDataUrl(file),
        }))
      );
      setUploadedImages((current) => [...current, ...images].slice(0, MAX_SOURCE_IMAGE_COUNT));
      clearGeneratedJobState();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to process image.");
      setStatus("error");
    } finally {
      setIsReadingUploads(false);
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((image) => image.id !== id));
    clearGeneratedJobState();
  }

  function applyQuickPhrase(text: string) {
    setCustomRequirements((current) => {
      const trimmed = text.trim();
      if (!trimmed) return current;
      if (!current.trim()) return trimmed;
      if (current.includes(trimmed)) return current;
      return `${current.trim()}\n${trimmed}`;
    });
  }

  function saveQuickPhrase() {
    const text = normalizeQuickPhraseText(quickPhraseDraft);
    if (!text) return;
    if (editingPhraseId) {
      setQuickPhrases((current) =>
        current.map((phrase) => (phrase.id === editingPhraseId ? { ...phrase, text } : phrase))
      );
    } else {
      setQuickPhrases((current) => [{ id: crypto.randomUUID(), text }, ...current].slice(0, 12));
    }
    setQuickPhraseDraft("");
    setEditingPhraseId(null);
    setIsAddingPhrase(false);
  }

  function startAddingPhrase() {
    setEditingPhraseId(null);
    setQuickPhraseDraft("");
    setIsAddingPhrase(true);
  }

  function cancelQuickPhraseEdit() {
    setQuickPhraseDraft("");
    setEditingPhraseId(null);
    setIsAddingPhrase(false);
  }

  function editQuickPhrase(phrase: QuickPhrase) {
    setIsAddingPhrase(false);
    setQuickPhraseDraft(normalizeQuickPhraseText(phrase.text));
    setEditingPhraseId(phrase.id);
  }

  function deleteQuickPhrase(id: string) {
    setQuickPhrases((current) => current.filter((phrase) => phrase.id !== id));
    if (editingPhraseId === id) {
      setEditingPhraseId(null);
      setQuickPhraseDraft("");
    }
  }

  function resetQuickPhrases() {
    setQuickPhrases(DEFAULT_QUICK_PHRASES);
    setQuickPhraseDraft("");
    setEditingPhraseId(null);
    setIsAddingPhrase(false);
  }

  async function handleBrandLogoUpload(file: File) {
    setIsReadingBrandLogo(true);
    setStatus("uploading");
    setError(null);
    try {
      const dataUrl = await validateAndReadDataUrl(file);
      setBrandLogoDataUrl(dataUrl);
      setBrandLogoFileName(file.name);
      clearGeneratedJobState();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to process brand logo.");
      setStatus("error");
    } finally {
      setIsReadingBrandLogo(false);
      if (brandLogoInputRef.current) brandLogoInputRef.current.value = "";
    }
  }

  function removeBrandLogo() {
    setBrandLogoDataUrl(null);
    setBrandLogoFileName(null);
    clearGeneratedJobState();
  }

  async function handlePetCreated(pet: UserPet) {
    setSavedPets((current) => [pet, ...current.filter((entry) => entry.id !== pet.id)]);
    setSelectedPetId(pet.id);
    clearGeneratedJobState();
  }

  async function handleDeletePet(petId: string) {
    if (deletingPetId) return;
    setDeletingPetId(petId);
    setError(null);
    try {
      const response = await fetch(`/api/user-pets?petId=${encodeURIComponent(petId)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to delete pet.");
      setSavedPets((current) => current.filter((pet) => pet.id !== petId));
      if (selectedPetId === petId) setSelectedPetId("");
      clearGeneratedJobState();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete pet.");
    } finally {
      setDeletingPetId(null);
    }
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
    const uploadedDataUrls = uploadedImages.map((image) => image.dataUrl);
    const productPhotoDataUrls = isManufacturerMode ? [] : uploadedDataUrls;
    const manufacturerPromoDataUrls = isManufacturerMode ? uploadedDataUrls : [];
    if (isManufacturerMode && !manufacturerPromoDataUrls.length) {
      setError("Upload at least one manufacturer promo image first.");
      return;
    }
    if (isManufacturerMode && effectivePetReplacementEnabled && !petReady) {
      setError("Pet replacement requires a saved pet asset. Save a new pet or select one from your saved pets.");
      return;
    }
    if (!isManufacturerMode && !productPhotoDataUrls.length) {
      setError("Upload at least one product photo first.");
      return;
    }
    if (uploadedDataUrls.length > MAX_SOURCE_IMAGE_COUNT) {
      setError(`Upload up to ${MAX_SOURCE_IMAGE_COUNT} images.`);
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
          sourceMode,
          category,
          productPhotoDataUrls,
          manufacturerPromoDataUrls,
          brandLogoEnabled: isManufacturerMode && Boolean(brandLogoDataUrl),
          brandLogoDataUrl: isManufacturerMode && brandLogoDataUrl ? brandLogoDataUrl : undefined,
          brandLogoCorner,
          petReplacementEnabled: effectivePetReplacementEnabled,
          petId: effectivePetReplacementEnabled && selectedPet ? selectedPet.id : undefined,
          customRequirements,
          textLanguage,
          imageAspectRatio,
          imageResolution,
          videoModel,
          videoAspectRatio,
          videoResolution,
          assetScopes: effectiveAssetScopes,
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
    setUploadedImages([]);
    setBrandLogoDataUrl(null);
    setBrandLogoFileName(null);
    setBrandLogoCorner("top-left");
    setSelectedPetId("");
    setCurrentJob(null);
    setJobId(null);
    setError(null);
    setCopiedUrl(null);
    setManualCopyUrl(null);
    setRegenerateSlot(null);
    setRegenerateText("");
    setRegenerateImages([]);
    setRegenerateError(null);
    setIsRetryingVideo(false);
    setPreviewImageUrl(null);
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  async function retryVideo() {
    if (!currentJob) return;
    setIsRetryingVideo(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/ecommerce-listing-studio/retry-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJob.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to retry video generation.");
      if (payload.job) restoreJob(payload.job);
      setJobId(payload.jobId || currentJob.id);
      setStatus("processing");
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ jobId: payload.jobId || currentJob.id }));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry video generation.");
    } finally {
      setIsRetryingVideo(false);
    }
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
      <ToolPageShell
        title="Ecommerce Listing Studio"
        description="Generate marketplace listing images, detail images, and product ad videos from product photos for Temu-style ecommerce workflows."
        statusLabel={heroCreditState.label}
        statusTone={heroCreditState.tone}
      >

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
            <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <AnimatedTogglePill
                    value={sourceMode}
                    disabled={isBusy}
                    onChange={(value) => changeSourceMode(value as EcommerceListingSourceMode)}
                    options={[
                      {
                        value: "product-photos" as const,
                        label: "Products",
                        icon: <Package className="h-3.5 w-3.5" />,
                        description: "Upload your own product photos. We'll generate marketplace listing images, detail images, and ad videos from them.",
                      },
                      {
                        value: "manufacturer-promos" as const,
                        label: "Redesign",
                        icon: <Megaphone className="h-3.5 w-3.5" />,
                        description: "Upload manufacturer promotional images. We'll redesign them into clean marketplace carousel layouts while preserving the product, packaging, and brand.",
                      },
                    ]}
                  />
                  <AnimatedTogglePill
                    value={category}
                    disabled={isBusy}
                    onChange={(value) => changeCategory(value as EcommerceListingCategory)}
                    options={[
                      { value: "general" as const, label: "General", icon: <Sparkles className="h-3.5 w-3.5" /> },
                      { value: "pet" as const, label: "Pet", icon: <PawPrint className="h-3.5 w-3.5" /> },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {currentJob ? (
                    <button type="button" onClick={resetTool} className={`${secondaryButtonClass} justify-center`}>
                      <RefreshCw className="h-4 w-4" />
                      Reset
                    </button>
                  ) : null}
                  <div className="relative" ref={configPopoverRef}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((open) => !open)}
                      className={`${secondaryButtonClass} justify-center`}
                      aria-expanded={settingsOpen}
                    >
                      <Settings2 className="h-4 w-4" />
                      Config
                    </button>
                    {settingsOpen ? (
                      <div
                        role="dialog"
                        aria-label="Generation config"
                        className="absolute right-0 top-full z-[190] mt-2 w-[320px] origin-top-right rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h2 className="text-sm font-semibold text-black">Generation Config</h2>
                            <p className="mt-0.5 text-[11px] text-[#666666]">Language and output formats.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#666666] transition hover:border-black hover:text-black"
                            aria-label="Close config"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <SettingsGroup icon={<Languages className="h-3.5 w-3.5" />} label="Language">
                            <SettingSelect
                              value={textLanguage}
                              disabled={isBusy}
                              onValueChange={(value) => setTextLanguage(value as EcommerceListingTextLanguage)}
                              options={TEXT_LANGUAGE_OPTIONS}
                            />
                          </SettingsGroup>

                          <SettingsGroup icon={<Monitor className="h-3.5 w-3.5" />} label="Image Format">
                            <div className="grid grid-cols-2 gap-1.5">
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

                          {!isManufacturerMode ? (
                            <SettingsGroup icon={<Film className="h-3.5 w-3.5" />} label="Video Format">
                              <SettingSelect
                                value={videoModel}
                                disabled={isBusy}
                                onValueChange={(value) => setVideoModel(value as EcommerceListingVideoModel)}
                                options={VIDEO_MODEL_OPTIONS}
                              />
                              <div className="grid grid-cols-2 gap-1.5">
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
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <UnifiedUploadArea
                images={uploadedImages}
                isBusy={isBusy}
                isLoading={isReadingUploads}
                onFiles={(files) => void handleUnifiedImageUpload(files)}
                onRemove={removeUploadedImage}
              />

              <div className="mt-5 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {quickPhrases.map((phrase) =>
                    editingPhraseId === phrase.id ? (
                      <QuickPhraseEditor
                        key={phrase.id}
                        value={quickPhraseDraft}
                        disabled={isBusy}
                        placeholder="Edit phrase"
                        onChange={setQuickPhraseDraft}
                        onSave={saveQuickPhrase}
                        onCancel={cancelQuickPhraseEdit}
                      />
                    ) : (
                      <span
                        key={phrase.id}
                        className="group inline-flex max-w-full items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs font-medium text-black sm:max-w-[340px]"
                      >
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => applyQuickPhrase(phrase.text)}
                          title={phrase.text}
                          className="min-w-0 truncate disabled:opacity-50"
                        >
                          {phrase.text}
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => editQuickPhrase(phrase)} className="shrink-0 text-[#999999] hover:text-black disabled:opacity-50" aria-label="Edit quick phrase">
                          <Settings2 className="h-3 w-3" />
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => deleteQuickPhrase(phrase.id)} className="shrink-0 text-[#999999] hover:text-black disabled:opacity-50" aria-label="Delete quick phrase">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  )}
                  {isAddingPhrase ? (
                    <QuickPhraseEditor
                      value={quickPhraseDraft}
                      disabled={isBusy}
                      placeholder="New phrase"
                      onChange={setQuickPhraseDraft}
                      onSave={saveQuickPhrase}
                      onCancel={cancelQuickPhraseEdit}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={startAddingPhrase}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#BEBEBE] bg-transparent px-2.5 py-1 text-xs font-medium text-[#666666] transition hover:border-black hover:text-black disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add phrase
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={resetQuickPhrases}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#999999] transition hover:text-black disabled:opacity-50"
                    aria-label="Reset quick phrases"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reset
                  </button>
                </div>

                <div className="rounded-xl border border-[#E5E5E5] bg-white p-2">
                  <textarea
                    value={customRequirements}
                    onChange={(event) => setCustomRequirements(event.target.value)}
                    disabled={isBusy}
                    rows={4}
                    placeholder="Describe the desired listing style, visual direction, text density, brand tone, or any constraints..."
                    className="min-h-28 w-full resize-none rounded-lg border-0 bg-white px-3 py-2 text-sm leading-6 text-black outline-none placeholder:text-[#999999] disabled:opacity-50"
                  />
                  <div className="flex flex-col gap-2 border-t border-[#E5E5E5] px-2 py-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={() => void startGeneration()}
                    className={`${primaryButtonClass} justify-center ${!canGenerate ? "opacity-50" : ""}`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                          <Coins className="h-3 w-3" />
                          {creditCost}
                        </span>
                      </>
                    )}
                  </button>
                </div>
                </div>
              </div>

              {error ? (
                <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <SettingsSidebar
                isBusy={isBusy}
                isManufacturerMode={isManufacturerMode}
                petReplacementAvailable={petReplacementAvailable}
                assetScopes={assetScopes}
                onToggleScope={toggleScope}
                brandLogoDataUrl={brandLogoDataUrl}
                brandLogoFileName={brandLogoFileName}
                isReadingBrandLogo={isReadingBrandLogo}
                brandLogoInputRef={brandLogoInputRef}
                onBrandLogoUpload={(file) => void handleBrandLogoUpload(file)}
                onRemoveBrandLogo={removeBrandLogo}
                brandLogoCorner={brandLogoCorner}
                onBrandLogoCornerChange={setBrandLogoCorner}
                savedPets={savedPets}
                selectedPetId={selectedPetId}
                onSelectedPetChange={(petId) => {
                  setSelectedPetId((current) => (current === petId ? "" : petId));
                  clearGeneratedJobState();
                }}
                onOpenCreatePetModal={() => setShowCreatePetModal(true)}
                onDeletePet={(petId) => void handleDeletePet(petId)}
                deletingPetId={deletingPetId}
              />
            </aside>
          </div>

            <div className="mt-6">
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
                onPreview={setPreviewImageUrl}
                onRetryVideo={() => void retryVideo()}
                isRetryingVideo={isRetryingVideo}
              />
            </div>
      </ToolPageShell>
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
      {previewImageUrl ? (
        <ImagePreviewModal url={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
      ) : null}
      <CreatePetModal
        isOpen={showCreatePetModal}
        onClose={() => setShowCreatePetModal(false)}
        onPetCreated={(pet) => void handlePetCreated(pet)}
      />
    </>
  );
}

function QuickPhraseEditor({
  value,
  disabled,
  placeholder,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const remaining = MAX_QUICK_PHRASE_LENGTH - value.length;

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E5E5E5] bg-white py-1 pl-2.5 pr-1 text-xs font-medium text-black focus-within:border-[#E5E5E5] sm:max-w-[420px]">
      <input
        autoFocus
        value={value}
        maxLength={MAX_QUICK_PHRASE_LENGTH}
        onChange={(event) => onChange(event.target.value.slice(0, MAX_QUICK_PHRASE_LENGTH))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        style={{ outline: "none", boxShadow: "none" }}
        className="w-44 min-w-0 border-0 bg-transparent text-xs text-black placeholder:text-[#999999] focus:border-0 focus:outline-none focus:ring-0 disabled:opacity-50 sm:w-72"
      />
      <span className="shrink-0 text-[10px] font-medium text-[#999999]">{remaining}</span>
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={onSave}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#999999] transition hover:bg-[#F2F2F2] hover:text-black disabled:opacity-50"
        aria-label="Save phrase"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCancel}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#999999] transition hover:bg-[#F2F2F2] hover:text-black disabled:opacity-50"
        aria-label="Cancel"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function UnifiedUploadArea({
  images,
  isBusy,
  isLoading,
  onFiles,
  onRemove,
}: {
  images: LocalUploadImage[];
  isBusy: boolean;
  isLoading: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  const reachedLimit = images.length >= MAX_SOURCE_IMAGE_COUNT;
  const disabled = isBusy || reachedLimit;
  const showEmptyState = images.length === 0;
  const remainingSlots = Math.max(0, MAX_SOURCE_IMAGE_COUNT - images.length);

  return (
    <div>
      {showEmptyState ? (
        <label
          className={`flex h-[360px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#BEBEBE] bg-[#FAFAFA] px-4 py-8 text-center transition ${
            disabled ? "pointer-events-none opacity-60" : "hover:border-black hover:bg-white"
          }`}
        >
          {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-black" /> : <Upload className="h-8 w-8 text-black" />}
          <span className="mt-3 text-sm font-semibold text-black">Drop images here or click to upload</span>
          <span className="mt-1 text-xs text-[#666666]">JPG, PNG, WebP, AVIF, HEIC, or HEIF</span>
          <input
            type="file"
            accept={getAcceptedImageFormats()}
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              onFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div key={image.id} className="group rounded-xl border border-[#E5E5E5] bg-white p-2">
              <div className="relative overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
                <Image src={image.dataUrl} alt={`Uploaded source ${index + 1}`} width={420} height={420} className="aspect-square w-full object-contain" unoptimized />
                <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                  {index + 1}
                </span>
                {!isBusy ? (
                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white opacity-100 transition hover:bg-black"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="mt-2 truncate px-1 text-xs text-[#666666]">{image.fileName}</p>
            </div>
          ))}

          {remainingSlots > 0 ? (
            <label
              className={`group flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#BEBEBE] bg-[#FAFAFA] p-2 text-center transition ${
                disabled ? "pointer-events-none opacity-60" : "hover:border-black hover:bg-white"
              }`}
            >
              <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border border-dashed border-transparent">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-black" />
                ) : (
                  <Plus className="h-6 w-6 text-black transition group-hover:scale-110" />
                )}
                <span className="mt-2 text-xs font-semibold text-black">Add image</span>
                <span className="mt-0.5 text-[10px] text-[#666666]">
                  {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left
                </span>
              </div>
              <input
                type="file"
                accept={getAcceptedImageFormats()}
                multiple
                disabled={disabled}
                className="sr-only"
                onChange={(event) => {
                  onFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AnimatedTogglePill({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; icon?: ReactNode; description?: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === value))
  );
  const [thumb, setThumb] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const nextIndex = options.findIndex((option) => option.value === value);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }, [value, options]);

  useEffect(() => {
    const container = containerRef.current;
    const target = buttonRefs.current[activeIndex];
    if (!container || !target) return;
    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setThumb({
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    buttonRefs.current.forEach((button) => {
      if (button) observer.observe(button);
    });
    return () => observer.disconnect();
  }, [activeIndex, options]);

  return (
    <div className="flex items-center gap-1.5">
      <div
        ref={containerRef}
        className="relative inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] p-1"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: thumb.left, width: thumb.width }}
        />
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <span
              key={option.value}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              className="relative z-10 inline-flex items-center"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full pl-3.5 pr-1.5 py-1.5 text-xs font-semibold transition-colors duration-200 disabled:opacity-50 ${
                  active ? "text-black" : "text-[#666666] hover:text-black"
                }`}
              >
                {option.icon ? <span className="flex h-4 w-4 items-center justify-center">{option.icon}</span> : null}
                {option.label}
              </button>
              {option.description ? <InlineHelp description={option.description} /> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CornerIcon({ corner, active }: { corner: EcommerceListingLogoCorner; active: boolean }) {
  const cells: Array<{ x: number; y: number; key: string }> = [
    { x: 2, y: 2, key: "top-left" },
    { x: 10, y: 2, key: "top-right" },
    { x: 2, y: 10, key: "bottom-left" },
    { x: 10, y: 10, key: "bottom-right" },
  ];
  const fill = active ? "currentColor" : "transparent";
  const stroke = active ? "currentColor" : "currentColor";
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke={stroke} strokeWidth="1.4" />
      {cells.map((cell) => (
        <rect
          key={cell.key}
          x={cell.x}
          y={cell.y}
          width="4"
          height="4"
          rx="0.8"
          fill={cell.key === corner ? fill : "none"}
          stroke={stroke}
          strokeWidth="1.2"
          opacity={cell.key === corner ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

function InlineHelp({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative mr-1 inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label="What does this option do?"
        className="flex h-5 w-5 items-center justify-center rounded-full text-[#9A9A9A] transition hover:text-black focus:text-black focus:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-[11px] leading-5 text-[#444444] shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
        >
          {description}
        </span>
      ) : null}
    </span>
  );
}

function SettingsSidebar({
  isBusy,
  isManufacturerMode,
  petReplacementAvailable,
  assetScopes,
  onToggleScope,
  brandLogoDataUrl,
  brandLogoFileName,
  isReadingBrandLogo,
  brandLogoInputRef,
  onBrandLogoUpload,
  onRemoveBrandLogo,
  brandLogoCorner,
  onBrandLogoCornerChange,
  savedPets,
  selectedPetId,
  onSelectedPetChange,
  onOpenCreatePetModal,
  onDeletePet,
  deletingPetId,
}: {
  isBusy: boolean;
  isManufacturerMode: boolean;
  petReplacementAvailable: boolean;
  assetScopes: EcommerceListingAssetScope[];
  onToggleScope: (scope: EcommerceListingAssetScope) => void;
  brandLogoDataUrl: string | null;
  brandLogoFileName: string | null;
  isReadingBrandLogo: boolean;
  brandLogoInputRef: RefObject<HTMLInputElement | null>;
  onBrandLogoUpload: (file: File) => void;
  onRemoveBrandLogo: () => void;
  brandLogoCorner: EcommerceListingLogoCorner;
  onBrandLogoCornerChange: (corner: EcommerceListingLogoCorner) => void;
  savedPets: UserPet[];
  selectedPetId: string;
  onSelectedPetChange: (petId: string) => void;
  onOpenCreatePetModal: () => void;
  onDeletePet: (petId: string) => void;
  deletingPetId: string | null;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-5">
      <h2 className="mb-1 text-sm font-semibold text-black">Asset Settings</h2>
      <p className="mb-4 text-xs text-[#666666]">Choose what to generate and add brand references.</p>

      <div className="space-y-5">
        <SettingsGroup icon={<Settings2 className="h-4 w-4" />} label="Assets to Generate">
          <div className="space-y-2">
            {ASSET_SCOPE_OPTIONS.map((item) => {
              const active = isManufacturerMode ? item.scope === "carousel" : assetScopes.includes(item.scope);
              const disabledRow = isBusy || isManufacturerMode;
              return (
                <button
                  key={item.scope}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  disabled={disabledRow}
                  onClick={() => onToggleScope(item.scope)}
                  className={`flex h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-left transition disabled:opacity-50 ${
                    active ? "border-black bg-white" : "border-[#E5E5E5] bg-white hover:border-black"
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    active ? "bg-black text-white" : "bg-[#F7F7F7] text-[#666666]"
                  }`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${active ? "text-black" : "text-[#666666]"}`}>
                      {item.label}
                    </span>
                  </span>
                  <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                    active ? "bg-black" : "bg-[#D8D8D8]"
                  }`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition ${active ? "translate-x-4" : "translate-x-0"}`} />
                  </span>
                </button>
              );
            })}
          </div>
          {isManufacturerMode ? (
            <p className="text-xs leading-5 text-[#666666]">Manufacturer Carousel generates carousel images only.</p>
          ) : null}
        </SettingsGroup>

        {isManufacturerMode ? (
          <SettingsGroup icon={<Stamp className="h-4 w-4" />} label="Brand Logo">
            <div className="space-y-2 rounded-lg border border-[#E5E5E5] bg-white p-2">
              {brandLogoDataUrl ? (
                  <div className="flex items-center gap-3">
                    <Image src={brandLogoDataUrl} alt="Brand logo" width={80} height={80} className="h-16 w-16 rounded-lg border border-[#E5E5E5] object-contain p-1" unoptimized />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-black">{brandLogoFileName}</p>
                      <button type="button" onClick={onRemoveBrandLogo} disabled={isBusy} className="mt-1 inline-flex items-center gap-1 text-xs text-[#666666] hover:text-black disabled:opacity-50">
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#BEBEBE] bg-[#FAFAFA] text-sm font-medium text-black ${isBusy ? "pointer-events-none opacity-60" : "hover:border-black"}`}>
                    {isReadingBrandLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    Upload logo
                    <input
                      ref={brandLogoInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      disabled={isBusy}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onBrandLogoUpload(file);
                      }}
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {(["top-left", "top-right", "bottom-left", "bottom-right"] as EcommerceListingLogoCorner[]).map((corner) => {
                    const active = brandLogoCorner === corner;
                    return (
                      <button
                        key={corner}
                        type="button"
                        disabled={isBusy}
                        onClick={() => onBrandLogoCornerChange(corner)}
                        aria-label={corner.replace("-", " ")}
                        aria-pressed={active}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition disabled:opacity-50 ${
                          active ? "border-black bg-black text-white" : "border-[#E5E5E5] bg-white text-[#666666] hover:border-black"
                        }`}
                      >
                        <CornerIcon corner={corner} active={active} />
                        {corner.replace("-", " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
          </SettingsGroup>
        ) : null}

        {petReplacementAvailable ? (
          <SettingsGroup
            icon={<PawPrint className="h-4 w-4" />}
            label="Pet Replacement"
            description="Select a saved pet or upload front, side, and back photos, then save them as a reusable pet asset."
          >
            <div className="grid grid-cols-4 gap-2">
              {savedPets.map((pet) => {
                const isSelected = selectedPetId === pet.id;
                const isDeleting = deletingPetId === pet.id;
                return (
                  <div
                    key={pet.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border bg-white text-left transition-all",
                      isSelected
                        ? "border-black ring-2 ring-black/15 shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <button
                      type="button"
                      disabled={isBusy || isDeleting}
                      onClick={() => onSelectedPetChange(pet.id)}
                      className="block w-full text-left disabled:opacity-50"
                      aria-label={`Select ${pet.pet_name}`}
                      aria-pressed={isSelected}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-[#fcfcfc]">
                        <img
                          src={pet.front_photo_url}
                          alt={pet.pet_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                      <p className="truncate text-xs font-semibold text-gray-900">{pet.pet_name}</p>
                      <button
                        type="button"
                        disabled={isBusy || isDeleting}
                        onClick={() => onDeletePet(pet.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#999999] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Delete ${pet.pet_name}`}
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                disabled={isBusy}
                onClick={onOpenCreatePetModal}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white text-[#666666] transition-colors hover:border-black hover:text-black disabled:opacity-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold">New pet</span>
              </button>
            </div>
          </SettingsGroup>
        ) : null}
      </div>
    </div>
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

function SettingsGroup({ icon, label, description, children }: { icon: ReactNode; label: string; description?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666666]">
        {icon}
        {label}
        {description ? <InlineHelp description={description} /> : null}
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
  inputRef?: RefObject<HTMLInputElement | null>;
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
            event.currentTarget.value = "";
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
  onPreview,
  onRetryVideo,
  isRetryingVideo,
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
  onPreview?: (url: string) => void;
  onRetryVideo?: () => void;
  isRetryingVideo?: boolean;
}) {
  const carousel = metadata.carousel_images ?? [];
  const detail = metadata.detail_images ?? [];
  const video = metadata.video;
  const hasResult = carousel.length > 0 || detail.length > 0 || Boolean(video) || Boolean(job);

  if (!hasResult) {
    return (
      <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-8 text-center sm:p-10">
        <ImageIcon className="mx-auto h-8 w-8 text-[#CCCCCC]" />
        <h2 className="mt-3 text-base font-semibold text-black">Generated assets will appear here</h2>
        <p className="mt-1 text-sm text-[#666666]">Upload product photos and start generation to create listing assets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AssetSection title="Carousel Images" subtitle="Marketplace listing visuals" slots={carousel} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} exportEnabled exportFileName="ecommerce-carousel-images.zip" onCopy={onCopy} onRegenerate={onRegenerate} onPreview={onPreview} />
      <AssetSection title="Detail Images" subtitle="Benefit, material, usage, and trust visuals" slots={detail} aspectRatio={imageAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRegenerate={onRegenerate} onPreview={onPreview} />
      <VideoSection video={video} aspectRatio={videoAspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRetry={onRetryVideo} isRetrying={isRetryingVideo} />
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
  exportEnabled = false,
  exportFileName = "ecommerce-images.zip",
  onCopy,
  onRegenerate,
  onPreview,
}: {
  title: string;
  subtitle: string;
  slots: EcommerceListingImageSlot[];
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  exportEnabled?: boolean;
  exportFileName?: string;
  onCopy: (url: string) => void;
  onRegenerate: (slot: EcommerceListingImageSlot) => void;
  onPreview?: (url: string) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportableSlots = slots.filter((slot) => slot.status === "success" && slot.resultUrl);
  const completedCount = slots.filter((slot) => slot.status === "success" || slot.status === "fail").length;

  async function exportAllImages() {
    if (isExporting || exportableSlots.length === 0) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch("/api/tools/ecommerce-listing-studio/export-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: exportFileName,
          images: exportableSlots.map((slot, index) => ({
            url: slot.resultUrl,
            fileName: slot.id || `carousel-${index + 1}`,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to export images. Please try saving them individually.");
      }

      const zipBlob = await response.blob();
      const objectUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exportFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      const skippedCount = Number(response.headers.get("X-Skipped-Count") ?? "0");
      const exportedCount = Number(response.headers.get("X-Exported-Count") ?? exportableSlots.length);
      if (skippedCount > 0) {
        setExportError(`Exported ${exportedCount} of ${exportableSlots.length} images.`);
      }
    } catch (exportError) {
      setExportError(exportError instanceof Error ? exportError.message : "Unable to export images. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  if (slots.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-black">{title}</h2>
          <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {exportEnabled ? (
            <button
              type="button"
              onClick={() => void exportAllImages()}
              disabled={isExporting || exportableSlots.length === 0}
              className={`${secondaryButtonClass} h-8 justify-center text-xs ${isExporting || exportableSlots.length === 0 ? "opacity-50" : ""}`}
              aria-label="Export all carousel images"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isExporting ? "Exporting..." : "Export All"}</span>
            </button>
          ) : null}
          <span className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1 text-xs font-mono text-[#666666]">
            {completedCount}/{slots.length}
          </span>
        </div>
      </div>
      {exportError ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {exportError}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slot) => (
          <ResultCard key={slot.id} slot={slot} aspectRatio={aspectRatio} primaryButtonClass={primaryButtonClass} secondaryButtonClass={secondaryButtonClass} copiedUrl={copiedUrl} onCopy={onCopy} onRegenerate={onRegenerate} onPreview={onPreview} />
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
  onPreview,
}: {
  slot: EcommerceListingImageSlot;
  aspectRatio: EcommerceListingImageAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRegenerate: (slot: EcommerceListingImageSlot) => void;
  onPreview?: (url: string) => void;
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
        <button
          type="button"
          onClick={() => onPreview?.(slot.resultUrl!)}
          className="block w-full cursor-zoom-in"
          aria-label="Preview image"
        >
          <Image src={slot.resultUrl} alt={slot.title} width={520} height={520} className={`${imageAspectClass(aspectRatio)} w-full rounded-lg border border-[#E5E5E5] bg-white object-cover`} unoptimized />
        </button>
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
          <button type="button" onClick={() => onRegenerate(slot)} className={`${secondaryButtonClass} h-8 justify-center text-xs`} aria-label="Edit image">
            <RefreshCw className="h-4 w-4" />
            <span>Edit</span>
          </button>
          <button type="button" onClick={() => onCopy(slot.resultUrl!)} className={`${primaryButtonClass} h-8 justify-center text-xs`} aria-label="Copy image URL">
            {copiedUrl === slot.resultUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedUrl === slot.resultUrl ? "Copied" : "Copy"}</span>
          </button>
          <a href={slot.resultUrl} download={`${slot.id}.png`} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-xs`} aria-label="Save image">
            <Download className="h-4 w-4" />
            <span>Save</span>
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

function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-black/75"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>
      <Image
        src={url}
        alt="Preview"
        width={1920}
        height={1920}
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
        unoptimized
        onClick={(e) => e.stopPropagation()}
      />
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
  onRetry,
  isRetrying,
}: {
  video: EcommerceListingMetadata["video"];
  aspectRatio: EcommerceListingVideoAspectRatio;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRetry?: () => void;
  isRetrying?: boolean;
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
            <div className={`${imageAspectClass(aspectRatio)} relative flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4`}>
              <p className="text-center text-xs text-red-700">{userFriendlyError(video.error)}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={isRetrying}
                  className={`${primaryButtonClass} h-8 justify-center text-xs`}
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Retrying...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Retry</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          ) : (
            <div className={`${imageAspectClass(aspectRatio)} relative flex items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8] text-xs text-[#888888]`}>
              {video.status === "processing" ? <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%]" /> : null}
              <span className="relative z-10">{video.storyboardUrl ? "Generating video..." : "Generating storyboard..."}</span>
            </div>
          )}
          {video.resultUrl ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => onCopy(video.resultUrl!)} className={`${primaryButtonClass} h-8 justify-center text-xs`} aria-label="Copy video URL">
                {copiedUrl === video.resultUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedUrl === video.resultUrl ? "Copied" : "Copy"}</span>
              </button>
              <a href={video.resultUrl} download="ecommerce-listing-video.mp4" target="_blank" rel="noreferrer" className={`${secondaryButtonClass} h-8 justify-center text-xs`} aria-label="Save video">
                <Download className="h-4 w-4" />
                <span>Save</span>
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
