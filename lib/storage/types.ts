export const STORAGE_BUCKETS = {
  siteAssets: 'site-assets',
  userImages: 'user-images',
  userVideos: 'user-videos',
  tempUploads: 'temp-uploads',
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

export type StorageObjectRef = {
  bucket: StorageBucket
  path: string
  publicUrl: string
}
