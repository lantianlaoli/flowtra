import { fetchWithRetry } from '@/lib/fetchWithRetry';

interface TikTokUserInfoResponse {
  userInfo?: {
    user?: {
      uniqueId?: string;
      nickname?: string;
      signature?: string;
      verified?: boolean;
      secUid?: string;
      avatarLarger?: string;
      avatarMedium?: string;
      avatarThumb?: string;
    };
    stats?: Record<string, number>;
    statsV2?: Record<string, string>;
  };
  statusCode?: number;
}

interface TikTokUserPostsResponse {
  data?: {
    cursor?: string;
    hasMore?: boolean;
    itemList?: Array<Record<string, any>>;
  };
}

const RAPIDAPI_BASE_URL = 'https://tiktok-api23.p.rapidapi.com';

const RAPIDAPI_HEADERS = {
  'x-rapidapi-key': process.env.RAPID_API_KEY || '',
  'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
};

export const parseTikTokHandle = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/tiktok\.com\/(@[^/?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].replace('@', '').trim();
  }

  if (trimmed.startsWith('@')) {
    return trimmed.slice(1).trim();
  }

  return trimmed;
};

const ensureRapidApiKey = () => {
  if (!process.env.RAPID_API_KEY) {
    throw new Error('RapidAPI key is not configured');
  }
};

export const fetchTikTokUserInfo = async (handle: string): Promise<TikTokUserInfoResponse> => {
  ensureRapidApiKey();

  const url = `${RAPIDAPI_BASE_URL}/api/user/info?uniqueId=${encodeURIComponent(handle)}`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: RAPIDAPI_HEADERS
  }, 3, 15000);

  if (!response.ok) {
    throw new Error(`TikTok user info request failed: ${response.status}`);
  }

  return response.json() as Promise<TikTokUserInfoResponse>;
};

export const fetchTikTokUserPosts = async (
  secUid: string,
  count: number = 12,
  cursor: string = '0'
): Promise<TikTokUserPostsResponse> => {
  ensureRapidApiKey();

  const url = `${RAPIDAPI_BASE_URL}/api/user/posts?secUid=${encodeURIComponent(secUid)}&count=${count}&cursor=${encodeURIComponent(cursor)}`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: RAPIDAPI_HEADERS
  }, 3, 15000);

  if (!response.ok) {
    throw new Error(`TikTok user posts request failed: ${response.status}`);
  }

  return response.json() as Promise<TikTokUserPostsResponse>;
};

export const resolveTikTokProfileUrl = (handle: string) => {
  return `https://www.tiktok.com/@${handle}`;
};

export const buildTikTokVideoUrl = (handle: string, videoId: string) => {
  return `https://www.tiktok.com/@${handle}/video/${videoId}`;
};

export const extractTikTokCoverUrl = (video: Record<string, any>) => {
  if (video?.zoomCover && typeof video.zoomCover === 'object') {
    return video.zoomCover['960'] || video.zoomCover['720'] || video.zoomCover['480'] || null;
  }

  return video?.cover || video?.originCover || null;
};

export const extractTikTokDuration = (video: Record<string, any>) => {
  const rawDuration = video?.duration;
  if (rawDuration === undefined || rawDuration === null) return null;

  const parsed = Number(rawDuration);
  return Number.isFinite(parsed) ? parsed : null;
};

export const extractTikTokPlayUrl = (video: Record<string, any>) => {
  if (!video || typeof video !== 'object') return null;
  return video.playAddr || video.downloadAddr || video.play || null;
};
