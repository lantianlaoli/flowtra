import type { CanonicalAnalysisV2 } from '@/lib/video-analysis-schema';

export type SystemReferenceVideo = {
  id: string;
  reference_name: string;
  analysis_status: 'completed';
  analysis_result: CanonicalAnalysisV2;
  language: string;
  analyzed_at: string;
  video_duration_seconds: number;
  source_storage_bucket: string;
  source_storage_path: string;
  created_at: string;
  updated_at: string;
  isSystem: true;
};

const SYSTEM_REFERENCE_VIDEO_TIMESTAMP = '2024-01-01T00:00:00.000Z';
const SYSTEM_REFERENCE_VIDEO_BASE_URL =
  'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/videos';

const buildSystemReferenceVideoUrl = (fileName: string) =>
  `${SYSTEM_REFERENCE_VIDEO_BASE_URL}/${encodeURIComponent(fileName)}`;

const createSystemReferenceVideo = ({
  id,
  referenceName,
  fileName,
  analysisResult,
  language,
  durationSeconds,
}: {
  id: string;
  referenceName: string;
  fileName: string;
  analysisResult: CanonicalAnalysisV2;
  language: string;
  durationSeconds: number;
}): SystemReferenceVideo => ({
  id,
  reference_name: referenceName,
  analysis_status: 'completed',
  analysis_result: analysisResult,
  language,
  analyzed_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  video_duration_seconds: durationSeconds,
  source_storage_bucket: 'site-assets',
  source_storage_path: `defaults/videos/${fileName}`,
  created_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  updated_at: SYSTEM_REFERENCE_VIDEO_TIMESTAMP,
  isSystem: true,
});

export const SYSTEM_REFERENCE_VIDEOS: SystemReferenceVideo[] = [
  createSystemReferenceVideo({
    id: 'system-default-cerave',
    referenceName: 'CeraVe Hydrating Cleanser',
    fileName: 'cerave_hydrating_cleanser.mp4',
    analysisResult: {
      "schema_version": 2,
      "name": "cerave-hydrating-cleanser-testimonial",
      "detected_language": "en",
      "video_duration_seconds": 6,
      "shots": [
        {
          "shot_id": 1,
          "timing": {
            "start_time": "00:00",
            "end_time": "00:00",
            "duration_seconds": 6
          },
          "opening_frame": {
            "description": "The video opens with a medium close-up shot of a young woman with long blonde hair, wearing a beige pajama top patterned with brown teddy bears. She is positioned slightly off-center to the right, holding a large white bottle of CeraVe Hydrating Cleanser prominently in her left hand towards the camera. Her right hand is raised in a conversational gesture. The bottle, with its distinctive green pump and blue logo, occupies the left foreground, clearly in focus. The woman has a hair clip on the left side of her head and is looking directly at the camera with an engaged, slightly animated expression, her mouth open as if speaking. The background is a softly lit, slightly out-of-focus bedroom or dressing room, with white closet doors or a wardrobe visible behind her, and a shelf with blurred items to the right."
          },
          "visual": {
            "subject": "Young woman and CeraVe Hydrating Cleanser bottle",
            "action": "The woman holds the product bottle toward the camera with one hand while gesturing expressively with the other, speaking directly to the viewer about the cleanser.",
            "environment": "Indoor personal space, likely a bedroom or dressing room, with white closet doors and shelving in the background.",
            "style": "Authentic, direct-to-camera social media testimonial or review.",
            "camera": "Static medium close-up shot, likely from a smartphone.",
            "composition": "Product is held in the left foreground, the presenter is in the right midground, with a shallow depth of field creating separation from the background.",
            "focus_lens_effects": "Shallow depth of field keeps the woman and the product bottle sharp, while the background is softly blurred.",
            "ambiance": "Bright, even indoor lighting, creating a clean and approachable atmosphere."
          },
          "audio": {
            "dialogue": "This one in the winter, if you suffer from dry skin, is a game changer.",
            "sfx": "",
            "ambient": "Quiet indoor room tone."
          },
          "flags": {}
        }
      ]
    },
    language: 'en',
    durationSeconds: 6,
  }),
  createSystemReferenceVideo({
    id: 'system-default-goli',
    referenceName: 'Goli Gummies Men Showcase',
    fileName: 'goli_gummies_men_showcase.mp4',
    analysisResult: {
      "schema_version": 2,
      "name": "goli-gummies-zero-sugar-trio-promo",
      "detected_language": "en",
      "video_duration_seconds": 14,
      "shots": [
        {
          "shot_id": 1,
          "timing": {
            "start_time": "00:00",
            "end_time": "00:14",
            "duration_seconds": 14
          },
          "opening_frame": {
            "description": "The shot opens on a medium close-up of an African American man centered in the frame, wearing a light blue hoodie. He is holding three bottles of Goli nutrition gummies (red, blue, and green) close to the camera lens, effectively framing his lower face and chest. The background is a domestic room with dark acoustic curtains and a strip of blue LED lighting running along the ceiling edge, creating a cool, cyber-aesthetic rim light. The foreground is dominated by the product bottles, which are sharply in focus, while the man's face is slightly further back but equally clear. He is smiling slightly, engaging directly with the viewer."
          },
          "visual": {
            "subject": "African American man and Goli gummy bottles",
            "action": "Presenter holds up three different colored bottles close to the camera, gesturing with them slightly to emphasize the 'trio' aspect while speaking enthusiastically to the audience.",
            "environment": "Indoor home studio or room with dark background curtains and blue LED strip lighting near the ceiling.",
            "style": "Direct-to-camera social media advertisement, casual and high-energy.",
            "camera": "Static medium close-up, likely a smartphone front-facing camera, with a wide angle that exaggerates the size of the hands and bottles in the foreground.",
            "composition": "Centered subject with products held in a horizontal row across the frame, acting as the primary visual anchor.",
            "focus_lens_effects": "Wide-angle lens distortion on the bottles and hands in the foreground.",
            "ambiance": "Artificial studio lighting on the face, contrasted by cool blue ambient LED strip light in the background."
          },
          "audio": {
            "dialogue": "",
            "sfx": "",
            "ambient": "Production audio around: Presenter holds up three different colored bottles close to the camera, gesturing with them slightly to emphasize the 'trio' aspect while speaking enthusiastically to the audience."
          },
          "flags": {}
        }
      ]
    },
    language: 'en',
    durationSeconds: 14,
  }),
  createSystemReferenceVideo({
    id: 'system-default-lavalier',
    referenceName: 'Lavalier Mic Showcase',
    fileName: 'lavalier_mic_showcase.mp4',
    analysisResult: {
      "schema_version": 2,
      "name": "wireless-lavalier-mic-noise-reduction",
      "detected_language": "ms",
      "video_duration_seconds": 7,
      "shots": [
        {
          "shot_id": 1,
          "timing": {
            "start_time": "00:00",
            "end_time": "00:02",
            "duration_seconds": 2
          },
          "opening_frame": {
            "description": "A young woman wearing a mauve long-sleeved shirt and a taupe hijab stands outdoors on an asphalt path, gesturing with her right hand and speaking to the camera. Trees and greenery are visible in the background, with a blue fence and white building visible in the distance. She holds a small black rectangular object in her left hand."
          },
          "visual": {
            "subject": "Young woman in hijab",
            "action": "Speaking to camera, gesturing with right hand, holding a black object in left hand",
            "environment": "Outdoor park or street with asphalt path, trees, greenery, blue fence, distant building",
            "style": "Lifestyle vlog, social media advertisement",
            "camera": "Medium shot, static, eye-level",
            "composition": "Subject centered",
            "focus_lens_effects": "Shallow depth of field with subject in sharp focus",
            "ambiance": "Overcast daylight, natural lighting"
          },
          "audio": {
            "dialogue": "",
            "sfx": "",
            "ambient": "Production audio around: Speaking to camera, gesturing with right hand, holding a black object in left hand"
          },
          "flags": {}
        },
        {
          "shot_id": 2,
          "timing": {
            "start_time": "00:02",
            "end_time": "00:07",
            "duration_seconds": 5
          },
          "opening_frame": {
            "description": "The woman brings both hands up, holding an open black charging case revealing yellow interior accents. She uses her right hand to pick out a small black wireless microphone receiver from the case, holding it up for the camera to see clearly. She continues to speak directly to the camera."
          },
          "visual": {
            "subject": "Young woman and wireless microphone kit",
            "action": "Opens charging case, picks out receiver, gestures with it towards the camera",
            "environment": "Same outdoor setting, asphalt path, trees, blue fence",
            "style": "Lifestyle vlog, product demonstration",
            "camera": "Close-up on hands and product initially, then zooming out slightly to include subject's face, handheld feel",
            "composition": "Subject centered, focus on product in hands",
            "focus_lens_effects": "Shallow depth of field, focus shifts to product",
            "ambiance": "Overcast daylight, natural lighting"
          },
          "audio": {
            "dialogue": "",
            "sfx": "",
            "ambient": "Production audio around: Opens charging case, picks out receiver, gestures with it towards the camera"
          },
          "flags": {}
        }
      ]
    },
    language: 'en',
    durationSeconds: 7,
  }),
];

export const isSystemReferenceVideoId = (
  videoId: string | null | undefined
): boolean => {
  if (!videoId) return false;
  return SYSTEM_REFERENCE_VIDEOS.some((video) => video.id === videoId);
};

export const getSystemReferenceVideoById = (
  videoId: string | null | undefined
): SystemReferenceVideo | null => {
  if (!videoId) return null;
  return SYSTEM_REFERENCE_VIDEOS.find((video) => video.id === videoId) || null;
};

export const toVideoAssetLike = (
  systemVideo: SystemReferenceVideo
): Record<string, unknown> => ({
  id: systemVideo.id,
  user_id: 'system',
  source_id: systemVideo.id,
  platform: 'tiktok',
  platform_video_id: systemVideo.id,
  video_url: '',
  video_cdn_url: buildSystemReferenceVideoUrl(
    systemVideo.source_storage_path.replace('defaults/videos/', '')
  ),
  cover_url: null,
  description: systemVideo.reference_name,
  stats: null,
  duration_seconds: systemVideo.video_duration_seconds,
  analysis_status: systemVideo.analysis_status,
  analysis_result: systemVideo.analysis_result,
  analysis_error: null,
  analysis_language: systemVideo.language,
  analyzed_at: systemVideo.analyzed_at,
  created_at: systemVideo.created_at,
  updated_at: systemVideo.updated_at,
  source_name: 'Default',
  reference_video_id: systemVideo.id,
  isSystem: true,
});
