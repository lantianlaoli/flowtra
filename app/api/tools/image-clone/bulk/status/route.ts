import { NextResponse } from "next/server";
import { getImageCloneBulkKieStatus } from "@/lib/image-clone-bulk-kie";
import {
  getImageCloneBulkJobStatus,
  setImageCloneBulkJobStatus,
} from "@/lib/image-clone-bulk-store";

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
    const nextStatus = {
      taskId,
      status: status.status,
      resultUrl: status.resultUrl,
      error: status.error,
      updatedAt: new Date().toISOString(),
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
