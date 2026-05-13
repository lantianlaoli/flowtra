export type ImageCloneBulkImage = {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

export type ImageCloneBulkAspectRatio = "auto" | "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

export type ImageCloneBulkResolution = "1K" | "2K" | "4K";

export type ImageCloneBulkRow = {
  id: string;
  rowNumber: number;
  sequence: string;
  size: string;
  requirement: string;
  copyText: string;
  style: string;
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
  referenceImages: ImageCloneBulkImage[];
  source: {
    cells: Record<string, string>;
  };
};

export type ImageCloneBulkWorkbook = {
  workbookId?: string;
  product: {
    title: string;
    description: string;
    images: ImageCloneBulkImage[];
  };
  rows: ImageCloneBulkRow[];
  warnings: string[];
  imageCount: number;
};

export type ImageCloneBulkJobStatus = "waiting" | "processing" | "success" | "fail";

export type ImageCloneBulkJob = {
  rowId: string;
  rowNumber: number;
  sequence: string;
  taskId: string;
  status: ImageCloneBulkJobStatus;
  resultUrl?: string;
  error?: string;
  prompt: string;
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
  sourceRow: ImageCloneBulkRow["source"];
};

export type ImageCloneBulkStoredJobStatus = Pick<ImageCloneBulkJob, "status" | "resultUrl" | "error"> & {
  taskId: string;
  updatedAt: string;
  prompt?: string;
  inputUrls?: string[];
  aspectRatio?: ImageCloneBulkAspectRatio;
  resolution?: ImageCloneBulkResolution;
  retryCount?: number;
  maxRetries?: number;
  userId?: string;
  billedCredits?: number;
  billingRefundedAt?: string | null;
};
