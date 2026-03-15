import { getSupabaseAdmin } from "@/lib/supabase";
import { getAvatarPhotoUrls, SYSTEM_AVATARS } from "@/lib/default-avatars";
import { MENTION_TOKEN_REGEX, normalizeMentionLabel, parseMentionToken } from "@/lib/prompt-mention-tokens";

export type KlingMentionType = "character" | "product" | "unknown";

export type KlingMention = {
  type: KlingMentionType;
  name: string;
  key: string;
};

export type KlingElement = {
  name: string;
  description: string;
  element_input_urls: string[];
};

export function collectKlingMentions(texts: string[]): KlingMention[] {
  const map = new Map<string, KlingMention>();

  texts.forEach((text) => {
    if (!text) return;

    for (const match of text.matchAll(MENTION_TOKEN_REGEX)) {
      const parsed = parseMentionToken(match[0]);
      const type = parsed?.type as KlingMentionType | undefined;
      const name = (parsed?.label || "").trim();
      const keyName = parsed?.key || normalizeMentionLabel(name);
      if (!type || !keyName) continue;

      const key = `${type}:${keyName}`;
      if (!map.has(key)) {
        map.set(key, { type, name: keyName, key });
      }
    }
  });

  return Array.from(map.values());
}

export function replacePromptMentionsWithKlingElements(
  text: string,
  tokenMap: Record<string, string>,
  _plainTokenMap: Record<string, string>,
): string {
  if (!text) return text;

  return text.replace(MENTION_TOKEN_REGEX, (match) => {
    const parsed = parseMentionToken(match);
    if (!parsed) return match;

    const keyName = parsed.key || normalizeMentionLabel(String(parsed.label || ""));
    if (!keyName) {
      return parsed.syntax === "typed" ? String(parsed.label || "").trim() : match;
    }

    const key = `${parsed.type}:${keyName}`;
    const mapped = tokenMap[key];
    if (mapped) {
      return `@${mapped}`;
    }

    return parsed.syntax === "typed" ? `@${keyName}` : match;
  });
}

export async function buildKlingElementsFromMentions(
  userId: string,
  mentions: KlingMention[],
): Promise<{
  elements: KlingElement[];
  tokenMap: Record<string, string>;
  plainTokenMap: Record<string, string>;
  skippedMentions: KlingMention[];
}> {
  if (!mentions.length) {
    return { elements: [], tokenMap: {}, plainTokenMap: {}, skippedMentions: [] };
  }

  const mentionNames = Array.from(new Set(mentions.map((mention) => mention.name)));
  const supabase = getSupabaseAdmin();

  const [productResult, avatarResult] = await Promise.all([
    supabase
      .from("user_products")
      .select("id,product_name,user_product_photos(photo_url,is_primary)")
      .eq("user_id", userId),
    supabase
      .from("user_avatars")
      .select("id,avatar_name,photo_url,photo_set_json")
      .eq("user_id", userId),
  ]);

  if (productResult.error) {
    console.error("[Kling Elements] Failed to fetch products:", productResult.error);
  }
  if (avatarResult.error) {
    console.error("[Kling Elements] Failed to fetch avatars:", avatarResult.error);
  }

  const products = (productResult.data || []).filter((product) =>
    mentionNames.includes(normalizeMentionLabel(product.product_name || "")),
  );
  const userAvatars = (avatarResult.data || []).filter((avatar) =>
    mentionNames.includes(normalizeMentionLabel(avatar.avatar_name || "")),
  );
  const systemAvatars = SYSTEM_AVATARS.filter((avatar) =>
    mentionNames.includes(normalizeMentionLabel(avatar.avatar_name || "")),
  );
  const avatars = [...systemAvatars, ...userAvatars];

  const productsByName = new Map(
    products.map((product) => [normalizeMentionLabel(product.product_name || ""), product]),
  );
  const avatarsByName = new Map(
    avatars.map((avatar) => [normalizeMentionLabel(avatar.avatar_name || ""), avatar]),
  );

  const tokenMap: Record<string, string> = {};
  const plainTokenMap: Record<string, string> = {};
  const elements: KlingElement[] = [];
  const skippedMentions: KlingMention[] = [];

  mentions.forEach((mention) => {
    const mentionNameKey = mention.name;
    const product =
      mention.type === "character"
        ? undefined
        : productsByName.get(mentionNameKey);
    const avatar =
      mention.type === "product"
        ? undefined
        : avatarsByName.get(mentionNameKey);

    if (mention.type === "unknown" && product && avatar) {
      throw new Error(`Ambiguous mention @${mention.name}: matches both an avatar and a product. Rename one asset or use a unique name.`);
    }

    const productUrls = product?.user_product_photos
      ? [
          ...product.user_product_photos
            .sort(
              (a, b) =>
                Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
            )
            .map((photo) => photo.photo_url),
        ]
      : [];
    const avatarUrls = getAvatarPhotoUrls(
      avatar as Parameters<typeof getAvatarPhotoUrls>[0],
    );
    const urls = Array.from(
      new Set(
        [
          ...(mention.type === "product" ? productUrls : avatarUrls),
        ].filter(Boolean) as string[],
      ),
    ).slice(0, 4);

    if (urls.length < 2) {
      skippedMentions.push(mention);
      return;
    }

    const elementName = mention.name;
    tokenMap[mention.key] = elementName;
    plainTokenMap[mentionNameKey] = elementName;

    elements.push({
      name: elementName,
      description:
        mention.type === "product"
          ? product?.product_name || mention.name
          : avatar?.avatar_name || mention.name,
      element_input_urls: urls,
    });
  });

  return { elements, tokenMap, plainTokenMap, skippedMentions };
}
