import { NextResponse } from "next/server";
import { createImageCloneBulkKieTask } from "@/lib/image-clone-bulk-kie";
import {
  buildImageCloneBulkRegenerationPrompt,
  createImageCloneBulkReplacementJob,
  validateImageCloneBulkRegenerationLocalImages,
  validateImageCloneBulkRegenerationOutputSize,
  type ImageCloneBulkRegenerationLocalImage,
} from "@/lib/image-clone-bulk-regenerate";
import { setImageCloneBulkJobStatus } from "@/lib/image-clone-bulk-store";
import type {
  ImageCloneBulkAspectRatio,
  ImageCloneBulkJob,
  ImageCloneBulkResolution,
} from "@/lib/image-clone-bulk-types";
import { uploadImageForClone } from "@/lib/image-clone";

export const runtime = "nodejs";
export const maxDuration = 300;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: "KIE API key not configured" }, { status: 500 });
    }

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
    if (outputSizeError) {
      return NextResponse.json({ error: outputSizeError }, { status: 400 });
    }

    const localImages = body.localImages ?? [];
    const localImageError = validateImageCloneBulkRegenerationLocalImages(localImages);
    if (localImageError) {
      return NextResponse.json({ error: localImageError }, { status: 400 });
    }

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

    const taskId = await createImageCloneBulkKieTask({
      prompt,
      inputUrls: [body.resultUrl, ...(body.fontReferenceUrl ? [body.fontReferenceUrl] : []), ...localImageUrls],
      aspectRatio,
      resolution,
    });

    setImageCloneBulkJobStatus({
      taskId,
      status: "waiting",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      job: createImageCloneBulkReplacementJob({
        job,
        taskId,
        prompt,
        aspectRatio,
        resolution,
      }),
    });
  } catch (error) {
    console.error("[tools/image-clone/bulk/regenerate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start regeneration." },
      { status: 500 }
    );
  }
}
