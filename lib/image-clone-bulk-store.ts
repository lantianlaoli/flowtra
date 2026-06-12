import type {
  ImageCloneBulkImage,
  ImageCloneBulkWorkbook,
} from "@/lib/image-clone-bulk-types";

const globalForImageCloneBulk = globalThis as typeof globalThis & {
  flowtraImageCloneBulkWorkbooks?: Map<string, ImageCloneBulkWorkbook>;
};

const workbookStore = globalForImageCloneBulk.flowtraImageCloneBulkWorkbooks ?? new Map<string, ImageCloneBulkWorkbook>();

globalForImageCloneBulk.flowtraImageCloneBulkWorkbooks = workbookStore;

export function setImageCloneBulkWorkbook(workbook: ImageCloneBulkWorkbook) {
  const workbookId = workbook.workbookId ?? crypto.randomUUID();
  const storedWorkbook = { ...workbook, workbookId };
  workbookStore.set(workbookId, storedWorkbook);
  return storedWorkbook;
}

export function getImageCloneBulkWorkbook(workbookId: string) {
  return workbookStore.get(workbookId);
}

function publicImage(workbookId: string, image: ImageCloneBulkImage): ImageCloneBulkImage {
  const params = new URLSearchParams({ workbookId, imageId: image.id });
  return {
    ...image,
    dataUrl: `/api/tools/image-clone/bulk/image?${params.toString()}`,
  };
}

export function toPublicImageCloneBulkWorkbook(workbook: ImageCloneBulkWorkbook): ImageCloneBulkWorkbook {
  if (!workbook.workbookId) return workbook;
  const workbookId = workbook.workbookId;
  return {
    ...workbook,
    product: {
      ...workbook.product,
      images: workbook.product.images.map((image) => publicImage(workbookId, image)),
    },
    rows: workbook.rows.map((row) => ({
      ...row,
      referenceImages: row.referenceImages.map((image) => publicImage(workbookId, image)),
    })),
  };
}

export function findImageCloneBulkImage(workbookId: string, imageId: string) {
  const workbook = getImageCloneBulkWorkbook(workbookId);
  if (!workbook) return undefined;
  const images = [
    ...workbook.product.images,
    ...workbook.rows.flatMap((row) => row.referenceImages),
  ];
  return images.find((image) => image.id === imageId);
}
