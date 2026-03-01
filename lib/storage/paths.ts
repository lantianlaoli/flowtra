import { STORAGE_BUCKETS, type StorageBucket } from './types'

const sanitizeSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset'

const sanitizeFileStem = (value: string) =>
  value
    .trim()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file'

export const sanitizeStorageFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '_')

export const getFileExtension = (fileName: string, fallback = 'bin') => {
  const ext = fileName.split('.').pop()?.trim().toLowerCase()
  return ext && ext !== fileName.trim().toLowerCase() ? ext : fallback
}

const buildFileName = (name: string, ext: string) => `${sanitizeFileStem(name)}.${ext}`

export const buildSiteAssetPath = ({
  section,
  slug,
  assetName,
  extension,
}: {
  section: 'blog/covers' | 'blog/media' | 'landing' | 'showcase' | 'defaults/avatars' | 'examples/avatar-quality'
  slug?: string
  assetName: string
  extension: string
}) => {
  const normalizedAsset = buildFileName(assetName, extension)
  return slug
    ? `${section}/${sanitizeSegment(slug)}/${normalizedAsset}`
    : `${section}/${normalizedAsset}`
}

export const buildUserAvatarImagePath = ({
  userId,
  avatarId,
  extension,
  referenceIndex,
}: {
  userId: string
  avatarId: string
  extension: string
  referenceIndex?: number
}) => {
  const basePath = `users/${sanitizeSegment(userId)}/avatars/${sanitizeSegment(avatarId)}`

  if (typeof referenceIndex === 'number') {
    return `${basePath}/references/reference-${String(referenceIndex + 1).padStart(2, '0')}.${extension}`
  }

  return `${basePath}/primary/original.${extension}`
}

export const buildUserProductPhotoPath = ({
  userId,
  productId,
  photoId,
  extension,
  variant = 'original',
}: {
  userId: string
  productId: string
  photoId: string
  extension: string
  variant?: 'original' | 'purified'
}) =>
  `users/${sanitizeSegment(userId)}/products/${sanitizeSegment(productId)}/photos/${sanitizeSegment(photoId)}/${variant}.${extension}`

export const buildCreatorVideoPath = ({
  userId,
  creatorVideoId,
  extension,
  variant = 'source',
}: {
  userId: string
  creatorVideoId: string
  extension: string
  variant?: 'source' | 'cover'
}) =>
  `users/${sanitizeSegment(userId)}/creator-videos/${sanitizeSegment(creatorVideoId)}/${variant}/original.${extension}`

export const buildCompetitorAdSourcePath = ({
  userId,
  competitorAdId,
  extension,
}: {
  userId: string
  competitorAdId: string
  extension: string
}) =>
  `users/${sanitizeSegment(userId)}/competitor-ads/${sanitizeSegment(competitorAdId)}/source/original.${extension}`

export const buildToolTempUploadPath = ({
  userId,
  sessionId,
  kind,
  fileName,
}: {
  userId: string
  sessionId: string
  kind: 'video' | 'image'
  fileName: string
}) => {
  const extension = getFileExtension(fileName, kind === 'video' ? 'mp4' : 'png')
  return `users/${sanitizeSegment(userId)}/tools/${sanitizeSegment(sessionId)}/${kind}/${buildFileName(fileName, extension)}`
}

export const buildCompetitorAdTempUploadPath = ({
  userId,
  draftId,
  fileName,
}: {
  userId: string
  draftId: string
  fileName: string
}) => {
  const extension = getFileExtension(fileName, 'mp4')
  return `users/${sanitizeSegment(userId)}/competitor-ads/drafts/${sanitizeSegment(draftId)}/source.${extension}`
}

export const buildTempProductPhotoPath = ({
  userId,
  draftId,
  fileName,
}: {
  userId: string
  draftId: string
  fileName: string
}) => {
  const extension = getFileExtension(fileName, 'png')
  return `users/${sanitizeSegment(userId)}/products/drafts/${sanitizeSegment(draftId)}/original.${extension}`
}

export const buildAvatarAdsDraftUploadPath = ({
  userId,
  draftId,
  role,
  index,
  fileName,
}: {
  userId: string
  draftId: string
  role: 'person' | 'product'
  index: number
  fileName: string
}) => {
  const extension = getFileExtension(fileName, 'png')
  return `users/${sanitizeSegment(userId)}/avatar-ads/drafts/${sanitizeSegment(draftId)}/${role}/${index}.${extension}`
}

export const getBucketForPathBuilder = {
  siteAsset: STORAGE_BUCKETS.siteAssets,
  avatarImage: STORAGE_BUCKETS.userImages,
  productImage: STORAGE_BUCKETS.userImages,
  creatorVideo: STORAGE_BUCKETS.userVideos,
  creatorVideoCover: STORAGE_BUCKETS.userImages,
  competitorVideo: STORAGE_BUCKETS.userVideos,
  tempUpload: STORAGE_BUCKETS.tempUploads,
} satisfies Record<string, StorageBucket>
