import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { clampDialogueToWordLimit, getCharacterAdsDialogueWordLimit } from '@/lib/character-ads-dialogue';

const accentLabelMap: Record<string, string> = {
  american: 'American',
  canadian: 'Canadian',
  british: 'British',
  irish: 'Irish',
  scottish: 'Scottish',
  australian: 'Australian',
  new_zealand: 'New Zealand',
  indian: 'Indian',
  singaporean: 'Singaporean',
  filipino: 'Filipino',
  south_african: 'South African',
  nigerian: 'Nigerian',
  kenyan: 'Kenyan',
  latin_american: 'Latin American'
};

interface DialogueRequestPayload {
  accent: string;
  productName?: string;
  productDescription?: string;
  productImageUrls?: string[];
  language?: LanguageCode;
  videoDurationSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as DialogueRequestPayload;
    const {
      accent,
      productName,
      productDescription,
      productImageUrls = [],
      language = 'en',
      videoDurationSeconds
    } = body;

    if (!accent) {
      return NextResponse.json(
        { error: 'Accent is required.' },
        { status: 400 }
      );
    }

    const cleanedImageUrls = productImageUrls
      .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);

    const accentLabel = accentLabelMap[accent] || 'American';
    const nameSnippet = productName?.trim() || 'the product';
    const descriptionSnippet = productDescription?.trim() || 'A modern product that customers love.';
    const languageName = getLanguagePromptName(language);

    const dialogueWordLimit = getCharacterAdsDialogueWordLimit(
      typeof videoDurationSeconds === 'number' ? videoDurationSeconds : 16
    );

    const systemPrompt = `You are an advertising dialogue writer for user-generated content spokesperson videos.\n
Requirements:\n- Return exactly one spoken line capped at ${dialogueWordLimit} words in ${languageName}.\n- Sound casual, enthusiastic, and authentic as if spoken on camera.\n- Blend a hook, the key benefit, and a friendly call-to-action.\n- Avoid hashtags, emojis, marketing buzzwords, or repeated punctuation.\n- Do not add quotes or surrounding characters.\n- Reflect the requested accent naturally in word choice or cadence.\n- Base the line on the product imagery and description provided.\n- The dialogue MUST be written in ${languageName}.`;

    const userTextPrompt = `Product Name: ${nameSnippet}\nProduct Description: ${descriptionSnippet}\nAccent: ${accentLabel}\nLanguage: ${languageName}\nIf possible, reference standout visuals you observe. Respond with one spoken line in ${languageName} now.`;

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      { type: 'text', text: userTextPrompt }
    ];

    if (cleanedImageUrls.length) {
      userContent.push({ type: 'text', text: 'Reference product photos:' });
      cleanedImageUrls.forEach((url) => {
        userContent.push({ type: 'image_url', image_url: { url } });
      });
    }

    const response = await fetchWithRetry(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Flowtra'
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
            { role: 'user', content: userContent }
          ],
          max_tokens: 140,
          temperature: 0.65,
        })
      },
      3,
      45000
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload?.error || response.statusText || 'Failed to generate dialogue.';
      return NextResponse.json(
        { error: message },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();
    const rawContent: string | undefined = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: 'No dialogue returned from OpenRouter.' },
        { status: 502 }
      );
    }

    const cleanedContent = rawContent
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const trimmedContent = clampDialogueToWordLimit(cleanedContent, dialogueWordLimit);

    return NextResponse.json({ success: true, dialogue: trimmedContent });
  } catch (error) {
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error || 'Failed to generate dialogue.', details: networkError.details },
      { status: networkError.status || 500 }
    );
  }
}
