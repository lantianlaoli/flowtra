import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  buildImageCloneBulkRegenerationPrompt,
  createImageCloneBulkReplacementJob,
  validateImageCloneBulkRegenerationLocalImages,
  validateImageCloneBulkRegenerationOutputSize,
  type ImageCloneBulkRegenerationLocalImage,
} from "@/lib/image-clone-bulk-regenerate";
import type { ImageCloneBulkAspectRatio, ImageCloneBulkJob, ImageCloneBulkResolution } from "@/lib/image-clone-bulk-types";
import { uploadImageForClone } from "@/lib/image-clone";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
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

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
}

async function createKieBulkRegenerateTask(params: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
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

    const body = (await request.json()) as {
      job?: ImageCloneBulkJob;
      resultUrl?: string;
      refinement?: string;
      localImages?: ImageCloneBulkRegenerationLocalImage[];
      fontReferenceUrl?: string | null;
      aspectRatio?: ImageCloneBulkAspectRatio;
      resolution?: ImageCloneBulkResolution;
    };

    if (!body.job?.rowId || !body.job.taskId) {
      return NextResponse.json({ error: "Completed bulk job is required." }, { status: 400 });
    }
    if (body.job.status !== "success") {
      return NextResponse.json({ error: "Only completed bulk jobs can be regenerated." }, { status: 400 });
    }
    if (!isHttpUrl(body.resultUrl)) {
      return NextResponse.json({ error: "A valid current image URL is required." }, { status: 400 });
    }
    if (body.fontReferenceUrl && !isHttpUrl(body.fontReferenceUrl)) {
      return NextResponse.json({ error: "A valid font reference URL is required." }, { status: 400 });
    }

    const job = body.job;
    const refinement = (body.refinement ?? "").trim();
    if (!refinement) {
      return NextResponse.json({ error: "Regeneration instructions are required." }, { status: 400 });
    }

    const aspectRatio = body.aspectRatio ?? job.aspectRatio;
    const resolution = body.resolution ?? job.resolution;
    const outputSizeError = validateImageCloneBulkRegenerationOutputSize(aspectRatio, resolution);
    if (outputSizeError) return NextResponse.json({ error: outputSizeError }, { status: 400 });

    const localImages = body.localImages ?? [];
    const localImageError = validateImageCloneBulkRegenerationLocalImages(localImages);
    if (localImageError) return NextResponse.json({ error: localImageError }, { status: 400 });

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: IMAGE_GENERATION_CREDIT_COST,
      description: "Image Clone Bulk - regeneration",
      historyId: job.taskId,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      const localImageUrls = await Promise.all(
        localImages.map((image, index) =>
          uploadImageForClone(
            image.dataUrl ?? "",
            `bulk-regenerate-row-${job.rowNumber}-${index + 1}-${image.fileName ?? "reference.png"}`,
            "flowtra/image-clone-bulk/edit-uploads"
          )
        )
      );

      const prompt = buildImageCloneBulkRegenerationPrompt({
        originalPrompt: job.prompt,
        refinement,
        localImageCount: localImageUrls.length,
      });

      const inputUrls = [body.resultUrl!, ...(body.fontReferenceUrl ? [body.fontReferenceUrl] : []), ...localImageUrls];
      const taskId = await createKieBulkRegenerateTask({ prompt, inputUrls, aspectRatio, resolution, callBackUrl });

      // Create parent job + task in the temporary Redis job store.
      const parentJob = await createToolGenerationJob({
        userId,
        toolKey: 'image-clone-bulk',
        status: 'processing',
        metadata: { regenerated_from_task_id: job.taskId, row_number: job.rowNumber },
        billedCredits: charge.chargedCredits,
      });

      await createToolGenerationTask({
        jobId: parentJob.id,
        kieTaskId: taskId,
        toolKey: 'image-clone-bulk',
        metadata: { prompt, aspect_ratio: aspectRatio, resolution, row_number: job.rowNumber },
      });

      return NextResponse.json({
        jobId: parentJob.id,
        job: createImageCloneBulkReplacementJob({ job, taskId, prompt, aspectRatio, resolution }),
      });
    } catch (error) {
      await refundToolGenerationCredits({
        userId, amount: charge.chargedCredits,
        reason: "Image Clone Bulk regeneration failed to start",
        historyId: job.taskId,
      });
      throw error;
    }
  } catch (error) {
    console.error("[tools/image-clone/bulk/regenerate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start regeneration." },
      { status: 500 }
    );
  }
}
