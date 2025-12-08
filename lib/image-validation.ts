const IMAGE_CONVERSION_TOOL_URL = 'https://www.simpleimageresizer.com/image-converter';

const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;

type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

export type ImageValidationResult =
  | { isValid: true }
  | { isValid: false; error: string };

const getFormatLabel = (fileType?: string | null) => {
  if (!fileType) return 'This file';
  const subtype = fileType.split('/')[1];
  return (subtype || fileType).toUpperCase();
};

export const IMAGE_CONVERSION_MESSAGE = `Please convert to JPG or PNG using this tool: ${IMAGE_CONVERSION_TOOL_URL}`;

export const IMAGE_CONVERSION_LINK = IMAGE_CONVERSION_TOOL_URL;

export function validateImageMimeType(fileType?: string | null): ImageValidationResult {
  if (!fileType) {
    return {
      isValid: false,
      error: `Unknown format is not supported. ${IMAGE_CONVERSION_MESSAGE}`
    };
  }

  const normalizedType = fileType.toLowerCase() as SupportedImageMimeType;

  if (SUPPORTED_IMAGE_MIME_TYPES.includes(normalizedType)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `${getFormatLabel(fileType)} format is not supported. ${IMAGE_CONVERSION_MESSAGE}`
  };
}

export function validateImageFormat(file: { type?: string | null } | null | undefined): ImageValidationResult {
  return validateImageMimeType(file?.type ?? null);
}

export function getAcceptedImageFormats() {
  return Array.from(new Set(SUPPORTED_IMAGE_MIME_TYPES)).join(',');
}

export function isSupportedImageType(fileType?: string | null) {
  return validateImageMimeType(fileType).isValid;
}
