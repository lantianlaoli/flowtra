"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  Coins,
  Coffee,
  Download,
  Image as ImageIcon,
  Languages,
  Loader2,
  Package,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import CreateAvatarModal from "@/components/CreateAvatarModal";
import CreateProductModal from "@/components/CreateProductModal";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { cn } from "@/lib/utils";
import type { UserAvatar, UserProduct } from "@/lib/supabase";
import { IMAGE_GENERATION_CREDIT_COST } from "@/lib/tools/billing-constants";
import { useToolGenerationRealtime } from "@/lib/tools/use-tool-generation-realtime";
import type { ToolGenerationJob } from "@/lib/tools/job-store";
import {
  buildSocialCoverFileNameMap,
  DEFAULT_SOCIAL_COVER_STYLE_PRESETS,
  getSocialCoverLanguageOption,
  readStoredSocialCoverStylePresets,
  SOCIAL_COVER_ASPECT_RATIOS,
  SOCIAL_COVER_LANGUAGE_OPTIONS,
  writeStoredSocialCoverStylePresets,
  type SocialCoverAspectRatio,
  type SocialCoverLanguage,
  type SocialCoverMetadata,
  type SocialCoverSlot,
  type SocialCoverSlotStatus,
  type SocialCoverStylePreset,
} from "@/lib/tools/social-cover-generator";

type PageStatus = "idle" | "reading" | "starting" | "processing" | "completed" | "error";
type LocalImage = { fileName: string; dataUrl: string };
type SocialCoverAsset = {
  id: string;
  name: string;
  imageUrl: string;
  isSystem?: boolean;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;
const SESSION_KEY = "flowtra:social-cover-generator:latest-job";
const ASPECT_CLASS: Record<SocialCoverAspectRatio, string> = {
  auto: "aspect-square",
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "3:4": "aspect-[3/4]",
  "16:9": "aspect-[16/9]",
  "9:16": "aspect-[9/16]",
};
const ASPECT_LABELS: Record<SocialCoverAspectRatio, string> = {
  auto: "Auto",
  "1:1": "1:1",
  "4:3": "4:3",
  "3:4": "3:4",
  "16:9": "16:9",
  "9:16": "9:16",
};
type CreditStatus = {
  isLoading: boolean;
  creditsRemaining: number | null;
  hasActiveSubscription: boolean;
  error: string | null;
};

function buildDefaultAspectRatiosByLanguage() {
  return Object.fromEntries(
    SOCIAL_COVER_LANGUAGE_OPTIONS.map((option) => [option.value, ["4:3", "3:4"]])
  ) as Record<SocialCoverLanguage, SocialCoverAspectRatio[]>;
}

function buildDefaultCollapsedSizeLanguages() {
  return new Set<SocialCoverLanguage>(SOCIAL_COVER_LANGUAGE_OPTIONS.map((option) => option.value));
}

function readInitialPresetState() {
  if (typeof window === "undefined") {
    const first = DEFAULT_SOCIAL_COVER_STYLE_PRESETS[0];
    return {
      presets: DEFAULT_SOCIAL_COVER_STYLE_PRESETS,
      selectedPresetId: first.id,
      presetName: first.name,
      styleGuide: first.prompt,
    };
  }
  const presets = readStoredSocialCoverStylePresets(window.localStorage);
  return {
    presets,
    selectedPresetId: presets[0]?.id ?? "",
    presetName: presets[0]?.name ?? "",
    styleGuide: presets[0]?.prompt ?? "",
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

async function readImageFile(file: File): Promise<LocalImage> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Upload a PNG, JPG, or WEBP image.");
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_CLIENT_UPLOAD_SIZE_MB,
    maxWidthOrHeight: MAX_CLIENT_UPLOAD_DIMENSION,
    useWebWorker: true,
    fileType: file.type,
  });

  return {
    fileName: file.name,
    dataUrl: await fileToDataUrl(compressed),
  };
}

function statusLabel(status?: SocialCoverSlotStatus) {
  if (status === "success") return "Ready";
  if (status === "fail") return "Failed";
  if (status === "processing") return "Generating";
  return "Queued";
}

function statusBadgeClass(status?: SocialCoverSlotStatus) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "fail") return "border-red-200 bg-red-50 text-red-700";
  if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#E5E5E5] bg-[#F7F7F7] text-[#666666]";
}

function buildOptimisticSlots(input: {
  title: string;
  languages: SocialCoverLanguage[];
  aspectRatiosByLanguage: Record<SocialCoverLanguage, SocialCoverAspectRatio[]>;
}): SocialCoverSlot[] {
  const sourceTitle = input.title.trim();
  const slots: SocialCoverSlot[] = [];
  for (const language of input.languages) {
    for (const aspectRatio of input.aspectRatiosByLanguage[language] ?? []) {
      slots.push({
        id: `cover-${language}-${aspectRatio}-1`,
        language,
        aspectRatio,
        variantIndex: 1,
        title: sourceTitle,
        taskId: "",
        status: "processing",
        prompt: "",
      });
    }
  }
  return slots;
}

function terminalJob(job: ToolGenerationJob | null) {
  return job?.status === "completed" || job?.status === "failed";
}

function nameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Untitled";
}

function WaveLoadingOverlay() {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md bg-white/70"
    >
      <motion.div
        className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#E9E9E9]/90 to-transparent"
        initial={{ x: "-120%" }}
        animate={{ x: "240%" }}
        transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
      />
    </motion.div>
  );
}

async function imageUrlToLocalImage(imageUrl: string, fileName: string): Promise<LocalImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to load selected image.");
  }
  const blob = await response.blob();
  return {
    fileName,
    dataUrl: await fileToDataUrl(new File([blob], fileName, { type: blob.type || "image/png" })),
  };
}

function avatarToAsset(value: Record<string, unknown>): SocialCoverAsset | null {
  const imageUrl =
    typeof value.primary_photo_url === "string"
      ? value.primary_photo_url
      : typeof value.photo_url === "string"
        ? value.photo_url
        : "";
  if (!imageUrl) return null;
  return {
    id: String(value.id ?? imageUrl),
    name: typeof value.avatar_name === "string" ? value.avatar_name : "Avatar",
    imageUrl,
    isSystem: Boolean(value.isSystem),
  };
}

function productToAsset(value: Record<string, unknown>): SocialCoverAsset | null {
  const photos = Array.isArray(value.user_product_photos) ? value.user_product_photos : [];
  const primary = photos.find((photo) => photo && typeof photo === "object" && (photo as Record<string, unknown>).is_primary);
  const fallback = primary ?? photos[0];
  const imageUrl =
    fallback && typeof fallback === "object" && typeof (fallback as Record<string, unknown>).photo_url === "string"
      ? String((fallback as Record<string, unknown>).photo_url)
      : "";
  if (!imageUrl) return null;
  return {
    id: String(value.id ?? imageUrl),
    name: typeof value.product_name === "string" ? value.product_name : "Product",
    imageUrl,
    isSystem: Boolean(value.isSystem),
  };
}

function AssetPicker({
  title,
  subtitle,
  icon,
  assets,
  selectedAssetId,
  image,
  disabled,
  isLoading,
  uploadLabel,
  onSelect,
  onAdd,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  assets: SocialCoverAsset[];
  selectedAssetId: string | null;
  image: LocalImage | null;
  disabled: boolean;
  isLoading: boolean;
  uploadLabel: string;
  onSelect: (asset: SocialCoverAsset) => void;
  onAdd: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white p-4">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-black">
            {icon}
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#666666]">{subtitle}</p>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 content-start gap-2 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="col-span-3 flex h-24 items-center justify-center rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] text-xs font-medium text-[#666666]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading assets
          </div>
        ) : null}
        {!isLoading && assets.map((asset) => {
          const isSelected = selectedAssetId === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(asset)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-white text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                isSelected ? "border-black ring-2 ring-black/15" : "border-[#E5E5E5] hover:border-black"
              )}
              aria-pressed={isSelected}
            >
              <div className="aspect-square overflow-hidden bg-[#F7F7F7]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.imageUrl} alt={asset.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex min-h-9 items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-[11px] font-semibold text-black">{asset.name}</span>
                {asset.isSystem ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#666666]" aria-hidden="true" /> : null}
              </div>
              {isSelected ? (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4D4D4] bg-[#F7F7F7] p-2 text-center text-xs font-semibold text-[#666666] transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
          {uploadLabel}
        </button>
      </div>
      {image && !selectedAssetId ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7]">
          <div className="aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} alt={title} className="h-full w-full object-cover" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ToggleButton<T extends string>({
  value,
  selected,
  disabled,
  showCheck = false,
  className,
  children,
  onToggle,
}: {
  value: T;
  selected: boolean;
  disabled: boolean;
  showCheck?: boolean;
  className?: string;
  children: React.ReactNode;
  onToggle: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(value)}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-black bg-black text-white"
          : "border-[#E5E5E5] bg-white text-[#666666] hover:border-black hover:text-black",
        className
      )}
    >
      {showCheck && selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function CoverCard({
  fileBaseName,
  slot,
  retryingSlotId,
  accessWarning,
  accessWarningLabel,
  onRetry,
  onEdit,
}: {
  fileBaseName: string;
  slot: SocialCoverSlot;
  retryingSlotId: string | null;
  accessWarning: boolean;
  accessWarningLabel: string;
  onRetry: (slot: SocialCoverSlot) => void;
  onEdit: (slot: SocialCoverSlot) => void;
}) {
  const isRetrying = retryingSlotId === slot.id;
  const languageOption = getSocialCoverLanguageOption(slot.language);

  return (
    <article className="rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-[0_20px_48px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-black" title={slot.title}>
            {languageOption.label} · {slot.aspectRatio}
          </h3>
          <p className="mt-1 truncate text-xs text-[#666666]">{slot.title}</p>
        </div>
        <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold", statusBadgeClass(slot.status))}>
          {slot.status === "processing" || slot.status === "waiting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {statusLabel(slot.status)}
        </span>
      </div>

      {slot.resultUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.resultUrl}
            alt={`${slot.language} ${slot.aspectRatio} social cover`}
            className={cn(ASPECT_CLASS[slot.aspectRatio], "w-full rounded-md border border-[#E5E5E5] object-cover")}
            loading="lazy"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={slot.resultUrl}
              download={`${fileBaseName}.png`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-xs font-semibold text-black transition hover:border-black"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Save
            </a>
            <button
              type="button"
              onClick={() => onEdit(slot)}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-white text-xs font-semibold text-black transition hover:border-black"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          </div>
        </>
      ) : slot.status === "fail" ? (
        <>
          <div className={cn(ASPECT_CLASS[slot.aspectRatio], "flex items-center justify-center rounded-md border border-dashed border-red-200 bg-red-50 p-4 text-center text-xs leading-5 text-red-700")}>
            {slot.error || "Generation failed."}
          </div>
          <button
            type="button"
            onClick={() => onRetry(slot)}
            disabled={isRetrying || accessWarning}
            className={cn(
              "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border text-xs font-semibold transition disabled:cursor-not-allowed",
              accessWarning
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700 hover:border-red-300 disabled:opacity-60"
            )}
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : accessWarning ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {accessWarning ? (
              accessWarningLabel
            ) : (
              <>
                <span>{isRetrying ? "Retrying..." : "Retry"}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] leading-none">
                  <Coins className="h-3 w-3" aria-hidden="true" />
                  {IMAGE_GENERATION_CREDIT_COST}
                </span>
              </>
            )}
          </button>
        </>
      ) : (
        <div className={cn(ASPECT_CLASS[slot.aspectRatio], "relative flex items-center justify-center overflow-hidden rounded-md border border-dashed border-[#E5E5E5] bg-[#F7F7F7] p-4 text-center text-xs text-[#666666]")}>
          {slot.status === "processing" || slot.status === "waiting" ? (
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.92)_50%,transparent_100%)] bg-[length:200%_100%]" />
          ) : null}
          <div className="relative z-10 flex flex-col items-center gap-2">
            {slot.status === "processing" || slot.status === "waiting" ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
            )}
            <span>{slot.status === "waiting" ? "Generating" : statusLabel(slot.status)}</span>
          </div>
        </div>
      )}
    </article>
  );
}

export default function SocialCoverGeneratorPage() {
  const { isLoaded: isUserLoaded, isSignedIn } = useUser();
  const [presetBootstrap] = useState(readInitialPresetState);
  const [personImage, setPersonImage] = useState<LocalImage | null>(null);
  const [productImage, setProductImage] = useState<LocalImage | null>(null);
  const [personAssets, setPersonAssets] = useState<SocialCoverAsset[]>([]);
  const [productAssets, setProductAssets] = useState<SocialCoverAsset[]>([]);
  const [selectedPersonAssetId, setSelectedPersonAssetId] = useState<string | null>(null);
  const [selectedProductAssetId, setSelectedProductAssetId] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isCreateAvatarOpen, setIsCreateAvatarOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [languages, setLanguages] = useState<SocialCoverLanguage[]>(["zh", "en"]);
  const [aspectRatiosByLanguage, setAspectRatiosByLanguage] = useState<Record<SocialCoverLanguage, SocialCoverAspectRatio[]>>(
    buildDefaultAspectRatiosByLanguage
  );
  const [collapsedSizeLanguages, setCollapsedSizeLanguages] = useState<Set<SocialCoverLanguage>>(
    buildDefaultCollapsedSizeLanguages
  );
  const [creditStatus, setCreditStatus] = useState<CreditStatus>({
    isLoading: true,
    creditsRemaining: null,
    hasActiveSubscription: false,
    error: null,
  });
  const [presets, setPresets] = useState<SocialCoverStylePreset[]>(presetBootstrap.presets);
  const [selectedPresetId, setSelectedPresetId] = useState(presetBootstrap.selectedPresetId);
  const [presetName, setPresetName] = useState(presetBootstrap.presetName);
  const [styleGuide, setStyleGuide] = useState(presetBootstrap.styleGuide);
  const [status, setStatus] = useState<PageStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ToolGenerationJob | null>(null);
  const [optimisticSlots, setOptimisticSlots] = useState<SocialCoverSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [retryingSlotId, setRetryingSlotId] = useState<string | null>(null);
  const [regenerateSlot, setRegenerateSlot] = useState<SocialCoverSlot | null>(null);
  const [refinementText, setRefinementText] = useState("");
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleAnalysisComplete, setStyleAnalysisComplete] = useState(false);
  const [styleAnalysisError, setStyleAnalysisError] = useState<string | null>(null);
  const styleAnalysisInputRef = useRef<HTMLInputElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  const { job } = useToolGenerationRealtime(jobId);
  const metadata = useMemo(
    () => (currentJob?.metadata ?? {}) as Partial<SocialCoverMetadata>,
    [currentJob?.metadata]
  );
  const slots = useMemo(() => metadata.slots ?? optimisticSlots, [metadata.slots, optimisticSlots]);
  const completed = metadata.completed_outputs ?? slots.filter((slot) => slot.status === "success").length;
  const total = metadata.total_outputs ?? (slots.length || languages.reduce((count, language) => count + (aspectRatiosByLanguage[language]?.length ?? 0), 0));
  const isReadingImage = status === "reading";
  const isGenerating = status === "starting" || status === "processing";
  const controlsDisabled = isReadingImage;
  const selectedOutputCount = languages.reduce((count, language) => count + (aspectRatiosByLanguage[language]?.length ?? 0), 0);
  const estimatedCredits = selectedOutputCount * IMAGE_GENERATION_CREDIT_COST;
  const accessChecking = !isUserLoaded || (Boolean(isSignedIn) && creditStatus.isLoading);
  const insufficientCredits =
    Boolean(isSignedIn) &&
    creditStatus.hasActiveSubscription &&
    creditStatus.creditsRemaining !== null &&
    creditStatus.creditsRemaining < estimatedCredits;
  const accessWarning =
    !accessChecking &&
    (!isSignedIn || !creditStatus.hasActiveSubscription || insufficientCredits || Boolean(creditStatus.error));
  const accessWarningLabel = !isUserLoaded || creditStatus.isLoading
    ? "Checking credits..."
    : !isSignedIn
      ? "Sign in required"
      : creditStatus.error
        ? "Credit check failed"
        : !creditStatus.hasActiveSubscription
          ? "Subscription required"
          : insufficientCredits
            ? "Not enough credits"
            : "Generate covers";
  const generateDisabled = isReadingImage || isGenerating || !personImage || !productImage || !title.trim() || accessChecking || accessWarning;
  const fileNameMap = useMemo(() => {
    if (!currentJob || !metadata.source_title) return {};
    return buildSocialCoverFileNameMap({
      sourceTitle: metadata.source_title,
      createdAt: new Date(currentJob.created_at).getTime(),
      slots,
    });
  }, [currentJob, metadata.source_title, slots]);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null;
  const heroCreditState = !isUserLoaded || (Boolean(isSignedIn) && creditStatus.isLoading)
    ? { icon: "loading" as const, label: "Checking..." }
    : !isSignedIn
      ? { icon: "warning" as const, label: "Please sign in" }
      : creditStatus.error
        ? { icon: "warning" as const, label: "Please retry" }
        : !creditStatus.hasActiveSubscription
          ? { icon: "warning" as const, label: "Please subscribe" }
          : { icon: "credits" as const, label: String(creditStatus.creditsRemaining ?? 0) };

  useEffect(() => {
    if (typeof window === "undefined") return;
    writeStoredSocialCoverStylePresets(window.localStorage, presets);
  }, [presets]);

  useEffect(() => {
    if (!isPresetMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!presetMenuRef.current?.contains(event.target as Node)) {
        setIsPresetMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPresetMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPresetMenuOpen]);

  useEffect(() => {
    if (!isUserLoaded) return;
    if (!isSignedIn) {
      setCreditStatus({
        isLoading: false,
        creditsRemaining: null,
        hasActiveSubscription: false,
        error: null,
      });
      return;
    }

    let canceled = false;
    async function loadCreditStatus() {
      setCreditStatus((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const response = await fetch("/api/credits/check", { cache: "no-store" });
        const payload = await response.json();
        if (canceled) return;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to check credits.");
        }
        const subscriptionStatus = payload.subscription?.status;
        setCreditStatus({
          isLoading: false,
          creditsRemaining:
            typeof payload.credits?.credits_remaining === "number"
              ? payload.credits.credits_remaining
              : 0,
          hasActiveSubscription: subscriptionStatus === "active" || subscriptionStatus === "trialing",
          error: null,
        });
      } catch (nextError) {
        if (canceled) return;
        setCreditStatus({
          isLoading: false,
          creditsRemaining: null,
          hasActiveSubscription: false,
          error: nextError instanceof Error ? nextError.message : "Failed to check credits.",
        });
      }
    }

    void loadCreditStatus();
    return () => {
      canceled = true;
    };
  }, [isSignedIn, isUserLoaded]);

  useEffect(() => {
    if (!job) return;
    setCurrentJob(job);
    setOptimisticSlots([]);
    if (terminalJob(job)) {
      setStatus(job.status === "completed" ? "completed" : "error");
    } else {
      setStatus("processing");
    }
  }, [job]);

  useEffect(() => {
    if (!isUserLoaded || !isSignedIn) {
      setPersonAssets([]);
      setProductAssets([]);
      return;
    }

    let canceled = false;
    async function loadAssets() {
      setIsLoadingAssets(true);
      try {
        const [avatarsResponse, productsResponse] = await Promise.all([
          fetch("/api/user-avatars", { cache: "no-store" }),
          fetch("/api/user-products", { cache: "no-store" }),
        ]);
        if (canceled) return;

        const [avatarsPayload, productsPayload] = await Promise.all([
          avatarsResponse.json(),
          productsResponse.json(),
        ]);

        if (avatarsResponse.ok && Array.isArray(avatarsPayload.avatars)) {
          setPersonAssets(
            avatarsPayload.avatars
              .map((avatar: Record<string, unknown>) => avatarToAsset(avatar))
              .filter((asset: SocialCoverAsset | null): asset is SocialCoverAsset => Boolean(asset))
          );
        }

        if (productsResponse.ok && Array.isArray(productsPayload.products)) {
          setProductAssets(
            productsPayload.products
              .map((product: Record<string, unknown>) => productToAsset(product))
              .filter((asset: SocialCoverAsset | null): asset is SocialCoverAsset => Boolean(asset))
          );
        }
      } catch {
        if (!canceled) setError("Failed to load saved assets.");
      } finally {
        if (!canceled) setIsLoadingAssets(false);
      }
    }

    void loadAssets();
    return () => {
      canceled = true;
    };
  }, [isSignedIn, isUserLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedJobId = window.sessionStorage.getItem(SESSION_KEY);
    if (storedJobId) {
      setJobId(storedJobId);
      return;
    }

    let canceled = false;
    async function loadLatestJob() {
      try {
        const response = await fetch("/api/tools/jobs/latest?toolKey=social-cover-generator&maxAgeMinutes=180");
        const payload = await response.json();
        if (!response.ok || canceled || !payload.job?.id) return;
        setJobId(payload.job.id);
        setCurrentJob(payload.job);
        window.sessionStorage.setItem(SESSION_KEY, payload.job.id);
      } catch {
        // Ignore latest-job restore failures.
      }
    }
    void loadLatestJob();
    return () => {
      canceled = true;
    };
  }, []);

  async function selectAsset(kind: "person" | "product", asset: SocialCoverAsset) {
    setStatus("reading");
    setError(null);
    try {
      const image = await imageUrlToLocalImage(asset.imageUrl, `${asset.name}.png`);
      if (kind === "person") {
        setPersonImage(image);
        setSelectedPersonAssetId(asset.id);
      } else {
        setProductImage(image);
        setSelectedProductAssetId(asset.id);
      }
      setStatus(currentJob && !terminalJob(currentJob) ? "processing" : "idle");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load selected asset.");
      setStatus("error");
    }
  }

  function handleAvatarCreated(avatar: UserAvatar) {
    const asset = avatarToAsset(avatar as unknown as Record<string, unknown>);
    if (!asset) return;
    setPersonAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
    void selectAsset("person", asset);
  }

  function handleProductCreated(product: UserProduct) {
    const asset = productToAsset(product as unknown as Record<string, unknown>);
    if (!asset) return;
    setProductAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
    void selectAsset("product", asset);
  }

  function toggleLanguage(value: SocialCoverLanguage) {
    setLanguages((current) => {
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return next.length ? next : current;
    });
    setAspectRatiosByLanguage((current) => ({
      ...buildDefaultAspectRatiosByLanguage(),
      ...current,
      [value]: current[value]?.length ? current[value] : ["4:3", "3:4"],
    }));
    setCollapsedSizeLanguages((current) => new Set(current).add(value));
  }

  function toggleAspectRatio(language: SocialCoverLanguage, value: SocialCoverAspectRatio) {
    setAspectRatiosByLanguage((current) => {
      const selected = current[language] ?? ["4:3", "3:4"];
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
      if (!next.length) return current;
      return { ...current, [language]: SOCIAL_COVER_ASPECT_RATIOS.filter((item) => next.includes(item)) };
    });
  }

  function toggleSizeCollapse(language: SocialCoverLanguage) {
    setCollapsedSizeLanguages((current) => {
      const next = new Set(current);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      return next;
    });
  }

  function choosePreset(presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    setSelectedPresetId(presetId);
    if (preset) {
      setPresetName(preset.name);
      setStyleGuide(preset.prompt);
    }
  }

  function openPresetEditor() {
    const preset = presets.find((item) => item.id === selectedPresetId) ?? presets[0];
    if (preset) {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setStyleGuide(preset.prompt);
    }
    setStyleAnalysisError(null);
    setStyleAnalysisComplete(false);
    setIsConfigOpen(true);
  }

  function savePreset() {
    const name = presetName.trim() || "Custom Style";
    const prompt = styleGuide.trim();
    if (!prompt) return;
    if (selectedPresetId && presets.some((item) => item.id === selectedPresetId)) {
      setPresets((current) => current.map((item) => item.id === selectedPresetId ? { ...item, name, prompt } : item));
      setPresetName(name);
      setStyleGuide(prompt);
      setStyleAnalysisError(null);
      setIsConfigOpen(false);
      return;
    }
    const preset = { id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, prompt };
    setPresets((current) => [...current, preset]);
    setSelectedPresetId(preset.id);
    setPresetName(name);
    setStyleGuide(prompt);
    setStyleAnalysisError(null);
    setIsConfigOpen(false);
  }

  function deletePreset() {
    if (!selectedPresetId) return;
    const next = presets.filter((item) => item.id !== selectedPresetId);
    const fallback = next.length ? next : DEFAULT_SOCIAL_COVER_STYLE_PRESETS;
    setPresets(fallback);
    setSelectedPresetId(fallback[0]?.id ?? "");
    setPresetName(fallback[0]?.name ?? "");
    setStyleGuide(fallback[0]?.prompt ?? "");
  }

  async function analyzeStyleCover(file: File) {
    setIsAnalyzingStyle(true);
    setStyleAnalysisError(null);
    setStyleAnalysisComplete(false);
    try {
      const image = await readImageFile(file);
      const response = await fetch("/api/tools/social-cover-generator/analyze-style", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: image.dataUrl }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to analyze cover style.");
      }
      const nextName = typeof payload.analysis?.name === "string" ? payload.analysis.name.trim() : "";
      const nextPrompt = typeof payload.analysis?.prompt === "string" ? payload.analysis.prompt.trim() : "";
      if (!nextPrompt) throw new Error("AI did not return a usable cover style.");
      setSelectedPresetId("");
      setPresetName(nextName || "AI Extracted Cover Style");
      setStyleGuide(nextPrompt);
      setStyleAnalysisComplete(true);
    } catch (nextError) {
      setStyleAnalysisError(nextError instanceof Error ? nextError.message : "Failed to analyze cover style.");
      setStyleAnalysisComplete(false);
    } finally {
      setIsAnalyzingStyle(false);
    }
  }

  async function startJob() {
    if (!personImage || !productImage || !title.trim()) {
      setError("Upload a portrait, upload a product or logo, and enter a title.");
      setStatus("error");
      return;
    }
    setStatus("starting");
    setError(null);
    setCurrentJob(null);
    setJobId(null);
    setOptimisticSlots(buildOptimisticSlots({ title, languages, aspectRatiosByLanguage }));
    try {
      const response = await fetch("/api/tools/social-cover-generator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personImageDataUrl: personImage.dataUrl,
          productOrLogoImageDataUrl: productImage.dataUrl,
          title,
          styleGuide,
          languages,
          aspectRatiosByLanguage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to start generation.");
      setJobId(payload.jobId);
      setCurrentJob(payload.job ?? null);
      setStatus("processing");
      if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_KEY, payload.jobId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to start generation.");
      setOptimisticSlots([]);
      setStatus("error");
    }
  }

  async function retrySlot(slot: SocialCoverSlot) {
    if (!currentJob) return;
    setRetryingSlotId(slot.id);
    setError(null);
    try {
      const response = await fetch("/api/tools/social-cover-generator/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: currentJob.id, slotId: slot.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to retry cover.");
      setCurrentJob(payload.job ?? currentJob);
      setJobId(currentJob.id);
      setStatus("processing");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to retry cover.");
    } finally {
      setRetryingSlotId(null);
    }
  }

  async function submitRegeneration() {
    if (!currentJob || !regenerateSlot?.resultUrl) return;
    if (!refinementText.trim()) {
      setRegenerateError("Describe what to change.");
      return;
    }
    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      const response = await fetch("/api/tools/social-cover-generator/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: currentJob.id,
          slotId: regenerateSlot.id,
          resultUrl: regenerateSlot.resultUrl,
          refinement: refinementText.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to edit cover.");
      setCurrentJob(payload.job ?? currentJob);
      setRegenerateSlot(null);
      setRefinementText("");
      setStatus("processing");
    } catch (nextError) {
      setRegenerateError(nextError instanceof Error ? nextError.message : "Failed to edit cover.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function downloadZip() {
    if (!currentJob) return;
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/social-cover-generator/zip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: currentJob.id }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "ZIP export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "social-covers.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ZIP export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  function resetGenerationState() {
    setJobId(null);
    setCurrentJob(null);
    setOptimisticSlots([]);
    setError(null);
    setRetryingSlotId(null);
    setRegenerateSlot(null);
    setRegenerateError(null);
    setRefinementText("");
    setIsRegenerating(false);
    setIsExporting(false);
    setStatus("idle");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }

  return (
    <>
      <ToolPageShell
        toolSlug="social-cover-generator"
        title="Social Cover Generator"
        description="Upload a portrait and product or logo reference to generate bilingual social covers for thumbnails, launches, and creator campaigns."
        statusLabel={heroCreditState.label}
        statusTone={heroCreditState.icon === "loading" ? "loading" : heroCreditState.icon === "warning" ? "warning" : "credits"}
      >
            <section className="grid gap-5 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-4 lg:h-[820px] lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,0.58fr)] lg:items-stretch xl:h-[920px]">
              <div className="grid min-h-0 gap-4 lg:grid-rows-2">
                <AssetPicker
                  title="Portrait"
                  subtitle="Founder, creator, model, or talking-head reference."
                  icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                  assets={personAssets}
                  selectedAssetId={selectedPersonAssetId}
                  image={personImage}
                  disabled={controlsDisabled}
                  isLoading={isLoadingAssets}
                  uploadLabel="New portrait"
                  onSelect={(asset) => void selectAsset("person", asset)}
                  onAdd={() => setIsCreateAvatarOpen(true)}
                />
                <AssetPicker
                  title="Product or logo"
                  subtitle="Product photo, package, logo, object, or brand mark."
                  icon={<Package className="h-4 w-4" aria-hidden="true" />}
                  assets={productAssets}
                  selectedAssetId={selectedProductAssetId}
                  image={productImage}
                  disabled={controlsDisabled}
                  isLoading={isLoadingAssets}
                  uploadLabel="New product"
                  onSelect={(asset) => void selectAsset("product", asset)}
                  onAdd={() => setIsCreateProductOpen(true)}
                />
              </div>

              <section data-social-cover-config-card className="flex h-[720px] min-h-0 flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white lg:h-full">
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
                  <label className="block shrink-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-black">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Title
                    </span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Launch title, hook, or campaign headline"
                      disabled={controlsDisabled}
                      className="mt-2 h-11 w-full rounded-md border border-[#E5E5E5] bg-white px-3 text-sm text-black outline-none transition placeholder:text-[#999999] focus:border-[#D7D7D7] disabled:opacity-60"
                    />
                  </label>

                  <div className="shrink-0">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
                      <Palette className="h-4 w-4" aria-hidden="true" />
                      Style preset
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                      <div ref={presetMenuRef} className="relative min-w-0">
                        <button
                          type="button"
                          disabled={controlsDisabled}
                          aria-haspopup="listbox"
                          aria-expanded={isPresetMenuOpen}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setIsPresetMenuOpen((open) => !open);
                          }}
                          className={cn(
                            "flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#E5E5E5] bg-white px-3 text-left text-sm text-black outline-none transition disabled:opacity-60",
                            isPresetMenuOpen ? "border-[#D7D7D7]" : "hover:border-[#D7D7D7]"
                          )}
                        >
                          <span className="truncate">{selectedPreset?.name ?? "Choose preset"}</span>
                          <ChevronDown className={cn("pointer-events-none h-4 w-4 shrink-0 text-[#666666] transition-transform duration-200", isPresetMenuOpen && "rotate-180")} aria-hidden="true" />
                        </button>
                        <AnimatePresence>
                          {isPresetMenuOpen ? (
                            <motion.div
                              role="listbox"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.16, ease: "easeOut" }}
                              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E5E5E5] bg-white p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.12)]"
                            >
                              {presets.map((preset) => {
                                const selected = preset.id === selectedPresetId;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                      choosePreset(preset.id);
                                      setIsPresetMenuOpen(false);
                                    }}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-[#F7F7F7]",
                                      selected ? "bg-[#F7F7F7] text-black" : "text-[#555555]"
                                    )}
                                  >
                                    <span className="truncate">{preset.name}</span>
                                    {selected ? <Check className="h-4 w-4 shrink-0 text-black" aria-hidden="true" /> : null}
                                  </button>
                                );
                              })}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                      <button
                        type="button"
                        onClick={openPresetEditor}
                        disabled={controlsDisabled}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Edit style preset"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPresetId("");
                          setPresetName("");
                          setStyleGuide("");
                          setStyleAnalysisComplete(false);
                          setStyleAnalysisError(null);
                          setIsConfigOpen(true);
                        }}
                        disabled={controlsDisabled}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Add style preset"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div data-social-cover-selectors className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-4 lg:grid-cols-[0.48fr_0.52fr] lg:grid-rows-none">
                    <section data-social-cover-language-panel className="flex min-h-0 flex-col rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-black">
                        <Languages className="h-4 w-4" aria-hidden="true" />
                        Languages
                      </div>
                      <div data-social-cover-language-list className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1">
                        {SOCIAL_COVER_LANGUAGE_OPTIONS.map((option) => (
                          <ToggleButton
                            key={option.value}
                            value={option.value}
                            selected={languages.includes(option.value)}
                            disabled={controlsDisabled}
                            showCheck
                            className="h-11 w-full justify-start"
                            onToggle={toggleLanguage}
                          >
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate">{option.label}</span>
                              <span className="truncate font-medium opacity-75">{option.nativeLabel}</span>
                            </span>
                          </ToggleButton>
                        ))}
                      </div>
                    </section>

                    <section data-social-cover-size-panel className="flex min-h-0 flex-col rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-black">
                        <ImageIcon className="h-4 w-4" aria-hidden="true" />
                        Sizes
                      </div>
                      <div data-social-cover-size-list className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">
                        {languages.map((language) => {
                          const languageOption = getSocialCoverLanguageOption(language);
                          const isCollapsed = collapsedSizeLanguages.has(language);
                          const selectedRatios = aspectRatiosByLanguage[language] ?? ["4:3", "3:4"];
                          return (
                          <div key={language} className="rounded-md border border-[#E5E5E5] bg-white p-2">
                            <button
                              type="button"
                              onClick={() => toggleSizeCollapse(language)}
                              className="flex min-h-8 w-full items-center justify-between gap-2 text-left"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-black">{languageOption.label}</span>
                                <span className="block truncate text-[11px] text-[#666666]">{languageOption.nativeLabel}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="font-mono text-[11px] text-[#666666]">{selectedRatios.length}</span>
                                <ChevronDown className={cn("h-4 w-4 text-[#666666] transition", isCollapsed && "-rotate-90")} aria-hidden="true" />
                              </span>
                            </button>
                            <AnimatePresence initial={false}>
                              {!isCollapsed ? (
                                <motion.div
                                  key={`${language}-sizes`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                                    {SOCIAL_COVER_ASPECT_RATIOS.map((aspectRatio) => (
                                      <ToggleButton
                                        key={`${language}-${aspectRatio}`}
                                        value={aspectRatio}
                                        selected={selectedRatios.includes(aspectRatio)}
                                        disabled={controlsDisabled}
                                        showCheck
                                        onToggle={(value) => toggleAspectRatio(language, value)}
                                      >
                                        {ASPECT_LABELS[aspectRatio]}
                                      </ToggleButton>
                                    ))}
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
                <div data-social-cover-generate-footer className="shrink-0 border-t border-[#E5E5E5] bg-white p-4 shadow-[0_-16px_32px_rgba(255,255,255,0.92)]">
                  {error ? (
                    <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={startJob}
                    disabled={generateDisabled}
                    className={cn(
                      "landing-press-button landing-press-button--compact flex h-12 w-full items-center justify-center gap-2 text-sm font-medium disabled:cursor-not-allowed",
                      accessWarning && "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_8px_22px_rgba(245,158,11,0.18)] hover:bg-amber-50"
                    )}
                  >
                    {status === "starting" || accessChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : accessWarning ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600 drop-shadow-[0_0_7px_rgba(245,158,11,0.55)]" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {accessWarning || accessChecking ? (
                      accessWarningLabel
                    ) : (
                      <>
                        <span>{status === "starting" ? "Starting..." : "Generate covers"}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold leading-none">
                          <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                          {estimatedCredits}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </section>
            </section>

            <section className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7]">
              <div className="flex flex-col gap-3 border-b border-[#E5E5E5] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-black">Generated covers</h2>
                  <p className="mt-1 text-xs text-[#666666]">
                    {metadata.title_fallback ? "Localized title generation used the original title as fallback." : "Results update automatically when KIE webhooks arrive."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={resetGenerationState}
                    disabled={!currentJob && optimisticSlots.length === 0}
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 text-xs font-semibold text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={downloadZip}
                    disabled={!currentJob || completed === 0 || isExporting}
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 text-xs font-semibold text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    Export ZIP
                  </button>
                </div>
              </div>
              <div className="p-4">
                {slots.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {slots.map((slot) => (
                      <CoverCard
                        key={slot.id}
                        fileBaseName={fileNameMap[slot.id] ?? slot.id}
                        slot={slot}
                        retryingSlotId={retryingSlotId}
                        accessWarning={accessWarning}
                        accessWarningLabel={accessWarningLabel}
                        onRetry={retrySlot}
                        onEdit={(coverSlot) => {
                          setRegenerateSlot(coverSlot);
                          setRefinementText("");
                          setRegenerateError(null);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-[#D4D4D4] bg-white p-6 text-center">
                    <div className="max-w-sm">
                      <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#666666]" aria-hidden="true" />
                      <p className="text-sm font-semibold text-black">Upload references to start</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
      </ToolPageShell>

      <AnimatePresence>
        {isConfigOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <motion.div
              className="w-full max-w-md rounded-lg border border-[#E5E5E5] bg-white shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-black">Style presets</h2>
                <p className="mt-1 text-xs text-[#666666]">Save, update, or remove reusable cover styles.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                disabled={isAnalyzingStyle}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E5E5] text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close style presets"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <section className="rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex min-h-4 items-center gap-2 text-xs font-semibold text-black">
                      <AnimatePresence mode="wait" initial={false}>
                        {isAnalyzingStyle ? (
                          <motion.span
                            key="coffee"
                            className="flex min-w-0 items-center gap-2"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <motion.span
                              animate={{ rotate: [0, -4, 4, 0], y: [0, -1, 0] }}
                              transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
                              className="flex h-4 w-4 shrink-0 items-center justify-center"
                            >
                              <Coffee className="h-4 w-4" aria-hidden="true" />
                            </motion.span>
                            <span className="truncate">Coffee break · take a few sips</span>
                          </motion.span>
                        ) : styleAnalysisComplete ? (
                          <motion.span
                            key="complete"
                            className="flex min-w-0 items-center gap-2 text-emerald-700"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Style extracted · ready to save</span>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="extract"
                            className="flex min-w-0 items-center gap-2"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">AI cover style extraction</span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={controlsDisabled || isAnalyzingStyle}
                    onClick={() => styleAnalysisInputRef.current?.click()}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 text-xs font-semibold text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAnalyzingStyle ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isAnalyzingStyle ? "Analyzing" : "Upload"}
                  </button>
                  <input
                    ref={styleAnalysisInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void analyzeStyleCover(file);
                    }}
                  />
                </div>
                {styleAnalysisError ? (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                    {styleAnalysisError}
                  </p>
                ) : null}
              </section>
              <label className="block">
                <span className="text-xs font-semibold text-black">Preset name</span>
                <span className="relative mt-2 block">
                  <input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Preset name"
                    disabled={controlsDisabled || isAnalyzingStyle}
                    className="h-10 w-full rounded-md border border-[#E5E5E5] bg-white px-3 text-sm text-black outline-none focus:border-[#D7D7D7] disabled:opacity-60"
                  />
                  {isAnalyzingStyle ? <WaveLoadingOverlay /> : null}
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-black">Style guidance</span>
                <span className="relative mt-2 block">
                  <textarea
                    value={styleGuide}
                    onChange={(event) => setStyleGuide(event.target.value)}
                    placeholder="Describe the cover style"
                    disabled={controlsDisabled || isAnalyzingStyle}
                    rows={5}
                    className="w-full resize-none rounded-md border border-[#E5E5E5] bg-white px-3 py-3 text-sm leading-6 text-black outline-none transition placeholder:text-[#999999] focus:border-[#D7D7D7] disabled:opacity-60"
                  />
                  {isAnalyzingStyle ? <WaveLoadingOverlay /> : null}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={savePreset} disabled={controlsDisabled || isAnalyzingStyle || !styleGuide.trim()} className="flex h-10 items-center justify-center gap-2 rounded-md border border-black bg-black text-xs font-semibold text-white transition hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-60">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </button>
                <button type="button" onClick={deletePreset} disabled={controlsDisabled || isAnalyzingStyle || !selectedPresetId} className="flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 text-xs font-semibold text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CreateAvatarModal
        isOpen={isCreateAvatarOpen}
        onClose={() => setIsCreateAvatarOpen(false)}
        onAvatarCreated={handleAvatarCreated}
      />

      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onProductCreated={handleProductCreated}
      />

      {regenerateSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg border border-[#E5E5E5] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-black">Edit cover</h2>
                <p className="mt-1 text-xs text-[#666666]">{getSocialCoverLanguageOption(regenerateSlot.language).label} · {regenerateSlot.aspectRatio}</p>
              </div>
              <button type="button" onClick={() => setRegenerateSlot(null)} disabled={isRegenerating} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E5E5] text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close editor">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <textarea
                value={refinementText}
                onChange={(event) => setRefinementText(event.target.value)}
                placeholder="Describe what should change"
                disabled={isRegenerating}
                rows={5}
                className="w-full resize-none rounded-md border border-[#E5E5E5] bg-white px-3 py-3 text-sm leading-6 text-black outline-none transition placeholder:text-[#999999] focus:border-[#D7D7D7] disabled:opacity-60"
              />
              {regenerateError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{regenerateError}</p>
              ) : null}
              <button
                type="button"
                onClick={submitRegeneration}
                disabled={isRegenerating || !refinementText.trim() || accessWarning}
                className={cn(
                  "landing-press-button landing-press-button--compact flex h-11 w-full items-center justify-center gap-2 text-sm font-medium disabled:cursor-not-allowed",
                  accessWarning && "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_8px_22px_rgba(245,158,11,0.18)] hover:bg-amber-50"
                )}
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : accessWarning ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 drop-shadow-[0_0_7px_rgba(245,158,11,0.55)]" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {accessWarning ? (
                  accessWarningLabel
                ) : (
                  <>
                    <span>{isRegenerating ? "Starting..." : "Start edit"}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold leading-none">
                      <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                      {IMAGE_GENERATION_CREDIT_COST}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
