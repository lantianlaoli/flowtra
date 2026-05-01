import { NextResponse } from "next/server";
import { findImageCloneBulkImage } from "@/lib/image-clone-bulk-store";

export const runtime = "nodejs";

function dataUrlToBytes(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workbookId = searchParams.get("workbookId");
  const imageId = searchParams.get("imageId");

  if (!workbookId || !imageId) {
    return NextResponse.json({ error: "workbookId and imageId are required." }, { status: 400 });
  }

  const image = findImageCloneBulkImage(workbookId, imageId);
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const decoded = dataUrlToBytes(image.dataUrl);
  if (!decoded) {
    return NextResponse.json({ error: "Stored image is invalid." }, { status: 500 });
  }

  return new Response(decoded.bytes, {
    headers: {
      "Content-Type": decoded.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
