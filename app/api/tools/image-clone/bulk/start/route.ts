import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildImageCloneBulkPrompt } from "@/lib/image-clone-bulk-prompt";
import { getImageCloneBulkWorkbook } from "@/lib/image-clone-bulk-store";
import type { ImageCloneBulkImage, ImageCloneBulkJob, ImageCloneBulkRow } from "@/lib/image-clone-bulk-types";
import { uploadImageForClone } from "@/lib/image-clone";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import {
  chargeToolGenerationCredits,
  getImageGenerationCreditCost,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from "@/lib/tools/billing";
import { createToolGenerationJob, createToolGenerationTask } from "@/lib/tools/job-store";
import { assertKieCreditsAvailable } from "@/lib/kie-credits-check";

export const runtime = "nodejs";
export const maxDuration = 300;
const KIE_CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_MODEL = "gpt-image-2-image-to-image";

function getKieApiKey() {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY is not configured.");
  return apiKey;
}

function dedupeImages(images: ImageCloneBulkImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = `${image.id}:${image.fileName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function createKieBulkTask(params: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}): Promise<string> {
  await assertKieCreditsAvailable();
  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKieApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIE_MODEL,
      input: {
        prompt: params.prompt,
        input_urls: params.inputUrls.slice(0, 16),
        aspect_ratio: params.aspectRatio,
        resolution: params.resolution,
      },
      callBackUrl: params.callBackUrl,
    }),
  }, 5, 30000);

  if (!response.ok) throw new Error(`KIE task creation failed: ${response.status}`);
  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (payload?.code !== 200 || typeof taskId !== "string") {
    throw new Error(payload?.msg || "KIE task creation did not return a taskId.");
  }
  return taskId;
}

function normalizeRows(input: { workbookId?: string; rowIds?: string[] }) {
  if (!input.workbookId) return { error: "workbookId is required." as const };
  const workbook = getImageCloneBulkWorkbook(input.workbookId);
  if (!workbook) {
    return { error: "Uploaded workbook data expired. Please upload the XLSX again." as const, status: 410 };
  }
  const selectedIds = new Set(input.rowIds ?? []);
  const rows = workbook.rows.filter((row) => selectedIds.size === 0 || selectedIds.has(row.id));
  if (!rows.length) return { error: "No generation rows selected." as const };
  return { workbook, rows };
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!process.env.KIE_API_KEY) return NextResponse.json({ error: "KIE API key not configured" }, { status: 500 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL not configured" }, { status: 500 });
    }
    const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;

    const body = (await request.json()) as { workbookId?: string; rowIds?: string[] };
    const normalized = normalizeRows(body);
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: normalized.status ?? 400 });
    }

    const { workbook, rows } = normalized;
    const charge = await chargeToolGenerationCredits({
      userId,
      amount: getImageGenerationCreditCost(rows.length),
      description: `Image Clone Bulk - ${rows.length} image${rows.length === 1 ? "" : "s"}`,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    const uploadedUrls = new Map<string, Promise<string>>();
    const uploadReference = (image: ImageCloneBulkImage, fileName: string) => {
      const key = `${image.id}:${image.fileName}`;
      if (uploadedUrls.has(key)) return uploadedUrls.get(key)!;
      const upload = uploadImageForClone(image.dataUrl, fileName, "flowtra/image-clone-bulk");
      uploadedUrls.set(key, upload);
      return upload;
    };

    try {
      // Create parent job
      const job = await createToolGenerationJob({
        userId,
        toolKey: 'image-clone-bulk',
        status: 'processing',
        metadata: { row_count: rows.length, workbook_id: workbook.workbookId },
        billedCredits: charge.chargedCredits,
      });

      const jobs: ImageCloneBulkJob[] = [];
      for (const row of rows) {
        const prompt = buildImageCloneBulkPrompt(workbook, row);
        const references = dedupeImages([...workbook.product.images, ...row.referenceImages]).slice(0, 16);

        if (!references.length) {
          jobs.push({
            rowId: row.id, rowNumber: row.rowNumber, sequence: row.sequence,
            taskId: "", status: "fail",
            error: "No reference images available for this row.",
            prompt, aspectRatio: row.aspectRatio, resolution: row.resolution,
            sourceRow: row.source,
          });
          continue;
        }

        const inputUrls = await Promise.all(
          references.map((image, index) =>
            uploadReference(image, `row-${row.rowNumber}-ref-${index + 1}-${image.fileName}`)
          )
        );

        const taskId = await createKieBulkTask({
          prompt, inputUrls, aspectRatio: row.aspectRatio, resolution: row.resolution, callBackUrl,
        });

        // Create task in the temporary Redis job store.
        await createToolGenerationTask({
          jobId: job.id,
          kieTaskId: taskId,
          toolKey: 'image-clone-bulk',
          metadata: {
            row_id: row.id,
            row_number: row.rowNumber,
            prompt,
            aspect_ratio: row.aspectRatio,
            resolution: row.resolution,
          },
        });

        jobs.push({
          rowId: row.id, rowNumber: row.rowNumber, sequence: row.sequence,
          taskId, status: "waiting",
          prompt, aspectRatio: row.aspectRatio, resolution: row.resolution,
          sourceRow: row.source,
        });
      }

      return NextResponse.json({ jobId: job.id, jobs });
    } catch (error) {
      await refundToolGenerationCredits({
        userId, amount: charge.chargedCredits,
        reason: "Image Clone Bulk failed to start",
      });
      throw error;
    }
  } catch (error) {
    console.error("[tools/image-clone/bulk/start]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start generation." },
      { status: 500 }
    );
  }
}
