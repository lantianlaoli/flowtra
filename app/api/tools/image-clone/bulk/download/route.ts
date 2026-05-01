import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "image";
}

function extensionFromContentType(contentType: string | null) {
  if (contentType?.includes("jpeg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "png";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");
    const name = safeName(searchParams.get("name") || "image-clone-result");

    if (!imageUrl) {
      return NextResponse.json({ error: "url is required." }, { status: 400 });
    }

    const parsedUrl = new URL(imageUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return NextResponse.json({ error: "Only HTTP image URLs are supported." }, { status: 400 });
    }

    const response = await fetch(parsedUrl);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    const ext = extensionFromContentType(contentType);
    const bytes = await response.arrayBuffer();

    return new Response(bytes, {
      headers: {
        "Content-Type": contentType || "image/png",
        "Content-Disposition": `attachment; filename="${name}.${ext}"`,
      },
    });
  } catch (error) {
    console.error("[tools/image-clone/bulk/download]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download image." },
      { status: 500 }
    );
  }
}
