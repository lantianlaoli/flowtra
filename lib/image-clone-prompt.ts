export type ImageClonePromptParams = {
  productTitle?: string;
  productDescription?: string;
  userRequirement: string;
  copyText?: string;
  styleDirection?: string;
  aspectRatio: string;
  resolution: string;
};

export function buildImageClonePrompt(params: ImageClonePromptParams): string {
  const lines: string[] = [
    "Create one polished commercial product image in English.",
    "",
    "Product context:",
  ];

  if (params.productTitle) {
    lines.push(`- Product title: ${params.productTitle}`);
  }
  if (params.productDescription) {
    lines.push(`- Product description: ${params.productDescription}`);
  }

  lines.push(
    "",
    "Reference image roles:",
    "- The first product photo shows the user's actual product. Preserve the product identity, proportions, material, colors, recognizable details, and functional structure.",
    "- The competitor/reference photos show composition, angle, scene, lighting, or visual effects to borrow. Do not copy competitor branding or turn the user's product into the competitor product.",
    "",
    "User requirement:",
    params.userRequirement || "Create a clear product marketing image using the references.",
    "",
    "Required visible title/text in the image:",
    params.copyText || "No visible text requested.",
    "",
    "Style direction:",
    params.styleDirection || "Follow the references to create a professional commercial image.",
    "",
    "Language and text rules:",
    "- Default all visible text in the generated image to English only.",
    "- Translate any non-English marketing copy into concise natural English.",
    "- Keep on-image text short, readable, correctly spelled, and integrated into the layout.",
    "- Use only English-language fonts in the generated image.",
    "- Use a single consistent font family across all text elements in every generated image.",
    "",
    "Output requirements:",
    `- Canvas/aspect ratio target: ${params.aspectRatio}.`,
    `- Requested output quality/resolution tier: ${params.resolution}.`,
    "- Make the product the clear hero.",
    "- Produce a finished advertising image, not a collage of references."
  );

  return lines.join("\n");
}
