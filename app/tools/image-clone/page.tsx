"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import ToolPageShell from "@/components/tools/ToolPageShell";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Check,
  Coins,
  Copy,
  Crop,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Palette,
  PackageSearch,
  Pencil,
  Plus,
  Play,
  RefreshCw,
  Rows3,
  Sparkles,
  Type,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { getAcceptedImageFormats, validateImageFormat } from "@/lib/image-validation";
import { useI18n } from "@/providers/I18nProvider";
import { useToolUsageAccess } from "@/lib/tools/use-tool-usage-access";
import { useToolGenerationRealtime } from "@/lib/tools/use-tool-generation-realtime";
import { getToolCreditBalanceHeroState, useToolCreditBalance } from "@/lib/tools/use-tool-credit-balance";
import type { ToolGenerationJob } from "@/lib/tools/job-store";
import {
  IMAGE_GENERATION_CREDIT_COST,
  getImageGenerationCreditCost,
} from "@/lib/tools/billing-constants";
import type {
  ImageCloneBulkAspectRatio,
  ImageCloneBulkJob,
  ImageCloneBulkJobStatus,
  ImageCloneBulkResolution,
  ImageCloneBulkRow,
  ImageCloneBulkWorkbook,
} from "@/lib/image-clone-bulk-types";

type PageMode = "landing" | "quick" | "bulkParsing" | "bulkReady" | "bulkGenerating" | "bulkDone" | "error";
type QuickStatus = "idle" | "uploading" | "generating" | "success" | "error";
type UploadProgress = {
  label: string;
  percent: number;
};

const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const REQUEST_SIZE_BUFFER_BYTES = 350 * 1024;
const MAX_CLIENT_UPLOAD_SIZE_MB = 2.6;
const MAX_CLIENT_UPLOAD_DIMENSION = 2048;

const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
const RESOLUTIONS = ["1K", "2K", "4K"] as const;
const BULK_REGENERATION_ASPECT_RATIOS = ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"] as const;
const BULK_REGENERATION_RESOLUTIONS = ["1K", "2K", "4K"] as const;
const MAX_BULK_REGENERATION_LOCAL_IMAGES = 4;
const MAX_BULK_REGENERATION_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024;
const FONT_REFERENCE_INSTRUCTION =
  "Match the typography style, font weight, spacing, and text treatment of the selected font reference image while keeping the current product composition.";
const QUICK_IMAGE_CLONE_SESSION_KEY = "flowtra:image-clone:quick";

type BulkRegenerationTextBlock = {
  id: string;
  text: string;
  position: string;
  size: string;
};

type BulkRegenerationLocalImage = {
  id: string;
  fileName: string;
  dataUrl: string;
};

type BulkRegenerationModalState = {
  job: ImageCloneBulkJob;
  resultUrl: string;
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
};

type QuickImageCloneSession = {
  jobId: string | null;
  status: Extract<QuickStatus, "generating" | "success">;
  resultUrls: string[];
  productPhotoUrl?: string | null;
  referencePhotoUrl?: string | null;
  copyText?: string;
  aspectRatio?: (typeof ASPECT_RATIOS)[number];
  resolution?: (typeof RESOLUTIONS)[number];
};

function estimateDataUrlRequestSize(fileSize: number, mimeType: string) {
  const dataUrlPrefixLength = `data:${mimeType || "image/jpeg"};base64,`.length;
  const base64Size = Math.ceil(fileSize / 3) * 4;
  const jsonEnvelopeSize = 1024;
  return dataUrlPrefixLength + base64Size + jsonEnvelopeSize;
}

function allBulkRows(workbook: ImageCloneBulkWorkbook | null) {
  return workbook?.rows ?? [];
}

function statusLabel(status: ImageCloneBulkJobStatus) {
  if (status === "success") return "Ready";
  if (status === "fail") return "Failed";
  if (status === "waiting") return "Queued";
  return "Generating";
}

function isValidBulkRegenerationOutputSize(
  aspectRatio: ImageCloneBulkAspectRatio,
  resolution: ImageCloneBulkResolution
) {
  if (aspectRatio === "auto") return resolution === "1K";
  if (aspectRatio === "1:1") return resolution !== "4K";
  return true;
}

function normalizeBulkRegenerationResolution(
  aspectRatio: ImageCloneBulkAspectRatio,
  resolution: ImageCloneBulkResolution
): ImageCloneBulkResolution {
  if (aspectRatio === "auto") return "1K";
  if (aspectRatio === "1:1" && resolution === "4K") return "2K";
  return resolution;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex min-h-5 items-center justify-between">
        <span className="text-xs font-medium text-black">{label}</span>
        {required ? (
          <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#666666]">
            Required
          </span>
        ) : (
          <span className="invisible rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#666666]">
            Required
          </span>
        )}
      </div>
      <label
        className={`group relative block cursor-pointer overflow-hidden rounded-xl border border-dashed border-[#BEBEBE] bg-[#F8F8F8] transition-colors ${
          disabled || isLoading ? "pointer-events-none opacity-50" : "hover:border-black"
        }`}
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={label}
              width={400}
              height={400}
              className="aspect-square h-auto w-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex flex-col items-center gap-1 text-white">
                <Upload className="h-5 w-5" />
                <span className="text-xs font-medium">Re-upload</span>
              </div>
            </div>
            {onRemove ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                aria-label={`Remove ${label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-black" /> : <Upload className="h-5 w-5 text-black" />}
            <span className="text-xs font-medium text-black">Upload image</span>
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
    </div>
  );
}

function EntryUploadZone({
  title,
  description,
  uploadText,
  accept,
  icon: Icon,
  onFileSelect,
  disabled,
  isLoading,
  exampleAction,
}: {
  title: string;
  description: string;
  uploadText: string;
  accept: string;
  icon: LucideIcon;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  isLoading?: boolean;
  exampleAction?: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = disabled || isLoading;

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file && !isDisabled) onFileSelect(file);
      }}
      className={`relative flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-[#F8F8F8] px-5 py-6 text-center transition-colors ${
        isLoading
          ? "border-black bg-white"
          : isDragging
            ? "border-black bg-white"
            : "border-[#BEBEBE] hover:border-black"
      } ${isDisabled ? "pointer-events-none" : ""}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E5E5E5] bg-white">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-black" /> : <Icon className="h-6 w-6 text-black" />}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-black">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[#666666]">
        {description}
        <span className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-medium text-black">
          <span>{isLoading ? "Uploading..." : uploadText}</span>
          {exampleAction}
        </span>
      </p>
      <input
        type="file"
        accept={accept}
        disabled={isDisabled}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFileSelect(file);
        }}
      />
    </label>
  );
}

function BulkStatusBadge({ status }: { status: ImageCloneBulkJobStatus }) {
  const className =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "fail"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-[#E5E5E5] bg-[#F7F7F7] text-[#666666]";

  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function BulkRowPreview({ row }: { row: ImageCloneBulkRow }) {
  return (
    <article className="grid gap-4 border-b border-[#E5E5E5] px-4 py-4 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_180px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-2.5 text-xs font-medium text-black">
            <FileText className="h-3.5 w-3.5" />
            Row {row.rowNumber}
          </span>
          <span className="inline-flex h-7 items-center rounded-md border border-[#E5E5E5] bg-white px-2.5 font-mono text-xs text-[#666666]">
            {row.size || "auto"}
          </span>
          <span className="inline-flex h-7 items-center rounded-md border border-[#E5E5E5] bg-white px-2.5 font-mono text-xs text-[#666666]">
            {row.aspectRatio}
          </span>
          <span className="inline-flex h-7 items-center rounded-md border border-[#E5E5E5] bg-white px-2.5 font-mono text-xs text-[#666666]">
            {row.resolution}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <RowField label="Requirement" value={row.requirement} expandable={Boolean(row.requirement)} />
          <RowField label="Copy" value={row.copyText} expandable={Boolean(row.copyText)} />
          <RowField label="Style" value={row.style} expandable={row.style.length > 200} />
        </div>
      </div>
      <div className="flex items-start gap-2 overflow-visible xl:justify-end">
        {row.referenceImages.length ? (
          row.referenceImages.map((image) => (
            <Image
              key={image.id}
              src={image.dataUrl}
              alt={`Reference image for row ${row.rowNumber}`}
              width={80}
              height={80}
              className="h-20 w-20 rounded-md border border-[#E5E5E5] object-cover"
              unoptimized
            />
          ))
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-[#E5E5E5] bg-[#F7F7F7] text-[11px] text-[#888888]">
            No image
          </div>
        )}
      </div>
    </article>
  );
}

function RowField({ label, value, expandable = false }: { label: string; value: string; expandable?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = value || "Not provided";
  const contentClass = `${isExpanded ? "" : "line-clamp-4"} whitespace-pre-line text-sm leading-6 text-black`;

  if (expandable) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        className="min-h-28 rounded-lg border border-[#E5E5E5] bg-white p-3 text-left transition-colors hover:border-[#BEBEBE] hover:bg-[#FAFAFA]"
      >
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase text-[#666666]">
          <span className="flex-1">{label}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
        <p className={contentClass}>{content}</p>
      </button>
    );
  }

  return (
    <div className="min-h-28 rounded-lg border border-[#E5E5E5] bg-white p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase text-[#666666]">{label}</div>
      <p className={contentClass}>{content}</p>
    </div>
  );
}

function ProductContextField({ label, value }: { label: string; value: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = value || "Not provided";

  return (
    <button
      type="button"
      onClick={() => setIsExpanded((current) => !current)}
      aria-expanded={isExpanded}
      className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-left transition-colors hover:border-[#BEBEBE]"
    >
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase text-[#666666]">
        <span className="flex-1">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>
      <p className={`${isExpanded ? "" : "line-clamp-3"} whitespace-pre-line text-sm leading-5 text-black`}>
        {content}
      </p>
    </button>
  );
}

export default function ImageClonePage() {
  const { messages } = useI18n();
  const toolMessages = messages.tools.imageClone;
  const { isLoading: isToolAccessLoading, hasUnlimitedAccess } = useToolUsageAccess();
  const creditBalance = useToolCreditBalance();
  const heroCreditState = getToolCreditBalanceHeroState(creditBalance);

  const primaryButtonClass = "landing-press-button landing-press-button--compact text-sm font-medium";
  const secondaryButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-medium";

  const [pageMode, setPageMode] = useState<PageMode>("landing");
  const [quickStatus, setQuickStatus] = useState<QuickStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [productPhotoUrl, setProductPhotoUrl] = useState<string | null>(null);
  const [referencePhotoUrl, setReferencePhotoUrl] = useState<string | null>(null);
  const [copyText, setCopyText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("1:1");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("2K");
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);

  const [bulkWorkbook, setBulkWorkbook] = useState<ImageCloneBulkWorkbook | null>(null);
  const [bulkJobs, setBulkJobs] = useState<ImageCloneBulkJob[]>([]);
  const [bulkProgress, setBulkProgress] = useState<UploadProgress | null>(null);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [isBulkExampleOpen, setIsBulkExampleOpen] = useState(false);
  const bulkJobsSectionRef = useRef<HTMLElement | null>(null);

  const [regenerationModal, setRegenerationModal] = useState<BulkRegenerationModalState | null>(null);
  const [regenerationRefinement, setRegenerationRefinement] = useState("");
  const [regenerationLocalImages, setRegenerationLocalImages] = useState<BulkRegenerationLocalImage[]>([]);
  const [regenerationFontReferenceUrl, setRegenerationFontReferenceUrl] = useState<string | null>(null);
  const [isRegenerationFontPickerOpen, setIsRegenerationFontPickerOpen] = useState(false);
  const [isRegenerationEditTextMode, setIsRegenerationEditTextMode] = useState(false);
  const [regenerationTextBlocks, setRegenerationTextBlocks] = useState<BulkRegenerationTextBlock[]>([]);
  const [regenerationEditedTexts, setRegenerationEditedTexts] = useState<Record<string, string>>({});
  const [isAnalyzingRegenerationText, setIsAnalyzingRegenerationText] = useState(false);
  const [isRegeneratingBulkJob, setIsRegeneratingBulkJob] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);

  const [quickJobId, setQuickJobId] = useState<string | null>(null);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const { job: quickJob } = useToolGenerationRealtime(quickJobId);
  const { job: bulkJob, tasks: bulkTasks } = useToolGenerationRealtime(bulkJobId);

  const bulkRows = useMemo(() => allBulkRows(bulkWorkbook), [bulkWorkbook]);
  const completedBulkCount = useMemo(
    () => bulkJobs.filter((job) => job.status === "success" || job.status === "fail").length,
    [bulkJobs]
  );
  const completedRegenerationReferenceJobs = useMemo(
    () =>
      bulkJobs.filter(
        (job) => job.status === "success" && job.resultUrl && job.rowId !== regenerationModal?.job.rowId
      ),
    [bulkJobs, regenerationModal?.job.rowId]
  );
  const isQuickBusy = quickStatus === "uploading" || quickStatus === "generating";
  const isBulkBusy = pageMode === "bulkParsing" || pageMode === "bulkGenerating";

  const clearQuickSession = useCallback(() => {
    try {
      window.sessionStorage.removeItem(QUICK_IMAGE_CLONE_SESSION_KEY);
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
  }, []);

  const persistQuickSession = useCallback((session: QuickImageCloneSession) => {
    try {
      window.sessionStorage.setItem(QUICK_IMAGE_CLONE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // The generation itself should continue even if session storage quota is exhausted.
    }
  }, []);

  const resetQuickResults = useCallback(() => {
    setQuickJobId(null);
    setResultUrls([]);
    setCopiedId(null);
    setManualCopyUrl(null);
    clearQuickSession();
  }, [clearQuickSession]);

  const restoreQuickJobSnapshot = useCallback(
    (job: ToolGenerationJob) => {
      const metadata = (job.metadata ?? {}) as Record<string, unknown>;
      const productImageUrl = typeof metadata.product_image_url === "string" ? metadata.product_image_url : null;
      const referenceImageUrls = Array.isArray(metadata.reference_image_urls)
        ? metadata.reference_image_urls.filter((url): url is string => typeof url === "string")
        : [];
      const savedAspectRatio = ASPECT_RATIOS.find((ratio) => ratio === metadata.aspect_ratio);
      const savedResolution = RESOLUTIONS.find((value) => value === metadata.resolution);

      if (productImageUrl) setProductPhotoUrl(productImageUrl);
      if (referenceImageUrls[0]) setReferencePhotoUrl(referenceImageUrls[0]);
      if (savedAspectRatio) setAspectRatio(savedAspectRatio);
      if (savedResolution) setResolution(savedResolution);

      if (job.status === "completed" && job.result_url) {
        const nextResultUrls = [job.result_url];
        setResultUrls((prev) => (prev.includes(job.result_url!) ? prev : [...prev, job.result_url!]));
        setQuickStatus("success");
        setQuickJobId(null);
        persistQuickSession({
          jobId: null,
          status: "success",
          resultUrls: nextResultUrls,
          productPhotoUrl: productImageUrl,
          referencePhotoUrl: referenceImageUrls[0] ?? null,
          copyText,
          aspectRatio: savedAspectRatio ?? aspectRatio,
          resolution: savedResolution ?? resolution,
        });
      } else if (job.status === "failed") {
        setError(job.error_message || "Generation failed");
        setQuickStatus("error");
        setQuickJobId(null);
        clearQuickSession();
      } else {
        setQuickStatus("generating");
        setQuickJobId(job.id);
        persistQuickSession({
          jobId: job.id,
          status: "generating",
          resultUrls: [],
          productPhotoUrl: productImageUrl,
          referencePhotoUrl: referenceImageUrls[0] ?? null,
          copyText,
          aspectRatio: savedAspectRatio ?? aspectRatio,
          resolution: savedResolution ?? resolution,
        });
      }
    },
    [aspectRatio, clearQuickSession, copyText, persistQuickSession, resolution]
  );

  useEffect(() => {
    let isCancelled = false;

    const restoreLatestJob = async () => {
      try {
        const response = await fetch("/api/tools/jobs/latest?toolKey=image-clone&maxAgeMinutes=180");
        if (!response.ok) return;
        const payload = (await response.json()) as { job?: ToolGenerationJob | null };
        if (isCancelled || !payload.job) return;
        setPageMode("quick");
        restoreQuickJobSnapshot(payload.job);
      } catch {
        // Best-effort recovery only.
      }
    };

    try {
      const saved = window.sessionStorage.getItem(QUICK_IMAGE_CLONE_SESSION_KEY);
      if (!saved) {
        void restoreLatestJob();
        return () => {
          isCancelled = true;
        };
      }
      const session = JSON.parse(saved) as QuickImageCloneSession;
      if (session.productPhotoUrl) setProductPhotoUrl(session.productPhotoUrl);
      if (session.referencePhotoUrl) setReferencePhotoUrl(session.referencePhotoUrl);
      if (typeof session.copyText === "string") setCopyText(session.copyText);
      if (session.aspectRatio && ASPECT_RATIOS.includes(session.aspectRatio)) setAspectRatio(session.aspectRatio);
      if (session.resolution && RESOLUTIONS.includes(session.resolution)) setResolution(session.resolution);
      if (session.resultUrls.length > 0) setResultUrls(session.resultUrls);
      setPageMode("quick");
      setQuickStatus(session.status);
      if (session.jobId) setQuickJobId(session.jobId);
    } catch {
      clearQuickSession();
      void restoreLatestJob();
    }
    return () => {
      isCancelled = true;
    };
  }, [clearQuickSession, restoreQuickJobSnapshot]);

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

    const estimatedRequestSize = estimateDataUrlRequestSize(uploadFile.size, uploadFile.type || file.type || "image/jpeg");

    if (estimatedRequestSize > VERCEL_FUNCTION_BODY_LIMIT_BYTES - REQUEST_SIZE_BUFFER_BYTES) {
      const optimizedSizeMb = (uploadFile.size / 1024 / 1024).toFixed(2);
      throw new Error(
        `This image is still too large for production upload after optimization (${optimizedSizeMb} MB). Please use a smaller image or reduce the dimensions before uploading.`
      );
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(uploadFile);
    });
  }, []);

  const handleProductPhotoUpload = async (file: File) => {
    setPageMode("quick");
    setQuickStatus("uploading");
    setError(null);
    resetQuickResults();

    try {
      const imageDataUrl = await validateAndReadDataUrl(file);
      setProductPhotoUrl(imageDataUrl);
      setQuickStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image.");
      setQuickStatus("error");
    }
  };

  const handleReferencePhotoUpload = async (file: File) => {
    setPageMode("quick");
    setQuickStatus("uploading");
    setError(null);
    resetQuickResults();

    try {
      const imageDataUrl = await validateAndReadDataUrl(file);
      setReferencePhotoUrl(imageDataUrl);
      setQuickStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process reference image.");
      setQuickStatus("error");
    }
  };

  const handleLandingQuickUpload = async (file: File) => {
    setQuickStatus("uploading");
    setError(null);
    resetQuickResults();

    try {
      const imageDataUrl = await validateAndReadDataUrl(file);
      setReferencePhotoUrl(imageDataUrl);
      setProductPhotoUrl(null);
      setPageMode("quick");
      setQuickStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process competitor image.");
      setQuickStatus("error");
      setPageMode("error");
    }
  };

  const handleGenerate = async () => {
    if (!productPhotoUrl) {
      setError("Please upload a product photo first.");
      return;
    }

    setQuickStatus("generating");
    setError(null);

    try {
      if (isToolAccessLoading) {
        throw new Error("Checking subscription status. Please try again in a moment.");
      }

      if (!hasUnlimitedAccess) {
        throw new Error("An active subscription is required to use this generation tool.");
      }

      const response = await fetch("/api/tools/image-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          productPhotoDataUrl: productPhotoUrl,
          referencePhotoDataUrls: referencePhotoUrl ? [referencePhotoUrl] : [],
          copyText,
          aspectRatio,
          resolution,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation.");
      }

      setQuickJobId(data.jobId);
      persistQuickSession({
        jobId: data.jobId,
        status: "generating",
        resultUrls: [],
        copyText,
        aspectRatio,
        resolution,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image.");
      setQuickStatus("error");
    }
  };

  const parseBulkWorkbook = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please upload a .xlsx file.");
      setPageMode("error");
      return;
    }

    setBulkFileName(file.name);
    setBulkWorkbook(null);
    setBulkJobs([]);
    setError(null);
    setPageMode("bulkParsing");
    setBulkProgress({ label: "Preparing workbook", percent: 8 });

    const payload = await new Promise<ImageCloneBulkWorkbook>((resolve, reject) => {
      const formData = new FormData();
      formData.set("file", file);
      const request = new XMLHttpRequest();

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          setBulkProgress({ label: "Uploading workbook", percent: 38 });
          return;
        }
        const uploadPercent = Math.round((event.loaded / event.total) * 62);
        setBulkProgress({ label: "Uploading workbook", percent: Math.min(70, Math.max(12, uploadPercent)) });
      };
      request.upload.onload = () => setBulkProgress({ label: "Reading workbook contents", percent: 76 });
      request.onload = () => {
        try {
          const responsePayload = JSON.parse(request.responseText || "{}");
          if (request.status < 200 || request.status >= 300) {
            reject(new Error(responsePayload.error || "Failed to parse workbook."));
            return;
          }
          setBulkProgress({ label: "Organizing rows and images", percent: 92 });
          resolve(responsePayload as ImageCloneBulkWorkbook);
        } catch {
          reject(new Error("Failed to read parser response."));
        }
      };
      request.onerror = () => reject(new Error("Workbook upload failed."));
      request.onabort = () => reject(new Error("Workbook upload was cancelled."));
      request.open("POST", "/api/tools/image-clone/bulk/parse");
      request.send(formData);
    });

    setBulkWorkbook(payload);
    setPageMode("bulkReady");
    setBulkProgress({ label: "Workbook ready", percent: 100 });
    window.setTimeout(() => setBulkProgress(null), 900);
  }, []);

  const handleBulkFile = (file: File) => {
    parseBulkWorkbook(file).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to parse workbook.");
      setBulkProgress(null);
      setPageMode("error");
    });
  };

  const resetRegenerationState = useCallback(() => {
    setRegenerationRefinement("");
    setRegenerationLocalImages([]);
    setRegenerationFontReferenceUrl(null);
    setIsRegenerationFontPickerOpen(false);
    setIsRegenerationEditTextMode(false);
    setRegenerationTextBlocks([]);
    setRegenerationEditedTexts({});
    setRegenerationError(null);
  }, []);

  const openRegenerationModal = useCallback(
    (job: ImageCloneBulkJob) => {
      if (!job.resultUrl) return;
      resetRegenerationState();
      setRegenerationModal({
        job,
        resultUrl: job.resultUrl,
        aspectRatio: job.aspectRatio,
        resolution: job.resolution,
      });
    },
    [resetRegenerationState]
  );

  const closeRegenerationModal = useCallback(() => {
    setRegenerationModal(null);
    resetRegenerationState();
  }, [resetRegenerationState]);

  const readBulkRegenerationLocalImage = async (file: File) => {
    const formatCheck = validateImageFormat(file);
    if (!formatCheck.isValid) throw new Error(formatCheck.error);
    if (file.size > MAX_BULK_REGENERATION_LOCAL_IMAGE_BYTES) {
      throw new Error("Each local reference image must be 10 MB or smaller.");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read reference image."));
      reader.readAsDataURL(file);
    });

    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      dataUrl,
    } satisfies BulkRegenerationLocalImage;
  };

  const handleBulkRegenerationLocalImages = async (files: FileList | File[]) => {
    setRegenerationError(null);
    const nextFiles = Array.from(files);
    if (regenerationLocalImages.length + nextFiles.length > MAX_BULK_REGENERATION_LOCAL_IMAGES) {
      setRegenerationError(`Upload up to ${MAX_BULK_REGENERATION_LOCAL_IMAGES} local reference images.`);
      return;
    }

    try {
      const images = await Promise.all(nextFiles.map(readBulkRegenerationLocalImage));
      setRegenerationLocalImages((current) => [...current, ...images]);
    } catch (err) {
      setRegenerationError(err instanceof Error ? err.message : "Failed to read reference images.");
    }
  };

  const analyzeRegenerationImageText = async () => {
    if (!regenerationModal?.resultUrl) return;
    setIsAnalyzingRegenerationText(true);
    setRegenerationError(null);
    try {
      const response = await fetch("/api/tools/image-clone/bulk/analyze-image-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: regenerationModal.resultUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to analyze image text.");
      const textBlocks = (payload.textBlocks ?? []) as BulkRegenerationTextBlock[];
      setRegenerationTextBlocks(textBlocks);
      setRegenerationEditedTexts(
        Object.fromEntries(textBlocks.map((block) => [block.id, block.text]))
      );
      setIsRegenerationEditTextMode(true);
      if (!textBlocks.length) setRegenerationError("No editable English text was found.");
    } catch (err) {
      setRegenerationError(err instanceof Error ? err.message : "Failed to analyze image text.");
    } finally {
      setIsAnalyzingRegenerationText(false);
    }
  };

  const submitBulkRegeneration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!regenerationModal) return;

    const sizeChanged =
      regenerationModal.aspectRatio !== regenerationModal.job.aspectRatio ||
      regenerationModal.resolution !== regenerationModal.job.resolution;
    const changedTextBlocks = regenerationTextBlocks.filter(
      (block) => (regenerationEditedTexts[block.id] ?? block.text).trim() !== block.text.trim()
    );

    let refinement = regenerationRefinement.trim();
    if (isRegenerationEditTextMode && changedTextBlocks.length) {
      const textInstructions = changedTextBlocks
        .map((block) => `Change "${block.text}" to "${(regenerationEditedTexts[block.id] ?? "").trim()}"`)
        .join("\n");
      refinement = [refinement, `Edit visible text:\n${textInstructions}`].filter(Boolean).join("\n\n");
    }
    if (regenerationFontReferenceUrl) {
      refinement = [refinement, FONT_REFERENCE_INSTRUCTION].filter(Boolean).join("\n\n");
    }
    if (!refinement && regenerationLocalImages.length) {
      refinement = "Use the uploaded local reference images to improve the generated ecommerce image while preserving the product identity.";
    }
    if (!refinement && sizeChanged) {
      refinement = "Keep the same design and product presentation while adapting the output size.";
    }

    if (!refinement) {
      setRegenerationError(
        isRegenerationEditTextMode
          ? "Change at least one text line, add a reference image, or change output size."
          : "Add refinement text, a reference image, or change output size."
      );
      return;
    }

    if (!isValidBulkRegenerationOutputSize(regenerationModal.aspectRatio, regenerationModal.resolution)) {
      setRegenerationError("This output size combination is not supported.");
      return;
    }

    setIsRegeneratingBulkJob(true);
    setRegenerationError(null);
    try {
      if (isToolAccessLoading) {
        throw new Error("Checking subscription status. Please try again in a moment.");
      }

      if (!hasUnlimitedAccess) {
        throw new Error("An active subscription is required to use this generation tool.");
      }

      const response = await fetch("/api/tools/image-clone/bulk/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: regenerationModal.job,
          resultUrl: regenerationModal.resultUrl,
          refinement,
          localImages: regenerationLocalImages.map((image) => ({
            fileName: image.fileName,
            dataUrl: image.dataUrl,
          })),
          fontReferenceUrl: regenerationFontReferenceUrl,
          aspectRatio: regenerationModal.aspectRatio,
          resolution: regenerationModal.resolution,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to start regeneration.");
      const replacementJob = payload.job as ImageCloneBulkJob;
      if (payload.jobId) setBulkJobId(payload.jobId);
      setBulkJobs((jobs) => jobs.map((job) => (job.rowId === replacementJob.rowId ? replacementJob : job)));
      setRegenerationModal({
        job: replacementJob,
        resultUrl: regenerationModal.resultUrl,
        aspectRatio: replacementJob.aspectRatio,
        resolution: replacementJob.resolution,
      });
      setPageMode("bulkGenerating");
    } catch (err) {
      setRegenerationError(err instanceof Error ? err.message : "Failed to start regeneration.");
    } finally {
      setIsRegeneratingBulkJob(false);
    }
  };

  const startBulkGeneration = async () => {
    if (!bulkWorkbook?.workbookId) return;
    if (!bulkRows.length) {
      setError("No generation rows are available.");
      return;
    }

    setPageMode("bulkGenerating");
    setError(null);
    setBulkJobs(
      bulkRows.map((row) => ({
        rowId: row.id,
        rowNumber: row.rowNumber,
        sequence: row.sequence,
        taskId: "",
        status: "processing",
        prompt: "",
        aspectRatio: row.aspectRatio,
        resolution: row.resolution,
        sourceRow: row.source,
      }))
    );

    try {
      if (isToolAccessLoading) {
        throw new Error("Checking subscription status. Please try again in a moment.");
      }

      if (!hasUnlimitedAccess) {
        throw new Error("An active subscription is required to use this generation tool.");
      }

      const response = await fetch("/api/tools/image-clone/bulk/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbookId: bulkWorkbook.workbookId,
          rowIds: bulkRows.map((row) => row.id),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to start generation.");
      setBulkJobs(payload.jobs);
      setBulkJobId(payload.jobId);
      if (payload.jobs.every((job: ImageCloneBulkJob) => job.status === "success" || job.status === "fail")) {
        setPageMode("bulkDone");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation.");
      setBulkJobs((jobs) =>
        jobs.map((job) =>
          job.status === "processing" && !job.taskId
            ? { ...job, status: "fail", error: err instanceof Error ? err.message : "Failed to start generation." }
            : job
        )
      );
      setPageMode("bulkReady");
    }
  };

  useEffect(() => {
    if (pageMode !== "bulkGenerating" || bulkJobs.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      bulkJobsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bulkJobs.length, pageMode]);

  // React to quick job completion via Realtime
  useEffect(() => {
    if (!quickJob) return;
    restoreQuickJobSnapshot(quickJob);
  }, [quickJob, restoreQuickJobSnapshot]);

  // React to bulk job/task changes via Realtime
  useEffect(() => {
    if (!bulkJob || !bulkTasks.length) return;
    setBulkJobs((currentJobs) => {
      const nextJobs = currentJobs.map((job) => {
        if (job.status === 'success' || job.status === 'fail') return job;
        const task = bulkTasks.find((t) => t.kie_task_id === job.taskId);
        if (!task) return job;
        const newStatus = task.status === 'completed' ? 'success' : task.status === 'failed' ? 'fail' : job.status === 'processing' && task.status === 'processing' ? 'processing' : 'waiting';
        return {
          ...job,
          status: newStatus,
          resultUrl: task.result_url ?? job.resultUrl,
          error: task.error_message ?? job.error,
        } as ImageCloneBulkJob;
      });

      if (nextJobs.every((job) => job.status === "success" || job.status === "fail")) {
        setPageMode("bulkDone");
      }

      return nextJobs;
    });

    setRegenerationModal((current) => {
      if (!current) return current;
      const task = bulkTasks.find((t) => t.kie_task_id === current.job.taskId);
      if (!task) return current;
      const updatedJob = {
        ...current.job,
        status: task.status === 'completed' ? 'success' : task.status === 'failed' ? 'fail' : current.job.status,
        resultUrl: task.result_url ?? current.job.resultUrl,
        error: task.error_message ?? current.job.error,
      } as ImageCloneBulkJob;
      return {
        ...current,
        job: updatedJob,
        resultUrl: updatedJob.resultUrl ?? current.resultUrl,
        aspectRatio: updatedJob.aspectRatio,
        resolution: updatedJob.resolution,
      };
    });
  }, [bulkJob, bulkTasks]);

  const handleCopyUrl = async (url: string, id: string) => {
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
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        copyWithTextarea();
      }
      setCopiedId(id);
      setManualCopyUrl(null);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      try {
        copyWithTextarea();
        setCopiedId(id);
        setManualCopyUrl(null);
        setTimeout(() => setCopiedId(null), 1200);
      } catch {
        setManualCopyUrl(url);
      }
    }
  };

  const resetToLanding = () => {
    setPageMode("landing");
    setQuickStatus("idle");
    setError(null);
    setQuickJobId(null);
    setBulkJobId(null);
    clearQuickSession();
  };

  return (
    <>
      <ToolPageShell
        eyebrow={toolMessages.eyebrow}
        title="Image Clone"
        description="Clone one ecommerce image quickly, or upload a workbook to generate a batch."
        statusLabel={heroCreditState.label}
        statusTone={heroCreditState.tone}
      >

          {pageMode === "landing" ? (
            <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)]">
              <EntryUploadZone
                title="Quick Clone"
                description="Upload one competitor image to start."
                uploadText="Drop or click to upload image"
                accept={getAcceptedImageFormats()}
                icon={Sparkles}
                onFileSelect={handleLandingQuickUpload}
                isLoading={quickStatus === "uploading"}
              />
              <div className="flex items-center justify-center">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E5E5E5] bg-white px-2 text-[11px] font-medium uppercase text-[#888888]">
                  OR
                </span>
              </div>
              <EntryUploadZone
                title="Bulk Clone"
                description="Upload a workbook to generate multiple ecommerce images."
                uploadText="Drop or click to upload XLSX"
                accept=".xlsx"
                icon={FileSpreadsheet}
                onFileSelect={handleBulkFile}
                exampleAction={
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsBulkExampleOpen(true);
                    }}
                    className="relative z-10 text-xs font-semibold text-[#666666] underline decoration-[#BEBEBE] underline-offset-4 hover:text-black"
                  >
                    Example
                  </button>
                }
              />
            </div>
          ) : null}

          {pageMode === "quick" ? (
            <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:p-6">
              <button type="button" onClick={resetToLanding} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#666666] hover:text-black">
                <ArrowLeft className="h-4 w-4" />
                Back to tool options
              </button>
              <div className="grid items-stretch gap-6 lg:grid-cols-2">
                <div className="grid h-full grid-cols-2 items-start gap-3">
                  <ImageSlotCard
                    label="Your Product"
                    imageUrl={productPhotoUrl}
                    isLoading={quickStatus === "uploading"}
                    onFileSelect={handleProductPhotoUpload}
                    onRemove={
                      productPhotoUrl
                        ? () => {
                            setProductPhotoUrl(null);
                            resetQuickResults();
                          }
                        : undefined
                    }
                    disabled={isQuickBusy}
                    required
                  />
                  <ImageSlotCard
                    label="Competitor Ref"
                    imageUrl={referencePhotoUrl}
                    isLoading={quickStatus === "uploading"}
                    onFileSelect={handleReferencePhotoUpload}
                    onRemove={
                      referencePhotoUrl
                        ? () => {
                            setReferencePhotoUrl(null);
                            resetQuickResults();
                          }
                        : undefined
                    }
                    disabled={isQuickBusy}
                  />
                </div>

                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="flex min-h-[180px] flex-1 flex-col">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black">
                      <Type className="h-3.5 w-3.5" />
                      {toolMessages.copyTextLabel}
                    </label>
                    <textarea
                      value={copyText}
                      onChange={(event) => setCopyText(event.target.value)}
                      placeholder={toolMessages.copyTextPlaceholder}
                      disabled={isQuickBusy}
                      className="w-full flex-1 resize-none rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] px-3 py-2 text-sm text-black placeholder-[#888888] focus:border-[#D7D7D7] focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                        <Crop className="h-3.5 w-3.5" />
                        {toolMessages.aspectRatioLabel}
                      </div>
                      <div className="relative flex rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-0.5">
                        <div
                          className="absolute top-0.5 h-[calc(100%-4px)] rounded-lg bg-white shadow-sm transition-all duration-200"
                          style={{
                            left: "2px",
                            width: `calc(${100 / ASPECT_RATIOS.length}% - 4px)`,
                            transform: `translateX(calc(${ASPECT_RATIOS.indexOf(aspectRatio)} * (100% + 4px)))`,
                          }}
                        />
                        {ASPECT_RATIOS.map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatio(ratio)}
                            disabled={isQuickBusy}
                            className="relative z-10 flex-1 py-1.5 text-xs font-medium text-black"
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:w-36">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {toolMessages.resolutionLabel}
                      </div>
                      <div className="relative flex rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-0.5">
                        <div
                          className="absolute top-0.5 h-[calc(100%-4px)] rounded-lg bg-white shadow-sm transition-all duration-200"
                          style={{
                            left: "2px",
                            width: `calc(${100 / RESOLUTIONS.length}% - 4px)`,
                            transform: `translateX(calc(${RESOLUTIONS.indexOf(resolution)} * (100% + 4px)))`,
                          }}
                        />
                        {RESOLUTIONS.map((res) => (
                          <button
                            key={res}
                            type="button"
                            onClick={() => setResolution(res)}
                            disabled={isQuickBusy}
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
                    disabled={isQuickBusy || isToolAccessLoading || !productPhotoUrl}
                    className={`landing-press-button w-full justify-center text-sm font-medium ${primaryButtonClass} ${
                      isQuickBusy || isToolAccessLoading || !productPhotoUrl ? "opacity-50" : ""
                    }`}
                  >
                    {isQuickBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {toolMessages.generating}
                        <span className="inline-flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {IMAGE_GENERATION_CREDIT_COST}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Generate Image</span>
                        <span className="inline-flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {IMAGE_GENERATION_CREDIT_COST}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error ? <ErrorBanner message={error} /> : null}
              <QuickResults
                status={quickStatus}
                resultUrls={resultUrls}
                copiedId={copiedId}
                manualCopyUrl={manualCopyUrl}
                primaryButtonClass={primaryButtonClass}
                secondaryButtonClass={secondaryButtonClass}
                onCopyUrl={handleCopyUrl}
              />
            </section>
          ) : null}

          {pageMode === "bulkParsing" ? <BulkParsingPanel progress={bulkProgress} fileName={bulkFileName} /> : null}

          {(pageMode === "bulkReady" || pageMode === "bulkGenerating" || pageMode === "bulkDone") && bulkWorkbook ? (
            <BulkWorkspace
              workbook={bulkWorkbook}
              rows={bulkRows}
              jobs={bulkJobs}
              completedCount={completedBulkCount}
              isBusy={isBulkBusy}
              error={error}
              primaryButtonClass={primaryButtonClass}
              secondaryButtonClass={secondaryButtonClass}
              onBack={resetToLanding}
              onStartGeneration={() => {
                void startBulkGeneration();
              }}
              onReparse={handleBulkFile}
              onOpenRegenerate={openRegenerationModal}
              isAccessLoading={isToolAccessLoading}
              jobsSectionRef={bulkJobsSectionRef}
            />
          ) : null}

          {pageMode === "error" ? (
            <section className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <h2 className="mt-4 text-xl font-semibold text-black">Something went wrong</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#666666]">{error || "Please try again."}</p>
              <button type="button" onClick={resetToLanding} className={`${primaryButtonClass} mt-6 justify-center`}>
                Back to tool options
              </button>
            </section>
          ) : null}
      </ToolPageShell>
      {isBulkExampleOpen ? (
        <BulkWorkbookExampleModal
          secondaryButtonClass={secondaryButtonClass}
          onClose={() => setIsBulkExampleOpen(false)}
        />
      ) : null}
      {regenerationModal ? (
        <BulkRegenerationModal
          modal={regenerationModal}
          refinement={regenerationRefinement}
          localImages={regenerationLocalImages}
          fontReferenceUrl={regenerationFontReferenceUrl}
          isFontPickerOpen={isRegenerationFontPickerOpen}
          isEditTextMode={isRegenerationEditTextMode}
          textBlocks={regenerationTextBlocks}
          editedTexts={regenerationEditedTexts}
          referenceJobs={completedRegenerationReferenceJobs}
          isAnalyzingText={isAnalyzingRegenerationText}
          isRegenerating={isRegeneratingBulkJob}
          isAccessLoading={isToolAccessLoading}
          error={regenerationError}
          primaryButtonClass={primaryButtonClass}
          secondaryButtonClass={secondaryButtonClass}
          onClose={closeRegenerationModal}
          onSubmit={submitBulkRegeneration}
          onRefinementChange={setRegenerationRefinement}
          onLocalImagesAdd={(files) => {
            void handleBulkRegenerationLocalImages(files);
          }}
          onLocalImageRemove={(imageId) =>
            setRegenerationLocalImages((images) => images.filter((image) => image.id !== imageId))
          }
          onFontPickerToggle={() => setIsRegenerationFontPickerOpen((current) => !current)}
          onFontReferenceChange={setRegenerationFontReferenceUrl}
          onEditTextModeChange={setIsRegenerationEditTextMode}
          onAnalyzeText={() => {
            void analyzeRegenerationImageText();
          }}
          onEditedTextChange={(id, value) =>
            setRegenerationEditedTexts((current) => ({ ...current, [id]: value }))
          }
          onAspectRatioChange={(nextAspectRatio) =>
            setRegenerationModal((current) =>
              current
                ? {
                    ...current,
                    aspectRatio: nextAspectRatio,
                    resolution: normalizeBulkRegenerationResolution(nextAspectRatio, current.resolution),
                  }
                : current
            )
          }
          onResolutionChange={(nextResolution) =>
            setRegenerationModal((current) =>
              current && isValidBulkRegenerationOutputSize(current.aspectRatio, nextResolution)
                ? { ...current, resolution: nextResolution }
                : current
            )
          }
        />
      ) : null}
    </>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</div>;
}

function BulkWorkbookExampleModal({
  secondaryButtonClass,
  onClose,
}: {
  secondaryButtonClass: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sheet1Rows = [
    {
      size: "1080x1080",
      requirement: "Create a clean square hero image for a wireless charger.",
      copy: "Fast wireless charging for every desk.",
      style: "Minimal studio lighting",
    },
    {
      size: "1080x1920",
      requirement: "Make a vertical ecommerce story image with product benefits.",
      copy: "Charge faster. Pack lighter.",
      style: "Premium lifestyle",
    },
    {
      size: "1200x1600",
      requirement: "Show the product with gift-ready packaging and soft shadows.",
      copy: "A smarter everyday essential.",
      style: "Editorial product shot",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-black">Example workbook</h2>
            <p className="mt-1 text-xs text-[#666666]">Use this structure for bulk ecommerce image cloning.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] text-[#666666] hover:border-black hover:text-black"
            aria-label="Close example workbook"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <section className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="flex items-center gap-2 border-b border-[#E5E5E5] bg-white px-4 py-3">
              <FileSpreadsheet className="h-4 w-4 text-[#666666]" />
              <h3 className="text-sm font-semibold text-black">Sheet1</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[11px] uppercase text-[#666666]">
                    {["size", "requirement", "reference image", "copy", "style"].map((header) => (
                      <th key={header} className="border-r border-[#E5E5E5] px-3 py-2 font-semibold last:border-r-0">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white text-black">
                  {sheet1Rows.map((row) => (
                    <tr key={row.size + row.copy} className="border-b border-[#E5E5E5] last:border-b-0">
                      <td className="border-r border-[#E5E5E5] px-3 py-3 font-mono">{row.size}</td>
                      <td className="max-w-[240px] border-r border-[#E5E5E5] px-3 py-3 leading-5">{row.requirement}</td>
                      <td className="border-r border-[#E5E5E5] px-3 py-3">
                        <ExampleImageCell />
                      </td>
                      <td className="max-w-[180px] border-r border-[#E5E5E5] px-3 py-3 leading-5">{row.copy}</td>
                      <td className="max-w-[160px] px-3 py-3 leading-5">{row.style}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="flex items-center gap-2 border-b border-[#E5E5E5] bg-white px-4 py-3">
              <FileText className="h-4 w-4 text-[#666666]" />
              <h3 className="text-sm font-semibold text-black">Sheet2</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[11px] uppercase text-[#666666]">
                    {["title", "description", "image"].map((header) => (
                      <th key={header} className="border-r border-[#E5E5E5] px-3 py-2 font-semibold last:border-r-0">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white text-black">
                  <tr>
                    <td className="max-w-[220px] border-r border-[#E5E5E5] px-3 py-3 leading-5">Aurora Wireless Charger</td>
                    <td className="max-w-[360px] border-r border-[#E5E5E5] px-3 py-3 leading-5">
                      A compact fast-charging dock with a matte aluminum body, magnetic alignment, and travel-friendly cable storage.
                    </td>
                    <td className="px-3 py-3">
                      <ExampleImageCell />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-[#E5E5E5] px-5 py-4">
          <button type="button" onClick={onClose} className={`${secondaryButtonClass} justify-center`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ExampleImageCell() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-[#BEBEBE] bg-[#F7F7F7] text-[10px] font-medium uppercase text-[#888888]">
      image
    </div>
  );
}

function BulkRegenerationModal({
  modal,
  refinement,
  localImages,
  fontReferenceUrl,
  isFontPickerOpen,
  isEditTextMode,
  textBlocks,
  editedTexts,
  referenceJobs,
  isAnalyzingText,
  isRegenerating,
  isAccessLoading,
  error,
  primaryButtonClass,
  secondaryButtonClass,
  onClose,
  onSubmit,
  onRefinementChange,
  onLocalImagesAdd,
  onLocalImageRemove,
  onFontPickerToggle,
  onFontReferenceChange,
  onEditTextModeChange,
  onAnalyzeText,
  onEditedTextChange,
  onAspectRatioChange,
  onResolutionChange,
}: {
  modal: BulkRegenerationModalState;
  refinement: string;
  localImages: BulkRegenerationLocalImage[];
  fontReferenceUrl: string | null;
  isFontPickerOpen: boolean;
  isEditTextMode: boolean;
  textBlocks: BulkRegenerationTextBlock[];
  editedTexts: Record<string, string>;
  referenceJobs: ImageCloneBulkJob[];
  isAnalyzingText: boolean;
  isRegenerating: boolean;
  isAccessLoading: boolean;
  error: string | null;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRefinementChange: (value: string) => void;
  onLocalImagesAdd: (files: FileList | File[]) => void;
  onLocalImageRemove: (imageId: string) => void;
  onFontPickerToggle: () => void;
  onFontReferenceChange: (url: string | null) => void;
  onEditTextModeChange: (value: boolean) => void;
  onAnalyzeText: () => void;
  onEditedTextChange: (id: string, value: string) => void;
  onAspectRatioChange: (value: ImageCloneBulkAspectRatio) => void;
  onResolutionChange: (value: ImageCloneBulkResolution) => void;
}) {
  const isOutputSizeValid = isValidBulkRegenerationOutputSize(modal.aspectRatio, modal.resolution);
  const isGenerating = modal.job.status === "waiting" || modal.job.status === "processing" || isRegenerating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-black">Regenerate row {modal.job.rowNumber}</h2>
            <p className="mt-1 text-xs text-[#666666]">{statusLabel(modal.job.status)} · {modal.aspectRatio} · {modal.resolution}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] text-[#666666] hover:border-black hover:text-black"
            aria-label="Close regeneration modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="border-b border-[#E5E5E5] bg-[#FAFAFA] p-5 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
              {modal.job.status === "fail" ? (
                <div className="flex aspect-square items-center justify-center p-6 text-center text-sm text-red-600">
                  {modal.job.error || "Regeneration failed."}
                </div>
              ) : modal.job.resultUrl ? (
                <Image
                  src={modal.job.resultUrl}
                  alt={`Regenerated image for row ${modal.job.rowNumber}`}
                  width={640}
                  height={640}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              ) : isGenerating ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-3 text-sm text-[#666666]">
                  <Loader2 className="h-6 w-6 animate-spin text-black" />
                  Generating replacement...
                </div>
              ) : (
                <Image
                  src={modal.resultUrl}
                  alt={`Current image for row ${modal.job.rowNumber}`}
                  width={640}
                  height={640}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <JobDetail label="Task ID" value={modal.job.taskId || "Not created"} icon={FileText} />
              <JobDetail label="Status" value={statusLabel(modal.job.status)} icon={RefreshCw} />
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditTextModeChange(false)}
                className={`${!isEditTextMode ? primaryButtonClass : secondaryButtonClass} h-9 justify-center text-xs`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Prompt
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!textBlocks.length) onAnalyzeText();
                  onEditTextModeChange(true);
                }}
                className={`${isEditTextMode ? primaryButtonClass : secondaryButtonClass} h-9 justify-center text-xs`}
              >
                {isAnalyzingText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
                Edit Text
              </button>
              <button
                type="button"
                onClick={onFontPickerToggle}
                className={`${fontReferenceUrl ? primaryButtonClass : secondaryButtonClass} h-9 justify-center text-xs`}
              >
                <Palette className="h-3.5 w-3.5" />
                Font Reference
              </button>
            </div>

            {!isEditTextMode ? (
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                  <Pencil className="h-3.5 w-3.5" />
                  Prompt refinement
                </label>
                <textarea
                  value={refinement}
                  onChange={(event) => onRefinementChange(event.target.value)}
                  disabled={isRegenerating}
                  placeholder="Describe what to change in this generated image."
                  className="min-h-32 w-full resize-none rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] px-3 py-2 text-sm leading-6 text-black placeholder-[#888888] focus:border-[#D7D7D7] focus:outline-none disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-black">Visible text</div>
                  <button
                    type="button"
                    onClick={onAnalyzeText}
                    disabled={isAnalyzingText || isRegenerating}
                    className={`${secondaryButtonClass} h-8 justify-center text-[11px]`}
                  >
                    {isAnalyzingText ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Analyze
                  </button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {textBlocks.length ? (
                    textBlocks.map((block) => (
                      <div key={block.id} className="rounded-lg border border-[#E5E5E5] bg-white p-2">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase text-[#666666]">
                          <span>{block.position}</span>
                          <span>{block.size}</span>
                        </div>
                        <input
                          value={editedTexts[block.id] ?? block.text}
                          onChange={(event) => onEditedTextChange(block.id, event.target.value)}
                          disabled={isRegenerating}
                          className="h-9 w-full rounded-md border border-[#E5E5E5] bg-[#F8F8F8] px-2 text-sm text-black focus:border-[#D7D7D7] focus:outline-none"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#E5E5E5] bg-white px-3 py-6 text-center text-xs text-[#888888]">
                      Analyze the image to edit English text.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                <ImageIcon className="h-3.5 w-3.5" />
                Local references
              </div>
              <div className="flex flex-wrap gap-2">
                {localImages.map((image) => (
                  <div key={image.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7]">
                    <Image src={image.dataUrl} alt={image.fileName} width={96} height={96} className="h-full w-full object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => onLocalImageRemove(image.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove local reference"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {localImages.length < MAX_BULK_REGENERATION_LOCAL_IMAGES ? (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#BEBEBE] bg-[#F8F8F8] text-[11px] font-medium text-black hover:border-black">
                    <Plus className="h-4 w-4" />
                    Add
                    <input
                      type="file"
                      accept={getAcceptedImageFormats()}
                      multiple
                      disabled={isRegenerating}
                      className="sr-only"
                      onChange={(event) => {
                        const files = event.target.files;
                        event.target.value = "";
                        if (files) onLocalImagesAdd(files);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {isFontPickerOpen ? (
              <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                <div className="mb-2 text-xs font-medium text-black">Font reference</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => onFontReferenceChange(null)}
                    className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border text-[11px] ${
                      !fontReferenceUrl ? "border-black bg-white text-black" : "border-[#E5E5E5] bg-white text-[#666666]"
                    }`}
                  >
                    None
                  </button>
                  {referenceJobs.map((job) => (
                    <button
                      key={job.rowId}
                      type="button"
                      onClick={() => onFontReferenceChange(job.resultUrl ?? null)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border ${
                        fontReferenceUrl === job.resultUrl ? "border-black" : "border-[#E5E5E5]"
                      }`}
                    >
                      {job.resultUrl ? (
                        <Image src={job.resultUrl} alt={`Font reference row ${job.rowNumber}`} width={96} height={96} className="h-full w-full object-cover" unoptimized />
                      ) : null}
                      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[10px] text-black">Row {job.rowNumber}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                  <Crop className="h-3.5 w-3.5" />
                  Aspect ratio
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-1">
                  {BULK_REGENERATION_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => onAspectRatioChange(ratio)}
                      disabled={isRegenerating}
                      className={`h-8 rounded-lg text-xs font-medium ${
                        modal.aspectRatio === ratio ? "bg-black text-white" : "text-black hover:bg-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-black">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Resolution
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#E5E5E5] bg-[#F8F8F8] p-1">
                  {BULK_REGENERATION_RESOLUTIONS.map((res) => {
                    const disabled = isRegenerating || !isValidBulkRegenerationOutputSize(modal.aspectRatio, res);
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => onResolutionChange(res)}
                        disabled={disabled}
                        className={`h-8 rounded-lg text-xs font-medium ${
                          modal.resolution === res ? "bg-black text-white" : "text-black hover:bg-white"
                        } ${disabled ? "opacity-40" : ""}`}
                      >
                        {res}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {!isOutputSizeValid ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                This output size combination is not supported.
              </div>
            ) : null}
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#E5E5E5] px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={`${secondaryButtonClass} justify-center`}>
            Close
          </button>
          <button
            type="submit"
            disabled={isGenerating || isAccessLoading || !isOutputSizeValid}
            className={`${primaryButtonClass} justify-center ${isGenerating || isAccessLoading || !isOutputSizeValid ? "opacity-50" : ""}`}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Regenerate</span>
            <span className="inline-flex items-center gap-1">
              <Coins className="h-4 w-4" />
              {IMAGE_GENERATION_CREDIT_COST}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function QuickResults({
  status,
  resultUrls,
  copiedId,
  manualCopyUrl,
  primaryButtonClass,
  secondaryButtonClass,
  onCopyUrl,
}: {
  status: QuickStatus;
  resultUrls: string[];
  copiedId: string | null;
  manualCopyUrl: string | null;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onCopyUrl: (url: string, id: string) => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
      {(status === "generating" || resultUrls.length > 0) && (
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-black">
          <ImageIcon className="h-4 w-4" />
          Generated Image
        </h2>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {status === "generating" ? (
          <div className="rounded-xl border border-[#E3E3E3] bg-white p-1.5">
            <div className="relative overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8]">
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.85)_50%,transparent_100%)] bg-[length:200%_100%]" />
              <div className="aspect-square w-full bg-[#F8F8F8]" />
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px] text-[#888888]">Generating...</span>
            </div>
          </div>
        ) : null}
        {resultUrls.map((url, index) => (
          <div key={`${url}-${index}`} className="rounded-xl border border-[#E3E3E3] bg-white p-1.5">
            <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F8F8F8]">
              <Image src={url} alt={`Result ${index + 1}`} width={400} height={400} className="h-auto w-full object-cover" unoptimized />
            </div>
            <div className="mt-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => onCopyUrl(url, `${index}`)}
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
      {manualCopyUrl ? (
        <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#666666]">
          <p className="mb-1">Browser blocked clipboard access. Select and copy this URL:</p>
          <input
            readOnly
            value={manualCopyUrl}
            className="w-full rounded-md border border-[#E5E5E5] bg-[#F8F8F8] px-2 py-1 font-mono text-[11px] text-black"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
      {status !== "generating" && resultUrls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ImageIcon className="mb-2 h-8 w-8 text-[#CCCCCC]" />
          <p className="text-sm text-[#888888]">Result will appear here</p>
        </div>
      ) : null}
    </div>
  );
}

function BulkParsingPanel({ progress, fileName }: { progress: UploadProgress | null; fileName: string | null }) {
  const currentProgress = progress ?? { label: "Preparing workbook", percent: 8 };

  return (
    <section className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#E5E5E5] bg-white px-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7] text-black">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="mt-5 text-base font-semibold text-black">{currentProgress.label}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#666666]">
          {fileName ? `Parsing ${fileName}.` : "Extracting product details, row instructions, and reference images."}
        </p>
        <div className="mt-6 w-full">
          <div className="mb-2 flex items-center justify-between text-xs text-[#666666]">
            <span>Working on your file</span>
            <span className="font-mono">{currentProgress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F1F1F1]">
            <div className="h-full rounded-full bg-black transition-[width] duration-300 ease-out" style={{ width: `${currentProgress.percent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BulkWorkspace({
  workbook,
  rows,
  jobs,
  completedCount,
  isBusy,
  error,
  primaryButtonClass,
  secondaryButtonClass,
  onBack,
  onStartGeneration,
  onReparse,
  onOpenRegenerate,
  isAccessLoading,
  jobsSectionRef,
}: {
  workbook: ImageCloneBulkWorkbook;
  rows: ImageCloneBulkRow[];
  jobs: ImageCloneBulkJob[];
  completedCount: number;
  isBusy: boolean;
  error: string | null;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onBack: () => void;
  onStartGeneration: () => void;
  onReparse: (file: File) => void;
  onOpenRegenerate: (job: ImageCloneBulkJob) => void;
  isAccessLoading: boolean;
  jobsSectionRef: React.RefObject<HTMLElement | null>;
}) {
  const bulkCreditCost = getImageGenerationCreditCost(rows.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#666666] hover:text-black">
            <ArrowLeft className="h-4 w-4" />
            Back to tool options
          </button>
          <h2 className="text-2xl font-semibold tracking-tight text-black">Bulk Ecommerce Clone</h2>
          <p className="mt-2 text-sm leading-6 text-[#666666]">Review workbook rows, then generate image clones for each row.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#666666]">
            <Rows3 className="h-3.5 w-3.5" />
            <span className="font-mono">{rows.length} rows</span>
          </div>
          <div className="h-4 w-px bg-[#E5E5E5]" />
          <div className="flex items-center gap-1.5 text-xs text-[#666666]">
            <Check className="h-3.5 w-3.5" />
            <span className="font-mono">{jobs.length ? `${completedCount}/${jobs.length}` : "0/0"}</span>
          </div>
          <label className={`${secondaryButtonClass} h-9 cursor-pointer justify-center text-xs`}>
            Re-parse XLSX
            <input
              type="file"
              accept=".xlsx"
              disabled={isBusy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onReparse(file);
              }}
            />
          </label>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
          <div className="min-h-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-black" />
              <h3 className="text-lg font-semibold text-black">Product context</h3>
            </div>
            <ProductContextField label="Product title" value={workbook.product.title} />
            <ProductContextField label="Product description" value={workbook.product.description} />
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[#666666]">
              <ImageIcon className="h-3.5 w-3.5" />
              Product photos
            </div>
            <div className="flex max-h-[104px] flex-wrap gap-2 overflow-hidden">
              {workbook.product.images.length ? (
                workbook.product.images.map((image) => (
                  <Image
                    key={image.id}
                    src={image.dataUrl}
                    alt="Product reference"
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-md border border-[#E5E5E5] object-cover"
                    unoptimized
                  />
                ))
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-[#E5E5E5] bg-[#F7F7F7] text-xs text-[#888888]">
                  No product photos found
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 shrink-0 border-t border-[#E5E5E5] pt-4">
            <button
              type="button"
              disabled={isBusy || isAccessLoading || !rows.length}
              onClick={onStartGeneration}
              className={`${primaryButtonClass} w-full justify-center ${isBusy || isAccessLoading || !rows.length ? "opacity-50" : ""}`}
            >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  {bulkCreditCost}
                </span>
              </>
            ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Generate Bulk Images</span>
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-4 w-4" />
                    {bulkCreditCost}
                  </span>
                </>
              )}
            </button>
          </div>
          {workbook.warnings.length ? (
            <div className="mt-3 shrink-0 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              {workbook.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="flex h-[560px] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 border-b border-[#E5E5E5] bg-white px-5 py-3">
            <FileSpreadsheet className="h-4 w-4 text-[#666666]" />
            <h3 className="text-sm font-semibold text-black">Parsed workbook rows</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.length ? rows.map((row) => <BulkRowPreview key={row.id} row={row} />) : (
              <div className="px-5 py-10 text-center text-sm text-[#666666]">No rows found.</div>
            )}
          </div>
        </div>
      </section>

      {jobs.length ? (
        <section ref={jobsSectionRef} className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] bg-white px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-black">Generation jobs</h3>
              <p className="mt-1 text-xs text-[#666666]">Track output settings, task IDs, and generated assets per workbook row.</p>
            </div>
            <div className="hidden rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 font-mono text-xs text-[#666666] md:block">
              {completedCount}/{jobs.length} complete
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <BulkJobCard
                key={job.rowId}
                job={job}
                primaryButtonClass={primaryButtonClass}
                secondaryButtonClass={secondaryButtonClass}
                onOpenRegenerate={onOpenRegenerate}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BulkJobCard({
  job,
  primaryButtonClass,
  secondaryButtonClass,
  onOpenRegenerate,
}: {
  job: ImageCloneBulkJob;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onOpenRegenerate: (job: ImageCloneBulkJob) => void;
}) {
  const downloadHref = job.resultUrl
    ? `/api/tools/image-clone/bulk/download?${new URLSearchParams({
        url: job.resultUrl,
        name: `row-${job.rowNumber}-${job.sequence || job.rowId}`,
      }).toString()}`
    : "#";

  return (
    <article className="flex min-h-[420px] flex-col rounded-xl border border-[#E5E5E5] bg-white p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-9 items-center gap-1.5 rounded-md bg-[#F7F7F7] px-2.5 text-sm font-semibold text-black">
            <FileText className="h-3.5 w-3.5" />
            Row {job.rowNumber}
          </div>
          <BulkStatusBadge status={job.status} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <JobDetail label="Quality" value={job.resolution} icon={Gauge} />
          <JobDetail label="Ratio" value={job.aspectRatio} icon={Crop} />
        </div>
        <JobDetail label="Task ID" value={job.taskId || "Not created"} icon={FileText} />
        {job.error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{job.error}</div> : null}
      </div>

      <div className="mt-4 flex flex-1 items-center justify-center">
        {job.resultUrl ? (
          <Image
            src={job.resultUrl}
            alt={`Generated image for row ${job.rowNumber}`}
            width={420}
            height={420}
            className="aspect-square w-full rounded-md border border-[#E5E5E5] object-cover"
            unoptimized
          />
        ) : job.status === "fail" ? (
          <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-[#E5E5E5] bg-[#F7F7F7] text-xs text-[#888888]">
            No output
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-xs text-[#666666]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating image...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={downloadHref}
          aria-disabled={!job.resultUrl}
          className={`${secondaryButtonClass} h-10 justify-center text-xs ${!job.resultUrl ? "pointer-events-none opacity-50" : ""}`}
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        <button
          type="button"
          onClick={() => onOpenRegenerate(job)}
          disabled={!job.resultUrl || job.status !== "success"}
          className={`${primaryButtonClass} h-10 justify-center text-xs ${!job.resultUrl || job.status !== "success" ? "opacity-50" : ""}`}
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
      </div>
    </article>
  );
}

function JobDetail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase text-[#666666]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-xs text-black" title={value}>
        {value}
      </div>
    </div>
  );
}
