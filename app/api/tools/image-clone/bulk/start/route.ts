import { NextResponse } from "next/server";
import { createImageCloneBulkKieTask } from "@/lib/image-clone-bulk-kie";
import { buildImageCloneBulkPrompt } from "@/lib/image-clone-bulk-prompt";
import {
  getImageCloneBulkWorkbook,
  setImageCloneBulkJobStatus,
} from "@/lib/image-clone-bulk-store";
import type {
  ImageCloneBulkImage,
  ImageCloneBulkJob,
  ImageCloneBulkRow,
} from "@/lib/image-clone-bulk-types";
import { uploadImageForClone } from "@/lib/image-clone";

export const runtime = "nodejs";
export const maxDuration = 300;
const BULK_GENERATION_MAX_RETRIES = 2;

function dedupeImages(images: ImageCloneBulkImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = `${image.id}:${image.fileName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRows(input: {
  workbookId?: string;
  rowIds?: string[];
}) {
  if (!input.workbookId) return { error: "workbookId is required." as const };
  const workbook = getImageCloneBulkWorkbook(input.workbookId);
  if (!workbook) {
    return { error: "Uploaded workbook data expired. Please upload the XLSX again." as const, status: 410 };
  }

  const selectedIds = new Set(input.rowIds ?? []);
  const rows: ImageCloneBulkRow[] = workbook.rows.filter((row) => selectedIds.size === 0 || selectedIds.has(row.id));

  if (!rows.length) return { error: "No generation rows selected." as const };
  return { workbook, rows };
}

export async function POST(request: Request) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: "KIE API key not configured" }, { status: 500 });
    }

    const body = (await request.json()) as {
      workbookId?: string;
      rowIds?: string[];
    };
    const normalized = normalizeRows(body);
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: normalized.status ?? 400 });
    }

    const { workbook, rows } = normalized;
    const uploadedUrls = new Map<string, Promise<string>>();
    const uploadReference = (image: ImageCloneBulkImage, fileName: string) => {
      const key = `${image.id}:${image.fileName}`;
      const cachedUpload = uploadedUrls.get(key);
      if (cachedUpload) return cachedUpload;
      const upload = uploadImageForClone(image.dataUrl, fileName, "flowtra/image-clone-bulk");
      uploadedUrls.set(key, upload);
      return upload;
    };

    const jobs: ImageCloneBulkJob[] = [];
    for (const row of rows) {
      const prompt = buildImageCloneBulkPrompt(workbook, row);
      const references = dedupeImages([...workbook.product.images, ...row.referenceImages]).slice(0, 16);

      if (!references.length) {
        jobs.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          sequence: row.sequence,
          taskId: "",
          status: "fail",
          error: "No reference images available for this row.",
          prompt,
          aspectRatio: row.aspectRatio,
          resolution: row.resolution,
          sourceRow: row.source,
        });
        continue;
      }

      const inputUrls = await Promise.all(
        references.map((image, index) =>
          uploadReference(image, `row-${row.rowNumber}-ref-${index + 1}-${image.fileName}`)
        )
      );

      const taskId = await createImageCloneBulkKieTask({
        prompt,
        inputUrls,
        aspectRatio: row.aspectRatio,
        resolution: row.resolution,
      });

      setImageCloneBulkJobStatus({
        taskId,
        status: "waiting",
        updatedAt: new Date().toISOString(),
        prompt,
        inputUrls,
        aspectRatio: row.aspectRatio,
        resolution: row.resolution,
        retryCount: 0,
        maxRetries: BULK_GENERATION_MAX_RETRIES,
      });

      jobs.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        sequence: row.sequence,
        taskId,
        status: "waiting",
        prompt,
        aspectRatio: row.aspectRatio,
        resolution: row.resolution,
        sourceRow: row.source,
      });
    }

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[tools/image-clone/bulk/start]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start generation." },
      { status: 500 }
    );
  }
}
