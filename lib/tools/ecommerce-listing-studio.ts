import { extractOpenRouterJsonContent, extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';

export type EcommerceListingTextLanguage =
  | 'en'
  | 'fr'
  | 'de'
  | 'es'
  | 'pt'
  | 'it'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'he'
  | 'ru'
  | 'hi';
export type EcommerceListingAssetScope = 'carousel' | 'detail' | 'video';
export type EcommerceListingImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type EcommerceListingImageResolution = '1K' | '2K' | '4K';
export type EcommerceListingVideoModel = 'gemini_omni_video' | 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini';
export type EcommerceListingVideoAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type EcommerceListingVideoResolution = '480p' | '720p' | '1080p' | '4k';
export type EcommerceListingSourceMode = 'product-photos' | 'manufacturer-promos';
export type EcommerceListingCategory = 'general' | 'pet';
export type EcommerceListingLogoCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

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
  sourceIndex?: number;
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

export type EcommerceListingManufacturerPromoVisualHierarchy = {
  primaryText: string;
  secondaryText: string[];
  specs: string[];
  badges: string[];
  logoText: string[];
  decorativeText: string[];
  layout: string;
};

export type EcommerceListingManufacturerPromoAnalysis = {
  productSubject: string;
  visualHierarchy: EcommerceListingManufacturerPromoVisualHierarchy;
  productVisuals: string;
  keyMessages: string[];
  rewriteGuidance: string;
  hasRealPetSubject: boolean;
  realPetDescription: string;
};

export type EcommerceListingMetadata = {
  source_mode?: EcommerceListingSourceMode;
  category?: EcommerceListingCategory;
  product_image_urls?: string[];
  manufacturer_promo_image_urls?: string[];
  manufacturer_promo_analyses?: EcommerceListingManufacturerPromoAnalysis[];
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
  brand_logo?: {
    enabled: boolean;
    corner: EcommerceListingLogoCorner;
    logo_image_url: string;
  };
  pet_replacement?: {
    enabled: boolean;
    pet_id?: string;
    pet_image_urls: string[];
  };
  total_outputs?: number;
  completed_outputs?: number;
};

export const ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS = 10;

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

export function normalizeSourceMode(value: unknown): EcommerceListingSourceMode {
  return value === 'manufacturer-promos' ? 'manufacturer-promos' : 'product-photos';
}

export function normalizeEcommerceListingCategory(value: unknown): EcommerceListingCategory {
  return value === 'pet' ? 'pet' : 'general';
}

export function normalizeLogoCorner(value: unknown): EcommerceListingLogoCorner {
  return value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right'
    ? value
    : 'top-left';
}

export function normalizeTextLanguage(value: unknown): EcommerceListingTextLanguage {
  return value === 'fr' ||
    value === 'de' ||
    value === 'es' ||
    value === 'pt' ||
    value === 'it' ||
    value === 'zh' ||
    value === 'ja' ||
    value === 'ko' ||
    value === 'ar' ||
    value === 'he' ||
    value === 'ru' ||
    value === 'hi'
    ? value
    : 'en';
}

export function normalizeImageAspectRatio(value: unknown): EcommerceListingImageAspectRatio {
  return value === '4:3' || value === '3:4' || value === '16:9' || value === '9:16' ? value : '1:1';
}

export function normalizeImageResolution(value: unknown): EcommerceListingImageResolution {
  return value === '2K' || value === '4K' ? value : '1K';
}

export function normalizeVideoModel(value: unknown): EcommerceListingVideoModel {
  if (value === 'seedance_2_fast' || value === 'seedance_2' || value === 'seedance_2_mini') return value;
  return 'gemini_omni_video';
}

export function normalizeVideoAspectRatio(
  value: unknown,
  videoModel: EcommerceListingVideoModel = 'gemini_omni_video'
): EcommerceListingVideoAspectRatio {
  if (videoModel === 'gemini_omni_video') {
    return value === '16:9' ? '16:9' : '9:16';
  }
  return value === '4:3' || value === '3:4' || value === '16:9' || value === '9:16' ? value : '1:1';
}

export function normalizeVideoResolution(
  value: unknown,
  videoModel: EcommerceListingVideoModel = 'gemini_omni_video'
): EcommerceListingVideoResolution {
  if (videoModel === 'gemini_omni_video') {
    return value === '1080p' || value === '4k' ? value : '720p';
  }
  if (videoModel === 'seedance_2') {
    return value === '480p' || value === '1080p' ? value : '720p';
  }
  if (videoModel === 'seedance_2_mini') {
    return value === '480p' ? '480p' : '720p';
  }
  return value === '480p' ? '480p' : '720p';
}

export function ecommerceListingLanguageName(textLanguage: EcommerceListingTextLanguage) {
  const names: Record<EcommerceListingTextLanguage, string> = {
    en: 'English',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    it: 'Italian',
    zh: 'Simplified Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    he: 'Hebrew',
    ru: 'Russian using Cyrillic script',
    hi: 'Hindi using Devanagari script',
  };
  return names[textLanguage] ?? names.en;
}

function languageInstruction(textLanguage: EcommerceListingTextLanguage) {
  const languageName = ecommerceListingLanguageName(textLanguage);
  const extraScriptRules: Partial<Record<EcommerceListingTextLanguage, string>> = {
    zh: 'Do not mix English and Chinese unless preserving original product text.',
    ja: 'Use natural Japanese typography and do not mix English and Japanese unless preserving original product text.',
    ko: 'Use natural Korean typography and do not mix English and Korean unless preserving original product text.',
    ar: 'Use correct right-to-left Arabic text direction and readable Arabic typography.',
    he: 'Use correct right-to-left Hebrew text direction and readable Hebrew typography.',
    ru: 'Use readable Cyrillic typography suitable for Russian ecommerce copy.',
    hi: 'Use readable Devanagari typography suitable for Hindi ecommerce copy.',
  };
  return [
    `Use concise ${languageName} visible text only for newly generated marketing copy.`,
    'Keep visible text minimal, short, readable, and accurately spelled.',
    extraScriptRules[textLanguage] ?? '',
    textLanguage === 'zh'
      ? 'Preserve original product logo, brand marks, and packaging text from the reference photo when they are part of the product.'
      : `Rewrite source marketing headlines, subheads, badges, and selling-point copy into concise ${languageName}; do not keep source-language marketing copy unless it is a product logo, brand mark, model name, or text physically printed on the product/packaging.`,
  ].filter(Boolean).join(' ');
}

function sellingPointText(brief: EcommerceListingCreativeBrief) {
  return brief.sellingPoints.filter(Boolean).slice(0, 5).join('; ') || 'clean product presentation';
}

export function fallbackEcommerceListingBrief(
  _textLanguage: EcommerceListingTextLanguage
): EcommerceListingCreativeBrief {
  return {
    productCategory: 'ecommerce product',
    productIdentity:
      'the real product from the uploaded photo, preserving appearance, proportions, materials, colors, and recognizable details',
    materialsAndColors: 'infer from the product photo',
    sellingPoints: ['true product appearance', 'clean premium visuals', 'clear selling points'],
    designLanguage:
      'clean premium ecommerce visuals with generous whitespace, minimal text, one font family, and soft studio lighting',
    carouselDirection:
      'consistent marketplace listing carousel images: white-background main image first, then hero and benefit visuals',
    detailDirection:
      'consistent marketplace detail images showing benefits, materials, use cases, and trust cues',
    videoDirection:
      '10-second ecommerce ad with product reveal, macro detail, benefit/use moment, and final hero shot',
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
                `Write returned creative fields in ${ecommerceListingLanguageName(input.textLanguage)}. Newly generated visible marketing text in assets must be ${ecommerceListingLanguageName(input.textLanguage)}.`,
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

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, 12)
    : [];
}

function normalizeManufacturerPromoAnalysis(
  value: Partial<EcommerceListingManufacturerPromoAnalysis> | null,
  textLanguage: EcommerceListingTextLanguage
): EcommerceListingManufacturerPromoAnalysis {
  const fallback = fallbackManufacturerPromoAnalysis(textLanguage);
  const hierarchy = (value?.visualHierarchy ?? {}) as Partial<EcommerceListingManufacturerPromoVisualHierarchy>;
  return {
    productSubject: value?.productSubject || fallback.productSubject,
    visualHierarchy: {
      primaryText: hierarchy.primaryText || '',
      secondaryText: normalizeStringArray(hierarchy.secondaryText),
      specs: normalizeStringArray(hierarchy.specs),
      badges: normalizeStringArray(hierarchy.badges),
      logoText: normalizeStringArray(hierarchy.logoText),
      decorativeText: normalizeStringArray(hierarchy.decorativeText),
      layout: hierarchy.layout || fallback.visualHierarchy.layout,
    },
    productVisuals: value?.productVisuals || fallback.productVisuals,
    keyMessages: normalizeStringArray(value?.keyMessages),
    rewriteGuidance: value?.rewriteGuidance || fallback.rewriteGuidance,
    hasRealPetSubject: value?.hasRealPetSubject === true,
    realPetDescription: value?.realPetDescription || '',
  };
}

export async function analyzeManufacturerPromoForEcommerceListing(input: {
  imageUrl: string;
  textLanguage: EcommerceListingTextLanguage;
}): Promise<EcommerceListingManufacturerPromoAnalysis> {
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
                'Analyze this manufacturer promotional product image for an ecommerce carousel redesign workflow.',
                'Return ONLY a JSON object with: productSubject, productVisuals, keyMessages, rewriteGuidance, hasRealPetSubject, realPetDescription, and visualHierarchy.',
                'visualHierarchy must include: primaryText, secondaryText, specs, badges, logoText, decorativeText, layout.',
                'Extract text by visual hierarchy, not as a flat OCR list. Distinguish main headline, subheadlines, parameter/spec text, badges, logo/brand marks, decorative text, and the overall layout structure.',
                'Do not invent text that is not visible. Summarize visual product details needed to preserve the source product.',
                'Set hasRealPetSubject=true only when the image contains a real, living pet animal shown as part of the scene. Printed/cartoon/illustrated pets, mascots, package graphics, icons, and product decorations are NOT real pets.',
                'If hasRealPetSubject=true, describe the real pet position, pose, scale, viewpoint, and relationship to the product in realPetDescription. Otherwise realPetDescription must be an empty string.',
                input.textLanguage === 'zh'
                  ? 'Write explanatory fields in Simplified Chinese when useful, but preserve original visible text exactly inside hierarchy fields.'
                  : `Write explanatory fields in ${ecommerceListingLanguageName(input.textLanguage)}. Keep original visible text exactly inside hierarchy fields only as extracted source evidence. rewriteGuidance must recommend rewriting marketing copy in ${ecommerceListingLanguageName(input.textLanguage)} and preserving only logos, brand marks, model names, or text physically printed on the product/packaging.`,
              ].join('\n'),
            },
            { type: 'image_url', image_url: { url: input.imageUrl } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ecommerce_listing_manufacturer_promo_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              productSubject: { type: 'string' },
              productVisuals: { type: 'string' },
              keyMessages: { type: 'array', items: { type: 'string' } },
              rewriteGuidance: { type: 'string' },
              hasRealPetSubject: { type: 'boolean' },
              realPetDescription: { type: 'string' },
              visualHierarchy: {
                type: 'object',
                properties: {
                  primaryText: { type: 'string' },
                  secondaryText: { type: 'array', items: { type: 'string' } },
                  specs: { type: 'array', items: { type: 'string' } },
                  badges: { type: 'array', items: { type: 'string' } },
                  logoText: { type: 'array', items: { type: 'string' } },
                  decorativeText: { type: 'array', items: { type: 'string' } },
                  layout: { type: 'string' },
                },
                required: ['primaryText', 'secondaryText', 'specs', 'badges', 'logoText', 'decorativeText', 'layout'],
                additionalProperties: false,
              },
            },
            required: ['productSubject', 'productVisuals', 'keyMessages', 'rewriteGuidance', 'hasRealPetSubject', 'realPetDescription', 'visualHierarchy'],
            additionalProperties: false,
          },
        },
      },
      plugins: [{ id: 'response-healing' }],
      max_tokens: 1800,
      temperature: 0.4,
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
    extractOpenRouterJsonContent<Partial<EcommerceListingManufacturerPromoAnalysis>>(content) ??
    extractOpenRouterJsonContent<Partial<EcommerceListingManufacturerPromoAnalysis>>(
      extractOpenRouterTextContent(content)
    );
  return normalizeManufacturerPromoAnalysis(parsed, input.textLanguage);
}

export function fallbackManufacturerPromoAnalysis(
  textLanguage: EcommerceListingTextLanguage
): EcommerceListingManufacturerPromoAnalysis {
  if (textLanguage === 'zh') {
    return {
      productSubject: '原厂家宣传图中的产品，保持外观、比例、材质和可识别细节',
      visualHierarchy: {
        primaryText: '',
        secondaryText: [],
        specs: [],
        badges: [],
        logoText: [],
        decorativeText: [],
        layout: '从原图推断',
      },
      productVisuals: '从原厂家宣传图推断产品形状、材质、颜色和可见细节',
      keyMessages: [],
      rewriteGuidance: '保留产品，按用户风格与文案选择要求重新设计宣传图',
      hasRealPetSubject: false,
      realPetDescription: '',
    };
  }
  return {
    productSubject:
      'the product in the original manufacturer promotional image, preserving appearance, proportions, materials, and recognizable details',
    visualHierarchy: {
      primaryText: '',
      secondaryText: [],
      specs: [],
      badges: [],
      logoText: [],
      decorativeText: [],
      layout: 'infer from the source image',
    },
    productVisuals: 'infer product shape, materials, color, and visible details from the source manufacturer promo image',
    keyMessages: [],
    rewriteGuidance:
      "preserve the product and redesign the promotional image according to the user's style and copy-selection requirements; rewrite marketing copy in the selected output language while preserving only logos, brand marks, model names, and text printed on the product or packaging",
    hasRealPetSubject: false,
    realPetDescription: '',
  };
}

export const BRAND_LOGO_MARGIN_PERCENT = 8;

export function getBrandLogoNote(lang: EcommerceListingTextLanguage, corner: EcommerceListingLogoCorner): string {
  const margin = `${BRAND_LOGO_MARGIN_PERCENT}%`;
  const cornerLabel: Record<EcommerceListingLogoCorner, string> = {
    'top-left': 'top-left',
    'top-right': 'top-right',
    'bottom-left': 'bottom-left',
    'bottom-right': 'bottom-right',
  };
  return [
    `Recreate the uploaded brand logo reference in the final image, preserving its mark, wordmark, color, and overall style, then place it in the ${cornerLabel[corner]} corner.`,
    `Keep the logo margin exactly ${margin} from both nearest edges, based on the shorter side of the image.`,
    'Use the same corner and margin for every generated carousel image.',
    'The logo must not overlap the product, main headline, selling-point copy, spec lines, or decorative bands.',
    "If the source image already contains a logo, brand mark, stamp, or watermark, preserve that source element and add the user's logo without replacing it.",
    lang === 'zh' ? '新生成的品牌标识位置规则同样适用于中文轮播图。' : '',
  ].filter(Boolean).join(' ');
}

export function getPetReplacementNote(lang: EcommerceListingTextLanguage): string {
  if (lang === 'zh') {
    return [
      '第一步：认定原图中存在一只真实的、活体的猫，这是本任务的前提。',
      '第二步：用用户提供的宠物参考照中的猫作为身份来源，替换掉原图中的那只真实猫。替换时保留原猫所在位置、姿势、比例、视角和视线；不要把猫放到产品本身上，不要覆盖产品，不要改变产品外观、材质、包装或品牌信息。',
      '第三步：宠物参考照只用于替换原图中的真实猫，不要影响产品本身，也不要影响产品上的 logo、文字、角标、参数、装饰带等任何元素。',
      '例外：如果原图里完全没有猫，或原图里的猫明显是插画、卡通形象、印花、品牌吉祥物，或出现的是其他动物，则不要引入用户提供的猫，直接保留原图中的产品、构图和文字。',
    ].join(' ');
  }
  return [
    'The source image was pre-checked and contains a real, living pet animal that should be replaced.',
    "Use the cat shown in the user's pet reference photos as the identity source, replacing the real cat in the source while preserving the original cat position, pose, scale, viewpoint, and gaze.",
    "Do not place the pet on the product itself, cover the product, or change the product's appearance, materials, packaging, logo, text, badges, spec lines, or decorative bands.",
  ].join(' ');
}

export function buildManufacturerPromoCarouselPrompt(input: {
  analysis: EcommerceListingManufacturerPromoAnalysis;
  customRequirements?: string;
  textLanguage: EcommerceListingTextLanguage;
  sourceIndex: number;
  petReplacementNote?: string;
  brandLogoNote?: string;
}) {
  const hierarchy = input.analysis.visualHierarchy;
  const customRequirements =
    input.customRequirements?.trim() || 'Redesign into a clean premium marketplace carousel style.';
  const petRule = input.petReplacementNote
    ? [
        '',
        '===== ABSOLUTE PRIORITY RULE =====',
        input.petReplacementNote,
        'End of priority rule. Other rules apply only where they do not conflict.',
        '',
      ].join('\n')
    : '';
  const brandLogoRule = input.brandLogoNote
    ? [
        '',
        '===== ABSOLUTE PRIORITY RULE =====',
        input.brandLogoNote,
        'End of priority rule. Other rules apply only where they do not conflict.',
        '',
      ].join('\n')
    : '';
  const petPresenceRule = input.petReplacementNote
    ? `Real pet detected in source: ${input.analysis.realPetDescription || 'replace only the real living pet already present in the source scene'}.`
    : 'No real living pet replacement is active for this source image. Do not introduce a new cat, dog, or other living pet. Printed/cartoon/illustrated pets, mascots, package graphics, and product decorations must stay as product/graphic details only.';

  return [
    'Create one redesigned ecommerce carousel image using the uploaded manufacturer promotional image as the source reference.',
    `Source image number: ${input.sourceIndex + 1}.`,
    petRule,
    brandLogoRule,
    'Use image-to-image mode. Preserve the real product identity, shape, materials, proportions, colors, packaging, logo placement if present, and recognizable details from the source image.',
    "Do not copy the original crowded layout. Rebuild the visual composition according to the user's style and copy-selection requirements.",
    `Product subject: ${input.analysis.productSubject}.`,
    `Product visuals to preserve: ${input.analysis.productVisuals}.`,
    petPresenceRule,
    `Key messages extracted from source: ${input.analysis.keyMessages.join('; ') || 'infer from the source image'}.`,
    'Visual hierarchy extracted from source:',
    `- Main headline: ${hierarchy.primaryText || 'none detected'}`,
    `- Secondary text: ${hierarchy.secondaryText.join('; ') || 'none detected'}`,
    `- Specs: ${hierarchy.specs.join('; ') || 'none detected'}`,
    `- Badges: ${hierarchy.badges.join('; ') || 'none detected'}`,
    `- Logo or brand text: ${hierarchy.logoText.join('; ') || 'none detected'}`,
    `- Decorative text: ${hierarchy.decorativeText.join('; ') || 'none detected'}`,
    `- Layout: ${hierarchy.layout}`,
    `Rewrite guidance from analysis: ${input.analysis.rewriteGuidance}.`,
    `User style and copy-selection requirements (MUST follow): ${customRequirements}`,
    languageInstruction(input.textLanguage),
    input.textLanguage === 'zh'
      ? ''
      : 'Final visible marketing text must be in the selected output language. Do not copy Chinese/Japanese/Korean/Arabic/Hebrew/Russian/Hindi source marketing headlines, subheads, badges, or selling-point copy unless they are product logos, brand marks, model names, or text printed on the physical product/packaging.',
    'Keep the final image clean, premium, legible, and product-led. Avoid dense copy, fake certifications, fake logos, watermarks, QR codes, prices, and unrelated props.',
  ].filter(Boolean).join('\n');
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
    `Create a storyboard image for a 10-second ecommerce marketplace product advertisement using the uploaded product photo${input.numViews > 1 ? 's' : ''}.`,
    input.numViews > 1
      ? 'Use the front, side, and back views to accurately represent the product through the storyboard beats.'
      : 'Use the product photo as the strict identity reference and preserve the exact product.',
    `Visible text language: ${ecommerceListingLanguageName(input.textLanguage)}.`,
    languageInstruction(input.textLanguage),
    'Storyboard structure: 4 compact clean beats in a grid: product reveal, macro detail, benefit/use moment, final hero shot.',
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
      ? 'Create a 10-second ecommerce product advertisement using the provided product photos and storyboard image as visual references.'
      : 'Create a 10-second ecommerce product advertisement using the provided product photo and storyboard image as visual references.',
    input.numViews > 1
      ? 'Use the product views to animate the product from accurate perspectives: reveal, macro detail, benefit/use moment, final hero shot.'
      : 'Preserve the exact product appearance, proportions, materials, color, and recognizable details.',
    `Visible text and any generated audio language: ${ecommerceListingLanguageName(input.textLanguage)}.`,
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
