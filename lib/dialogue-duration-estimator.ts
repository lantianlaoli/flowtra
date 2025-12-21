/**
 * Dialogue Duration Estimator
 * Estimates TTS (Text-to-Speech) duration for dialogue to ensure it fits within video segment duration.
 *
 * This module solves the choppy video transition problem by ensuring dialogue length
 * matches the allocated segment duration (typically 8 seconds).
 */

export interface LanguageSpeedConfig {
  wordsPerMinute?: number; // For word-based languages (English, Spanish, etc.)
  charactersPerMinute?: number; // For character-based languages (Chinese, Japanese, etc.)
  pauseMultiplier: number; // Multiplier for natural pauses (1.0 = no pause, 1.2 = 20% pause time)
}

/**
 * Language-specific speech rate configurations
 * Based on linguistic research and TTS benchmarks
 */
export const LANGUAGE_SPEECH_RATES: Record<string, LanguageSpeedConfig> = {
  'en': { wordsPerMinute: 150, pauseMultiplier: 1.15 }, // English: ~150 words/min with 15% pause
  'es': { wordsPerMinute: 160, pauseMultiplier: 1.12 }, // Spanish: slightly faster
  'fr': { wordsPerMinute: 145, pauseMultiplier: 1.18 }, // French: with liaison pauses
  'de': { wordsPerMinute: 140, pauseMultiplier: 1.20 }, // German: compound words slow down
  'it': { wordsPerMinute: 155, pauseMultiplier: 1.15 }, // Italian: moderate pace
  'pt': { wordsPerMinute: 150, pauseMultiplier: 1.15 }, // Portuguese: similar to English
  'zh': { charactersPerMinute: 280, pauseMultiplier: 1.10 }, // Chinese: ~280 chars/min
  'ja': { charactersPerMinute: 300, pauseMultiplier: 1.12 }, // Japanese: ~300 chars/min
  'ko': { charactersPerMinute: 320, pauseMultiplier: 1.10 }, // Korean: slightly faster
  'ar': { wordsPerMinute: 130, pauseMultiplier: 1.25 }, // Arabic: slower with pauses
  'hi': { wordsPerMinute: 140, pauseMultiplier: 1.20 }, // Hindi: moderate pace
  'default': { wordsPerMinute: 150, pauseMultiplier: 1.15 } // Fallback to English
};

/**
 * Estimates the duration (in seconds) required to speak a given dialogue
 * @param dialogue - The text to be spoken
 * @param languageCode - ISO language code (e.g., 'en', 'zh', 'es')
 * @returns Estimated duration in seconds
 */
export function estimateDialogueDuration(dialogue: string, languageCode: string = 'en'): number {
  if (!dialogue || dialogue.trim() === '') {
    return 0;
  }

  const config = LANGUAGE_SPEECH_RATES[languageCode] || LANGUAGE_SPEECH_RATES['default'];
  const trimmedDialogue = dialogue.trim();

  let baseDuration: number;

  if (config.wordsPerMinute) {
    // Word-based calculation (English, Spanish, etc.)
    const wordCount = trimmedDialogue.split(/\s+/).length;
    baseDuration = (wordCount / config.wordsPerMinute) * 60;
  } else if (config.charactersPerMinute) {
    // Character-based calculation (Chinese, Japanese, Korean)
    const charCount = trimmedDialogue.replace(/\s/g, '').length; // Remove spaces
    baseDuration = (charCount / config.charactersPerMinute) * 60;
  } else {
    // Fallback: use word-based with default rate
    const wordCount = trimmedDialogue.split(/\s+/).length;
    baseDuration = (wordCount / 150) * 60;
  }

  // Apply pause multiplier for natural speech rhythm
  const estimatedDuration = baseDuration * config.pauseMultiplier;

  return Math.round(estimatedDuration * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculates the maximum recommended word count for a given duration
 * @param durationSeconds - Target duration in seconds
 * @param languageCode - ISO language code
 * @returns Recommended maximum word/character count
 */
export function getMaxDialogueLength(durationSeconds: number, languageCode: string = 'en'): {
  maxWords?: number;
  maxCharacters?: number;
} {
  const config = LANGUAGE_SPEECH_RATES[languageCode] || LANGUAGE_SPEECH_RATES['default'];

  if (config.wordsPerMinute) {
    const maxWords = Math.floor((durationSeconds / 60) * config.wordsPerMinute / config.pauseMultiplier);
    return { maxWords };
  } else if (config.charactersPerMinute) {
    const maxCharacters = Math.floor((durationSeconds / 60) * config.charactersPerMinute / config.pauseMultiplier);
    return { maxCharacters };
  }

  return { maxWords: Math.floor((durationSeconds / 60) * 150 / 1.15) };
}

/**
 * Validates if a dialogue fits within the target duration
 * @param dialogue - The dialogue text
 * @param targetDurationSeconds - Target duration (e.g., 8 seconds)
 * @param languageCode - ISO language code
 * @param tolerance - Acceptable variance (default: 0.5 seconds)
 * @returns Validation result with estimated duration and fit status
 */
export function validateDialogueDuration(
  dialogue: string,
  targetDurationSeconds: number,
  languageCode: string = 'en',
  tolerance: number = 0.5
): {
  isValid: boolean;
  estimatedDuration: number;
  targetDuration: number;
  difference: number;
  recommendation: string;
} {
  const estimatedDuration = estimateDialogueDuration(dialogue, languageCode);
  const difference = estimatedDuration - targetDurationSeconds;
  const isValid = Math.abs(difference) <= tolerance;

  let recommendation = '';
  if (difference > tolerance) {
    const excessSeconds = Math.abs(difference);
    recommendation = `Dialogue is ${excessSeconds.toFixed(1)}s too long. Consider shortening by ~${Math.ceil(excessSeconds / 2)} words.`;
  } else if (difference < -tolerance) {
    const shortageSeconds = Math.abs(difference);
    recommendation = `Dialogue is ${shortageSeconds.toFixed(1)}s too short. Consider adding ~${Math.ceil(shortageSeconds / 2)} words.`;
  } else {
    recommendation = 'Dialogue duration is optimal.';
  }

  return {
    isValid,
    estimatedDuration,
    targetDuration: targetDurationSeconds,
    difference: Math.round(difference * 10) / 10,
    recommendation
  };
}

/**
 * Generates AI prompt guidance for optimal dialogue length
 * @param segmentCount - Number of video segments
 * @param segmentDuration - Duration per segment (default: 8 seconds)
 * @param languageCode - ISO language code
 * @returns Prompt text with specific word/character count guidance
 */
export function generateDialogueLengthGuidance(
  segmentCount: number,
  segmentDuration: number = 8,
  languageCode: string = 'en'
): string {
  const maxLength = getMaxDialogueLength(segmentDuration, languageCode);
  const config = LANGUAGE_SPEECH_RATES[languageCode] || LANGUAGE_SPEECH_RATES['default'];

  if (maxLength.maxWords) {
    return `CRITICAL DIALOGUE LENGTH CONSTRAINT:
- Each scene is EXACTLY ${segmentDuration} seconds long
- Natural speaking rate: ~${config.wordsPerMinute} words per minute
- Maximum dialogue per scene: ${maxLength.maxWords} words
- Recommended range: ${Math.floor(maxLength.maxWords! * 0.75)}-${maxLength.maxWords} words
- Total scenes: ${segmentCount}

IMPORTANT: Dialogue MUST fit naturally within ${segmentDuration} seconds. Do NOT exceed ${maxLength.maxWords} words per scene.
If user provides a script longer than ${maxLength.maxWords! * segmentCount} words total, you MUST condense or split intelligently.`;
  } else if (maxLength.maxCharacters) {
    return `CRITICAL DIALOGUE LENGTH CONSTRAINT:
- Each scene is EXACTLY ${segmentDuration} seconds long
- Natural speaking rate: ~${config.charactersPerMinute} characters per minute
- Maximum dialogue per scene: ${maxLength.maxCharacters} characters (excluding spaces)
- Recommended range: ${Math.floor(maxLength.maxCharacters! * 0.75)}-${maxLength.maxCharacters} characters
- Total scenes: ${segmentCount}

IMPORTANT: Dialogue MUST fit naturally within ${segmentDuration} seconds. Do NOT exceed ${maxLength.maxCharacters} characters per scene.
If user provides a script longer than ${maxLength.maxCharacters! * segmentCount} characters total, you MUST condense or split intelligently.`;
  }

  return '';
}

/**
 * Validates an entire scene array for dialogue duration
 * @param scenes - Array of scene objects with dialogue
 * @param segmentDuration - Duration per segment (default: 8 seconds)
 * @param languageCode - ISO language code
 * @returns Validation report for all scenes
 */
export function validateSceneDurations(
  scenes: Array<{ scene: number; prompt: { dialog?: string } }>,
  segmentDuration: number = 8,
  languageCode: string = 'en'
): {
  allValid: boolean;
  sceneValidations: Array<{
    sceneNumber: number;
    dialogue: string;
    validation: ReturnType<typeof validateDialogueDuration>;
  }>;
  overallRecommendation: string;
} {
  const sceneValidations = scenes.map(scene => {
    const dialogue = scene.prompt.dialog || '';
    return {
      sceneNumber: scene.scene,
      dialogue,
      validation: validateDialogueDuration(dialogue, segmentDuration, languageCode)
    };
  });

  const allValid = sceneValidations.every(sv => sv.validation.isValid);
  const invalidScenes = sceneValidations.filter(sv => !sv.validation.isValid);

  let overallRecommendation = '';
  if (allValid) {
    overallRecommendation = '✅ All scenes have optimal dialogue duration.';
  } else {
    overallRecommendation = `⚠️ ${invalidScenes.length} scene(s) have dialogue duration issues:\n` +
      invalidScenes.map(sv =>
        `  - Scene ${sv.sceneNumber}: ${sv.validation.recommendation}`
      ).join('\n');
  }

  return {
    allValid,
    sceneValidations,
    overallRecommendation
  };
}
