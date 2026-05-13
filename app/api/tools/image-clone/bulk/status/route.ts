import { NextResponse } from "next/server";
import {
  createImageCloneBulkKieTask,
  getImageCloneBulkKieStatus,
  isRetryableImageCloneBulkKieError,
} from "@/lib/image-clone-bulk-kie";
import {
  getImageCloneBulkJobStatus,
  setImageCloneBulkJobStatus,
} from "@/lib/image-clone-bulk-store";
import { refundToolGenerationCredits } from "@/lib/tools/billing";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required." }, { status: 400 });
    }

    const stored = getImageCloneBulkJobStatus(taskId);
    if (stored?.status === "success" || stored?.status === "fail") {
      return NextResponse.json(stored);
    }

    const status = await getImageCloneBulkKieStatus(taskId);
    if (status.status === "fail" && isRetryableImageCloneBulkKieError(status.error) && stored?.prompt && stored.inputUrls?.length && stored.aspectRatio && stored.resolution) {
      const retryCount = stored.retryCount ?? 0;
      const maxRetries = stored.maxRetries ?? 2;
      if (retryCount < maxRetries) {
        const retryTaskId = await createImageCloneBulkKieTask({
          prompt: stored.prompt,
          inputUrls: stored.inputUrls,
          aspectRatio: stored.aspectRatio,
          resolution: stored.resolution,
        });
        const retryStatus = {
          taskId: retryTaskId,
          status: "waiting" as const,
          updatedAt: new Date().toISOString(),
          prompt: stored.prompt,
          inputUrls: stored.inputUrls,
          aspectRatio: stored.aspectRatio,
          resolution: stored.resolution,
          retryCount: retryCount + 1,
          maxRetries,
          userId: stored.userId,
          billedCredits: stored.billedCredits,
          billingRefundedAt: stored.billingRefundedAt,
        };
        setImageCloneBulkJobStatus(retryStatus);
        setImageCloneBulkJobStatus({
          ...stored,
          taskId,
          status: "processing",
          error: `Automatic retry ${retryCount + 1}/${maxRetries} started.`,
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.json(retryStatus);
      }
    }

    const shouldRefund =
      status.status === "fail" &&
      stored?.userId &&
      (stored.billedCredits ?? 0) > 0 &&
      !stored.billingRefundedAt;
    const billingRefundedAt = shouldRefund ? new Date().toISOString() : stored?.billingRefundedAt;
    if (shouldRefund) {
      await refundToolGenerationCredits({
        userId: stored.userId!,
        amount: stored.billedCredits!,
        reason: "Image Clone Bulk image failed",
        historyId: taskId,
      });
    }

    const nextStatus = {
      ...stored,
      taskId,
      status: status.status,
      resultUrl: status.resultUrl,
      error: status.error,
      updatedAt: new Date().toISOString(),
      billingRefundedAt,
    };
    setImageCloneBulkJobStatus(nextStatus);
    return NextResponse.json(nextStatus);
  } catch (error) {
    console.error("[tools/image-clone/bulk/status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check generation status." },
      { status: 500 }
    );
  }
}
