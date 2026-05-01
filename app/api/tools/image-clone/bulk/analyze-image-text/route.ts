import { NextResponse } from "next/server";
import { extractOpenRouterJsonContent, sendOpenRouterChat } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 120;

type TextBlock = {
  id?: string;
  text?: string;
  position?: string;
  size?: string;
};

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
    const body = (await request.json()) as { imageUrl?: string };
    if (!isHttpUrl(body.imageUrl)) {
      return NextResponse.json({ error: "A valid image URL is required." }, { status: 400 });
    }

    const response = await sendOpenRouterChat(
      {
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify editable English text visible in ecommerce images. Return JSON only with textBlocks.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  'Find visible English text blocks in this image. Return {"textBlocks":[{"id":"text-1","text":"...","position":"top left","size":"small|medium|large"}]}. Exclude product labels when unclear.',
              },
              {
                type: "image_url",
                image_url: { url: body.imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      },
      { timeoutMs: 60000, maxRetries: 1 }
    );

    const content = response.choices?.[0]?.message?.content;
    const parsed = extractOpenRouterJsonContent<{ textBlocks?: TextBlock[] }>(content);
    const textBlocks = Array.isArray(parsed?.textBlocks)
      ? parsed.textBlocks
          .filter((block) => typeof block.text === "string" && block.text.trim())
          .slice(0, 20)
          .map((block, index) => ({
            id: typeof block.id === "string" && block.id ? block.id : `text-${index + 1}`,
            text: block.text?.trim() ?? "",
            position: typeof block.position === "string" && block.position ? block.position : "unknown",
            size: typeof block.size === "string" && block.size ? block.size : "medium",
          }))
      : [];

    return NextResponse.json({ hasText: textBlocks.length > 0, textBlocks });
  } catch (error) {
    console.error("[tools/image-clone/bulk/analyze-image-text]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze image text." },
      { status: 500 }
    );
  }
}
