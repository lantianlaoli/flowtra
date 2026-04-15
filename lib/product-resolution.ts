import { getSupabaseAdmin } from '@/lib/supabase';
import { getSystemProductById, getSystemProductPhotoUrls, isSystemProductId } from '@/lib/default-products';

type ProductResolution = {
  found: boolean;
  source: 'system' | 'user' | null;
  productName: string | null;
  photoUrls: string[];
  persistableProductId: string | null;
  frontalPhotoUrl: string | null;
  frontalPhotoId: string | null;
};

const emptyResolution = (): ProductResolution => ({
  found: false,
  source: null,
  productName: null,
  photoUrls: [],
  persistableProductId: null,
  frontalPhotoUrl: null,
  frontalPhotoId: null,
});

export async function resolveProductForUser({
  supabase,
  userId,
  productId,
  maxPhotos = 8,
}: {
  supabase?: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  productId: string;
  maxPhotos?: number;
}): Promise<ProductResolution> {
  if (!productId) {
    return emptyResolution();
  }

  if (isSystemProductId(productId)) {
    const systemProduct = getSystemProductById(productId);
    if (!systemProduct) {
      return emptyResolution();
    }

    const photoUrls = getSystemProductPhotoUrls(systemProduct, maxPhotos);
    return {
      found: true,
      source: 'system',
      productName: systemProduct.product_name,
      photoUrls,
      persistableProductId: null,
      frontalPhotoUrl: photoUrls[0] || null,
      frontalPhotoId: null,
    };
  }

  const db = supabase || getSupabaseAdmin();

  const { data: product, error } = await db
    .from('user_products')
    .select('id,product_name,user_product_photos(id,photo_url,is_primary)')
    .eq('id', productId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !product) {
    return emptyResolution();
  }

  const orderedPhotos = [
    ...(product.user_product_photos || []).filter((photo) => photo.is_primary),
    ...(product.user_product_photos || []).filter((photo) => !photo.is_primary),
  ];

  const seen = new Set<string>();
  const photoUrls: string[] = [];
  for (const photo of orderedPhotos) {
    const url = (photo.photo_url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    photoUrls.push(url);
    if (photoUrls.length >= maxPhotos) break;
  }

  return {
    found: true,
    source: 'user',
    productName: product.product_name || null,
    photoUrls,
    persistableProductId: product.id,
    frontalPhotoUrl: photoUrls[0] || null,
    frontalPhotoId: orderedPhotos[0]?.id || null,
  };
}
