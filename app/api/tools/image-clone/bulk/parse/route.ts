import { NextResponse } from "next/server";
import {
  setImageCloneBulkWorkbook,
  toPublicImageCloneBulkWorkbook,
} from "@/lib/image-clone-bulk-store";
import { parseImageCloneBulkWorkbook } from "@/lib/image-clone-bulk-xlsx";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An .xlsx file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
    }

    const workbook = setImageCloneBulkWorkbook(await parseImageCloneBulkWorkbook(await file.arrayBuffer()));
    return NextResponse.json(toPublicImageCloneBulkWorkbook(workbook));
  } catch (error) {
    console.error("[tools/image-clone/bulk/parse]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse workbook." },
      { status: 500 }
    );
  }
}
