import type { UserProduct, UserProductPhoto } from '@/lib/supabase';

export type SystemProduct = {
  id: string;
  product_name: string;
  created_at: string;
  updated_at: string;
  isSystem: true;
  user_product_photos: UserProductPhoto[];
};

const SYSTEM_PRODUCT_TIMESTAMP = '2024-01-01T00:00:00.000Z';
const SYSTEM_PRODUCT_BASE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/products';

const encodePathSegment = (value: string) => encodeURIComponent(value).replace(/%2F/g, '/');

const buildSystemProductUrl = (fileName: string) => `${SYSTEM_PRODUCT_BASE_URL}/${encodePathSegment(fileName)}`;

const buildSystemProductPhoto = ({
  id,
  productId,
  fileName,
  photoRole,
  isPrimary,
}: {
  id: string;
  productId: string;
  fileName: string;
  photoRole: 'frontal' | 'reference';
  isPrimary: boolean;
}): UserProductPhoto => ({
  id,
  product_id: productId,
  user_id: 'system',
  photo_url: buildSystemProductUrl(fileName),
  file_name: fileName,
  storage_bucket: 'site-assets',
  storage_path: `defaults/products/${fileName}`,
  photo_role: photoRole,
  is_primary: isPrimary,
  created_at: SYSTEM_PRODUCT_TIMESTAMP,
  updated_at: SYSTEM_PRODUCT_TIMESTAMP,
});

const createSystemProduct = ({
  id,
  productName,
  frontal,
  references,
}: {
  id: string;
  productName: string;
  frontal: string;
  references: [string, string, string];
}): SystemProduct => {
  const photos = [
    buildSystemProductPhoto({
      id: `${id}-frontal`,
      productId: id,
      fileName: frontal,
      photoRole: 'frontal',
      isPrimary: true,
    }),
    ...references.map((fileName, index) =>
      buildSystemProductPhoto({
        id: `${id}-ref-${index + 1}`,
        productId: id,
        fileName,
        photoRole: 'reference',
        isPrimary: false,
      })
    ),
  ];

  return {
    id,
    product_name: productName,
    created_at: SYSTEM_PRODUCT_TIMESTAMP,
    updated_at: SYSTEM_PRODUCT_TIMESTAMP,
    isSystem: true,
    user_product_photos: photos,
  };
};

export const SYSTEM_PRODUCTS: SystemProduct[] = [
  createSystemProduct({
    id: 'aef3a8f1-bc0c-42ab-8d46-319f58f31f41',
    productName: 'Collagen Peptides Jar',
    frontal: 'collagen_peptides_jar.png',
    references: [
      'collagen_peptides_jar_left.png',
      'collagen_peptides_jar_back.png',
      'collagen_peptides_jar_right.jpeg',
    ],
  }),
  createSystemProduct({
    id: 'd44a7f2d-e9a0-4bc0-8d1f-25a18b94f7db',
    productName: 'Herbal Wellness Pouch',
    frontal: 'herbal_wellness_pouch.png',
    references: [
      'herbal_wellness_ pouch_left.png',
      'herbal_wellness_ pouch_back.png',
      'herbal_wellness_ pouch_right.png',
    ],
  }),
];

export const isSystemProductId = (productId: string | null | undefined): boolean => {
  if (!productId) return false;
  return SYSTEM_PRODUCTS.some((product) => product.id === productId);
};

export const getSystemProductById = (productId: string | null | undefined): SystemProduct | null => {
  if (!productId) return null;
  return SYSTEM_PRODUCTS.find((product) => product.id === productId) || null;
};

export const toProductLikeWithPhotos = (systemProduct: SystemProduct): UserProduct & { isSystem: true } => ({
  id: systemProduct.id,
  user_id: 'system',
  product_name: systemProduct.product_name,
  created_at: systemProduct.created_at,
  updated_at: systemProduct.updated_at,
  user_product_photos: systemProduct.user_product_photos,
  isSystem: true,
});

export const getSystemProductPhotoUrls = (systemProduct: SystemProduct, max = 8): string[] => {
  const seen = new Set<string>();
  const orderedPhotos = [
    ...systemProduct.user_product_photos.filter((photo) => photo.is_primary || photo.photo_role === 'frontal'),
    ...systemProduct.user_product_photos.filter((photo) => !photo.is_primary && photo.photo_role !== 'frontal'),
  ];

  const urls: string[] = [];
  for (const photo of orderedPhotos) {
    const url = (photo.photo_url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= max) break;
  }

  return urls;
};
