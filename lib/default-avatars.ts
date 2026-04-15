import type { AvatarPhotoEntry, AvatarPhotoSet } from '@/lib/supabase';

type AvatarPhotoLike = {
  photo_url?: string | null;
  photo_set_json?: AvatarPhotoSet | Record<string, unknown> | null;
  reference_photos?: Array<Partial<AvatarPhotoEntry> | Record<string, unknown>> | null;
};

export type SystemAvatar = {
  id: string;
  avatar_name: string;
  photo_url: string;
  file_name: string;
  primary_photo_url: string;
  photo_set_json: AvatarPhotoSet;
  reference_photos: AvatarPhotoEntry[];
  created_at: string;
  updated_at: string;
  isSystem: true;
};

const SYSTEM_AVATAR_BASE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/avatars';
const SYSTEM_AVATAR_TIMESTAMP = '2024-01-01T00:00:00.000Z';

const trimUrl = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const collectDistinctUrls = (values: Array<string | null | undefined>, max = 4): string[] => {
  const output: string[] = [];

  for (const value of values) {
    const trimmed = trimUrl(value);
    if (!trimmed || output.includes(trimmed)) continue;
    output.push(trimmed);
    if (output.length >= max) break;
  }

  return output;
};

const buildSystemAvatarUrl = (fileName: string) => `${SYSTEM_AVATAR_BASE_URL}/${fileName}`;

const createReferencePhoto = (fileName: string): AvatarPhotoEntry => ({
  photo_url: buildSystemAvatarUrl(fileName),
  file_name: fileName,
  tag: 'custom',
});

const createSystemAvatar = ({
  id,
  avatarName,
  primaryFileName,
  referenceFileNames,
}: {
  id: string;
  avatarName: string;
  primaryFileName: string;
  referenceFileNames: [string, string];
}): SystemAvatar => {
  const primaryPhotoUrl = buildSystemAvatarUrl(primaryFileName);
  const referencePhotos = referenceFileNames.map(createReferencePhoto);

  return {
    id,
    avatar_name: avatarName,
    photo_url: primaryPhotoUrl,
    file_name: primaryFileName,
    primary_photo_url: primaryPhotoUrl,
    photo_set_json: {
      primary: {
        photo_url: primaryPhotoUrl,
        file_name: primaryFileName,
      },
      references: referencePhotos,
      updated_at: SYSTEM_AVATAR_TIMESTAMP,
    },
    reference_photos: referencePhotos,
    created_at: SYSTEM_AVATAR_TIMESTAMP,
    updated_at: SYSTEM_AVATAR_TIMESTAMP,
    isSystem: true,
  };
};

export const getAvatarPhotoUrls = (avatar: AvatarPhotoLike | null | undefined, max = 4): string[] => {
  if (!avatar) return [];

  const urls: Array<string | null | undefined> = [avatar.photo_url];

  if (Array.isArray(avatar.reference_photos)) {
    avatar.reference_photos.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      urls.push((entry as Partial<AvatarPhotoEntry>).photo_url ?? null);
    });
  }

  if (avatar.photo_set_json && typeof avatar.photo_set_json === 'object') {
    const photoSet = avatar.photo_set_json as Record<string, unknown>;
    const primary = photoSet.primary && typeof photoSet.primary === 'object'
      ? (photoSet.primary as Record<string, unknown>)
      : null;
    const references = Array.isArray(photoSet.references)
      ? photoSet.references
      : [];

    urls.push(primary?.photo_url as string | undefined);

    references.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      urls.push((entry as Record<string, unknown>).photo_url as string | undefined);
    });
  }

  return collectDistinctUrls(urls, max);
};

export const SYSTEM_AVATARS: SystemAvatar[] = [
  createSystemAvatar({
    id: 'system-default-ethan',
    avatarName: 'Ethan Walker',
    primaryFileName: 'ethan_walker.png',
    referenceFileNames: ['ethan_walker_left.png', 'ethan_walker_back.png'],
  }),
  createSystemAvatar({
    id: 'system-default-lin',
    avatarName: 'Lin Yuqing',
    primaryFileName: 'lin_yuqing.png',
    referenceFileNames: ['lin_yuqing_left.png', 'lin_yuqing_back.png'],
  }),
];
