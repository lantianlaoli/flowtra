import { extractOpenRouterJsonContent, extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';

export type EcommerceListingTextLanguage = 'en' | 'zh';
export type EcommerceListingAssetScope = 'carousel' | 'detail' | 'video';
export type EcommerceListingImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type EcommerceListingImageResolution = '1K' | '2K' | '4K';
export type EcommerceListingVideoModel = 'seedance_2_fast' | 'seedance_2';
export type EcommerceListingVideoAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type EcommerceListingVideoResolution = '480p' | '720p' | '1080p';

export type EcommerceListingSlotStatus = 'waiting' | 'processing' | 'success' | 'fail';

export type EcommerceListingCreativeBrief = {
  productCategory: string;
  productIdentity: string;
  materialsAndColors: string;
  sellingPoints: string[];
  designLanguage: string;
  carouselDirection: string;
  detailDirection: string;
  videoDirection: string;
  customRequirements?: string;
};

export type EcommerceListingImageSlot = {
  id: string;
  kind: 'carousel' | 'detail';
  index: number;
  title: string;
  taskId?: string;
  status: EcommerceListingSlotStatus;
  resultUrl?: string;
  error?: string;
  prompt: string;
};

export type EcommerceListingVideoSlot = {
  storyboardTaskId?: string;
  storyboardUrl?: string;
  taskId?: string;
  status: EcommerceListingSlotStatus;
  resultUrl?: string;
  error?: string;
  prompt: string;
};

export type EcommerceListingMetadata = {
  product_image_urls?: string[];
  custom_requirements?: string;
  text_language?: EcommerceListingTextLanguage;
  image_aspect_ratio?: EcommerceListingImageAspectRatio;
  image_resolution?: EcommerceListingImageResolution;
  video_model?: EcommerceListingVideoModel;
  video_aspect_ratio?: EcommerceListingVideoAspectRatio;
  video_resolution?: EcommerceListingVideoResolution;
  asset_scopes?: EcommerceListingAssetScope[];
  brief?: EcommerceListingCreativeBrief;
  carousel_images?: EcommerceListingImageSlot[];
  detail_images?: EcommerceListingImageSlot[];
  video?: EcommerceListingVideoSlot;
  total_outputs?: number;
  completed_outputs?: number;
};

export const ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS = 15;

const ALL_SCOPES: EcommerceListingAssetScope[] = ['carousel', 'detail', 'video'];

export function normalizeEcommerceListingScopes(value: unknown): EcommerceListingAssetScope[] {
  const scopes = Array.isArray(value)
    ? value.filter((scope): scope is EcommerceListingAssetScope =>
        scope === 'carousel' || scope === 'detail' || scope === 'video'
      )
    : [];
  const unique = ALL_SCOPES.filter((scope) => scopes.includes(scope));
  return unique.length > 0 ? unique : ALL_SCOPES;
}

export function normalizeTextLanguage(value: unknown): EcommerceListingTextLanguage {
  return value === 'zh' ? 'zh' : 'en';
}

export function normalizeImageAspectRatio(value: unknown): EcommerceListingImageAspectRatio {
  return value === '4:3' || value === '3:4' || value === '16:9' || value === '9:16' ? value : '1:1';
}

export function normalizeImageResolution(value: unknown): EcommerceListingImageResolution {
  return value === '2K' || value === '4K' ? value : '1K';
}

export function normalizeVideoModel(value: unknown): EcommerceListingVideoModel {
  return value === 'seedance_2' ? 'seedance_2' : 'seedance_2_fast';
}

export function normalizeVideoAspectRatio(value: unknown): EcommerceListingVideoAspectRatio {
  return value === '4:3' || value === '3:4' || value === '16:9' || value === '9:16' ? value : '1:1';
}

export function normalizeVideoResolution(
  value: unknown,
  videoModel: EcommerceListingVideoModel = 'seedance_2_fast'
): EcommerceListingVideoResolution {
  if (videoModel === 'seedance_2') {
    return value === '480p' || value === '1080p' ? value : '720p';
  }
  return value === '480p' ? '480p' : '720p';
}

function languageInstruction(textLanguage: EcommerceListingTextLanguage) {
  if (textLanguage === 'zh') {
    return [
      'Use concise Simplified Chinese visible text only for newly generated marketing copy.',
      'Keep text sparse, short, readable, and do not mix English and Chinese.',
      'Original product logos, print, or packaging text from the reference photo may remain unchanged.',
    ].join(' ');
  }
  return 'Use concise English visible text only. Keep visible text minimal, short, readable, and accurately spelled. Preserve original product logo, print, or packaging text from the reference photo.';
}

function sellingPointText(brief: EcommerceListingCreativeBrief) {
  return brief.sellingPoints.filter(Boolean).slice(0, 5).join('; ') || 'clean product presentation';
}

export function fallbackEcommerceListingBrief(
  textLanguage: EcommerceListingTextLanguage
): EcommerceListingCreativeBrief {
  return {
    productCategory: textLanguage === 'zh' ? '电商产品' : 'ecommerce product',
    productIdentity:
      textLanguage === 'zh'
        ? '用户上传照片中的真实产品，保持外观、比例、材质、颜色和可识别细节'
        : 'the real product from the uploaded photo, preserving appearance, proportions, materials, colors, and recognizable details',
    materialsAndColors: textLanguage === 'zh' ? '根据产品照片判断' : 'infer from the product photo',
    sellingPoints:
      textLanguage === 'zh'
        ? ['真实产品外观', '干净高级视觉', '突出核心卖点']
        : ['true product appearance', 'clean premium visuals', 'clear selling points'],
    designLanguage:
      textLanguage === 'zh'
        ? '干净、高级、留白充足的电商视觉，少文字，统一字体和柔和光影'
        : 'clean premium ecommerce visuals with generous whitespace, minimal text, one font family, and soft studio lighting',
    carouselDirection:
      textLanguage === 'zh'
        ? '统一风格的商品轮播图，先白底主图，再展示场景和卖点'
        : 'consistent marketplace listing carousel images: white-background main image first, then hero and benefit visuals',
    detailDirection:
      textLanguage === 'zh'
        ? '统一风格的详情图，展示卖点、材质、使用场景和信任感'
        : 'consistent marketplace detail images showing benefits, materials, use cases, and trust cues',
    videoDirection:
      textLanguage === 'zh'
        ? '15 秒电商广告短片，产品展示、细节、卖点和最终英雄镜头'
        : '15-second ecommerce ad with product reveal, macro details, benefits, and final hero shot',
  };
}

function normalizeBrief(
  value: Partial<EcommerceListingCreativeBrief> | null,
  textLanguage: EcommerceListingTextLanguage
): EcommerceListingCreativeBrief {
  const fallback = fallbackEcommerceListingBrief(textLanguage);
  return {
    productCategory: value?.productCategory || fallback.productCategory,
    productIdentity: value?.productIdentity || fallback.productIdentity,
    materialsAndColors: value?.materialsAndColors || fallback.materialsAndColors,
    sellingPoints:
      Array.isArray(value?.sellingPoints) && value.sellingPoints.length
        ? value.sellingPoints
        : fallback.sellingPoints,
    designLanguage: value?.designLanguage || fallback.designLanguage,
    carouselDirection: value?.carouselDirection || fallback.carouselDirection,
    detailDirection: value?.detailDirection || fallback.detailDirection,
    videoDirection: value?.videoDirection || fallback.videoDirection,
  };
}

export async function analyzeProductForEcommerceListing(input: {
  productImageUrls: string[];
  textLanguage: EcommerceListingTextLanguage;
  customRequirements?: string;
}): Promise<EcommerceListingCreativeBrief> {
  const viewLabels = ['front view', 'side view', 'back view'];
  const imageDescriptions = input.productImageUrls
    .map((_, index) => viewLabels[index] ?? `photo ${index + 1}`)
    .join(', ');

  const response = await sendOpenRouterChat(
    {
      model: process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Analyze the uploaded product photos for an ecommerce marketplace listing asset generator.',
                `The user provided ${input.productImageUrls.length} product photo(s): ${imageDescriptions}.`,
                'Return ONLY a JSON object with these fields: productCategory, productIdentity, materialsAndColors, sellingPoints, designLanguage, carouselDirection, detailDirection, videoDirection.',
                'The creative direction must be clean, premium, low-text, product-led, and suitable for Temu-style marketplace listing images, detail images, and short product videos.',
                'Use all views to understand the product shape, depth, materials, colors, and functional details.',
                input.textLanguage === 'zh'
                  ? 'Write returned creative fields in Simplified Chinese. Newly generated visible marketing text in assets must be Simplified Chinese.'
                  : 'Write returned creative fields in English. Newly generated visible marketing text in assets must be English.',
                input.customRequirements
                  ? `User custom requirements (MUST follow when generating all assets): ${input.customRequirements}`
                  : '',
              ].filter(Boolean).join('\n'),
            },
            ...input.productImageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ecommerce_listing_brief',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              productCategory: { type: 'string' },
              productIdentity: { type: 'string' },
              materialsAndColors: { type: 'string' },
              sellingPoints: { type: 'array', items: { type: 'string' } },
              designLanguage: { type: 'string' },
              carouselDirection: { type: 'string' },
              detailDirection: { type: 'string' },
              videoDirection: { type: 'string' },
            },
            required: [
              'productCategory',
              'productIdentity',
              'materialsAndColors',
              'sellingPoints',
              'designLanguage',
              'carouselDirection',
              'detailDirection',
              'videoDirection',
            ],
            additionalProperties: false,
          },
        },
      },
      plugins: [{ id: 'response-healing' }],
      max_tokens: 2000,
      temperature: 0.6,
    },
    {
      timeoutMs: 60000,
      maxRetries: 3,
      httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      xTitle: 'Flowtra',
    }
  );

  const content = response.choices?.[0]?.message?.content;
  const parsed =
    extractOpenRouterJsonContent<Partial<EcommerceListingCreativeBrief>>(content) ??
    extractOpenRouterJsonContent<Partial<EcommerceListingCreativeBrief>>(extractOpenRouterTextContent(content));
  const brief = normalizeBrief(parsed, input.textLanguage);
  if (input.customRequirements) brief.customRequirements = input.customRequirements;
  return brief;
}

function viewReferenceNote(numViews: number) {
  if (numViews <= 1) return '';
  return numViews === 3
    ? 'Three product reference images are provided: front view, side view, and back view. Use all views together to build a complete 3D understanding of the product shape, depth, materials, and features.'
    : `Multiple product reference images (${numViews}) are provided. Use all views together to fully understand the product shape, materials, and features.`;
}

function customRequirementsBlock(customRequirements?: string) {
  if (!customRequirements?.trim()) return '';
  return `User custom requirements (MUST follow): ${customRequirements.trim()}`;
}

function baseImagePrompt(
  brief: EcommerceListingCreativeBrief,
  textLanguage: EcommerceListingTextLanguage,
  numViews: number
) {
  return [
    `Create one finished ecommerce marketplace product image using the uploaded product photo${numViews > 1 ? 's' : ''} as the identity reference.`,
    viewReferenceNote(numViews),
    'Preserve the exact product identity, proportions, materials, colors, structure, logo placement if present, and recognizable details from every visible angle.',
    'Use one unified design language across the full listing image and detail image set.',
    `Product category: ${brief.productCategory}.`,
    `Product identity: ${brief.productIdentity}.`,
    `Materials and colors: ${brief.materialsAndColors}.`,
    `Selling points: ${sellingPointText(brief)}.`,
    `Design language: ${brief.designLanguage}.`,
    languageInstruction(textLanguage),
    'Keep the image clean, premium, spacious, marketplace-ready, and product-led.',
    'Do not add fake brand logos, dense copy, clutter, watermarks, QR codes, pricing, badges, or unrelated props.',
    customRequirementsBlock(brief.customRequirements),
  ].filter(Boolean).join('\n');
}

export function buildEcommerceListingImageSlots(input: {
  brief: EcommerceListingCreativeBrief;
  textLanguage: EcommerceListingTextLanguage;
  numViews: number;
  assetScopes: EcommerceListingAssetScope[];
}): EcommerceListingImageSlot[] {
  const base = baseImagePrompt(input.brief, input.textLanguage, input.numViews);
  const slots: EcommerceListingImageSlot[] = [
    {
      id: 'carousel-1',
      kind: 'carousel',
      index: 1,
      title: 'White Background',
      status: 'waiting',
      prompt: [
        base,
        'Image role: carousel image 1.',
        'Use a pure white background, centered product, realistic soft shadow, accurate product scale, marketplace-ready composition.',
        'No headline, no decorative scene, no lifestyle background, and no large text.',
      ].join('\n'),
    },
    {
      id: 'carousel-2',
      kind: 'carousel',
      index: 2,
      title: 'Hero Benefit',
      status: 'waiting',
      prompt: [base, `Carousel direction: ${input.brief.carouselDirection}.`, 'Image role: carousel image 2. Create a premium hero composition that introduces the strongest selling point with very short text.'].join('\n'),
    },
    {
      id: 'carousel-3',
      kind: 'carousel',
      index: 3,
      title: 'Lifestyle Scene',
      status: 'waiting',
      prompt: [base, `Carousel direction: ${input.brief.carouselDirection}.`, 'Image role: carousel image 3. Show the product in a clean use-context or studio scene that matches the same design system.'].join('\n'),
    },
    {
      id: 'carousel-4',
      kind: 'carousel',
      index: 4,
      title: 'Material Close-up',
      status: 'waiting',
      prompt: [base, `Carousel direction: ${input.brief.carouselDirection}.`, 'Image role: carousel image 4. Use macro or close-up composition to showcase material quality, texture, craftsmanship, or fine details.'].join('\n'),
    },
    {
      id: 'carousel-5',
      kind: 'carousel',
      index: 5,
      title: 'Feature in Action',
      status: 'waiting',
      prompt: [base, `Carousel direction: ${input.brief.carouselDirection}.`, 'Image role: carousel image 5. Show product usage or action while keeping the composition premium and clean.'].join('\n'),
    },
    {
      id: 'carousel-6',
      kind: 'carousel',
      index: 6,
      title: 'Key Differentiator',
      status: 'waiting',
      prompt: [base, `Carousel direction: ${input.brief.carouselDirection}.`, "Image role: carousel image 6. Highlight the product's strongest differentiator with a clean visual statement."].join('\n'),
    },
    {
      id: 'detail-1',
      kind: 'detail',
      index: 1,
      title: 'Benefits Overview',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 1. Highlight the top benefits with minimal callouts and strong product focus.'].join('\n'),
    },
    {
      id: 'detail-2',
      kind: 'detail',
      index: 2,
      title: 'Material & Craft',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 2. Use macro/detail composition to explain materials, craftsmanship, texture, or functional structure.'].join('\n'),
    },
    {
      id: 'detail-3',
      kind: 'detail',
      index: 3,
      title: 'Size & Specs',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 3. Present dimensions, capacity, or technical specifications in a clean infographic style with minimal labels.'].join('\n'),
    },
    {
      id: 'detail-4',
      kind: 'detail',
      index: 4,
      title: 'Use Case Showcase',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 4. Show where and how the target customer would use the product.'].join('\n'),
    },
    {
      id: 'detail-5',
      kind: 'detail',
      index: 5,
      title: 'Trust & Proof',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 5. Build purchase confidence with clean reliability cues without clutter.'].join('\n'),
    },
    {
      id: 'detail-6',
      kind: 'detail',
      index: 6,
      title: 'Package & Accessories',
      status: 'waiting',
      prompt: [base, `Detail direction: ${input.brief.detailDirection}.`, 'Image role: detail image 6. Show packaging, included accessories, or unboxing value where relevant.'].join('\n'),
    },
  ];

  return slots.filter((slot) => input.assetScopes.includes(slot.kind));
}

export function buildEcommerceListingStoryboardPrompt(input: {
  brief: EcommerceListingCreativeBrief;
  textLanguage: EcommerceListingTextLanguage;
  numViews: number;
}) {
  return [
    `Create a storyboard image for a 15-second ecommerce marketplace product advertisement using the uploaded product photo${input.numViews > 1 ? 's' : ''}.`,
    input.numViews > 1
      ? 'Use the front, side, and back views to accurately represent the product through the storyboard beats.'
      : 'Use the product photo as the strict identity reference and preserve the exact product.',
    `Visible text language: ${input.textLanguage === 'zh' ? 'Simplified Chinese' : 'English'}.`,
    languageInstruction(input.textLanguage),
    'Storyboard structure: 6 clean beats in a grid: product reveal, macro detail, core benefit, use context, premium hero motion, final hero shot.',
    `Product category: ${input.brief.productCategory}.`,
    `Product identity: ${input.brief.productIdentity}.`,
    `Selling points: ${sellingPointText(input.brief)}.`,
    `Design language: ${input.brief.designLanguage}.`,
    `Video direction: ${input.brief.videoDirection}.`,
    'Keep typography sparse and polished. Do not add fake logos, dense text, prices, watermarks, or unrelated props.',
    customRequirementsBlock(input.brief.customRequirements),
  ].filter(Boolean).join('\n');
}

export function buildEcommerceListingVideoPrompt(input: {
  brief: EcommerceListingCreativeBrief;
  textLanguage: EcommerceListingTextLanguage;
  numViews: number;
}) {
  const prompt = [
    input.numViews > 1
      ? 'Create a 15-second ecommerce product advertisement using the provided product photos and storyboard image as visual references.'
      : 'Create a 15-second ecommerce product advertisement using the provided product photo and storyboard image as visual references.',
    input.numViews > 1
      ? 'Use the product views to animate the product from accurate perspectives: reveal, rotate, macro detail, use context, premium hero motion, final hero shot.'
      : 'Preserve the exact product appearance, proportions, materials, color, and recognizable details.',
    `Visible text and any generated audio language: ${input.textLanguage === 'zh' ? 'Chinese' : 'English'}.`,
    languageInstruction(input.textLanguage),
    `Product category: ${input.brief.productCategory}.`,
    `Selling points: ${sellingPointText(input.brief)}.`,
    `Design language: ${input.brief.designLanguage}.`,
    `Video direction: ${input.brief.videoDirection}.`,
    'Use clean studio lighting, smooth camera motion, premium ecommerce pacing, and minimal on-screen text.',
    'Do not invent a different product, fake logo, price, watermark, or unrelated props.',
    customRequirementsBlock(input.brief.customRequirements),
  ].filter(Boolean).join(' ');

  return prompt.length > 1800 ? `${prompt.slice(0, 1797)}...` : prompt;
}

export function calculateEcommerceListingProgress(metadata: EcommerceListingMetadata) {
  const imageSlots = [...(metadata.carousel_images ?? []), ...(metadata.detail_images ?? [])];
  const imageDone = imageSlots.filter((slot) => slot.status === 'success' || slot.status === 'fail').length;
  const videoSelected = metadata.asset_scopes?.includes('video') ?? false;
  const videoDone = videoSelected && (metadata.video?.status === 'success' || metadata.video?.status === 'fail') ? 1 : 0;
  return {
    completed: imageDone + videoDone,
    total: imageSlots.length + (videoSelected ? 1 : 0),
  };
}

export function isEcommerceListingComplete(metadata: EcommerceListingMetadata) {
  const progress = calculateEcommerceListingProgress(metadata);
  return progress.total > 0 && progress.completed >= progress.total;
}
