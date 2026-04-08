export interface ShareImageShot {
  shot_id?: number;
  start_time?: string;
  action?: string;
  first_frame_description?: string;
  audio?: string;
}

export interface ShareImageAnalysis {
  name: string;
  detected_language: string;
  video_duration_seconds: number;
  shots: ShareImageShot[];
}

interface ClerkDisplayNameSource {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  emailAddress?: string | null;
}

interface ShareImagePromptInput {
  analysis: ShareImageAnalysis;
  creatorUsername: string;
  generatedAt?: Date;
}

interface ShareImagePromptShot {
  shotNumber: string;
  startTime: string;
  action: string;
  description: string;
  audio?: string;
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^["'\-:;,.\s]+|["'\-:;,.\s]+$/g, '')
    .trim();

  return cleaned.length ? cleaned : null;
}

export function resolveClerkDisplayName(user?: ClerkDisplayNameSource | null): string {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (cleanText(user?.firstName)) return user!.firstName!.trim();
  if (cleanText(user?.username)) return user!.username!.trim();
  if (cleanText(user?.emailAddress)) {
    const emailLocalPart = user!.emailAddress!.split('@')[0]?.trim();
    if (emailLocalPart) {
      return emailLocalPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
    }
  }
  return 'Flowtra Creator';
}

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, '').trim();
}

function compressShotTextForShareImage(
  value: string | null | undefined,
  maxLength: number,
  fallback: string
): string {
  const cleaned = cleanText(value) || fallback;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatLanguage(language: string): string {
  const cleaned = cleanText(language);
  if (!cleaned) return 'English';
  return cleaned.toUpperCase() === cleaned && cleaned.length <= 5 ? cleaned : cleaned;
}

export function buildShareImageShots(analysis: ShareImageAnalysis): ShareImagePromptShot[] {
  return analysis.shots.map((shot, index) => ({
    shotNumber: String(shot.shot_id ?? index + 1),
    startTime: cleanText(shot.start_time) || `00:${String(index).padStart(2, '0')}`,
    action: compressShotTextForShareImage(shot.action, 110, 'Visual beat not specified'),
    description: compressShotTextForShareImage(
      shot.first_frame_description,
      180,
      'Scene description not provided'
    ),
    audio: cleanText(shot.audio)
      ? compressShotTextForShareImage(shot.audio, 120, '')
      : undefined,
  }));
}

export function buildShareImagePrompt({
  analysis,
  creatorUsername,
  generatedAt = new Date(),
}: ShareImagePromptInput): string {
  const formattedDate = generatedAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const sanitizedUsername = normalizeUsername(creatorUsername) || 'flowtra-user';
  const shots = buildShareImageShots(analysis);

  const shotLines = shots.flatMap((shot) => {
    const lines = [
      `Shot ${shot.shotNumber} | ${shot.startTime}`,
      `Action: ${shot.action}`,
      `Description: ${shot.description}`,
    ];

    if (shot.audio) {
      lines.push(`Audio: ${shot.audio}`);
    }

    return lines;
  });

  return [
    'Create a single 9:16 editorial analysis poster, not a marketing card.',
    'This image must look like a true AI analysis document with compact but readable typography and dense information layout.',
    'Use the attached PNG reference image as the exact Flowtra landing-page brand reference. Reproduce that exact Flowtra branding treatment faithfully and do not invent a new logo.',
    'Branding must stay compact and secondary to the analysis content.',
    'Do not use any @ symbol in the attribution.',
    'Do not write "AI Analysis", "Flowtra Creator", "By Name | @username", or any promotional footer slogans.',
    'Top header text must be exactly: TikTok Viral Video Rapid Analysis',
    `Attribution text must be exactly: By ${sanitizedUsername}`,
    `Metadata row must include: ${formattedDate} | ${formatLanguage(analysis.detected_language)} | ${analysis.video_duration_seconds}s | ${analysis.shots.length} shots`,
    'The main body must show the shot analysis itself, not a summary.',
    'Render every shot in order from shot 1 onward. Do not omit later shots unless physically impossible to fit.',
    'When space is tight, compress the text slightly but preserve all shot entries and their order.',
    'Every shot entry should visibly include shot number, time, action, description, and audio if present.',
    'Keep the title smaller than a hero poster and prioritize the shot-analysis body over decorative whitespace.',
    'All visible text must be factual, legible, and in English.',
    'Use a monochrome editorial style: off-white background, black and gray typography, subtle rules and dividers.',
    'The poster must include the following exact content blocks:',
    `Header: TikTok Viral Video Rapid Analysis`,
    `Byline: By ${sanitizedUsername}`,
    `Meta: ${formattedDate} | ${formatLanguage(analysis.detected_language)} | ${analysis.video_duration_seconds}s | ${analysis.shots.length} shots`,
    ...shotLines,
  ].join('\n');
}
