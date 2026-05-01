import type {
  ImageCloneBulkAspectRatio,
  ImageCloneBulkJob,
  ImageCloneBulkResolution,
} from "@/lib/image-clone-bulk-types";

export const IMAGE_CLONE_BULK_REGENERATION_MAX_LOCAL_IMAGES = 4;
export const IMAGE_CLONE_BULK_REGENERATION_MAX_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/i;

export type ImageCloneBulkRegenerationLocalImage = {
  fileName?: string;
  dataUrl?: string;
};

export function validateImageCloneBulkRegenerationOutputSize(
  aspectRatio: ImageCloneBulkAspectRatio,
  resolution: ImageCloneBulkResolution
) {
  if (aspectRatio === "auto" && resolution !== "1K") {
    return "Auto aspect ratio only supports 1K output.";
  }
  if (aspectRatio === "1:1" && resolution === "4K") {
    return "1:1 output does not support 4K resolution.";
  }
  return null;
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

export function validateImageCloneBulkRegenerationLocalImages(
  localImages: ImageCloneBulkRegenerationLocalImage[]
) {
  if (localImages.length > IMAGE_CLONE_BULK_REGENERATION_MAX_LOCAL_IMAGES) {
    return `Upload up to ${IMAGE_CLONE_BULK_REGENERATION_MAX_LOCAL_IMAGES} local reference images.`;
  }

  for (const image of localImages) {
    if (!image.dataUrl || !IMAGE_DATA_URL_PATTERN.test(image.dataUrl)) {
      return "Local reference images must be PNG, JPG, JPEG, or WebP files.";
    }
    if (estimateDataUrlBytes(image.dataUrl) > IMAGE_CLONE_BULK_REGENERATION_MAX_LOCAL_IMAGE_BYTES) {
      return "Each local reference image must be 10 MB or smaller.";
    }
  }

  return null;
}

export function buildImageCloneBulkRegenerationPrompt(input: {
  originalPrompt: string;
  refinement: string;
  localImageCount: number;
}) {
  const parts = [
    input.originalPrompt.trim(),
    "Regenerate the image from the current generated result. Keep the same product identity, ecommerce composition, and commercial intent unless the refinement says otherwise.",
  ];

  if (input.refinement.trim()) {
    parts.push(`Refinement request:\n${input.refinement.trim()}`);
  }

  if (input.localImageCount > 0) {
    parts.push(
      `Use the ${input.localImageCount} additional local reference image${input.localImageCount === 1 ? "" : "s"} for visual guidance where relevant.`
    );
  }

  return parts.filter(Boolean).join("\n\n");
}

export function createImageCloneBulkReplacementJob(input: {
  job: ImageCloneBulkJob;
  taskId: string;
  prompt: string;
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
}): ImageCloneBulkJob {
  return {
    ...input.job,
    taskId: input.taskId,
    status: "waiting",
    resultUrl: undefined,
    error: undefined,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
  };
}
