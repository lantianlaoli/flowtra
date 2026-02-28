import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KLING_PROMPT_MAX_CHARS,
  KlingPromptValidationError,
  buildKlingPromptSections,
  estimateKlingPromptUsage,
  fitKlingPromptWithinLimit
} from '@/lib/kling-prompt-budget';
import { getKlingPromptValidationResponse } from '@/lib/kling-prompt-api-error';

test('single-shot Kling prompt under limit remains unchanged', () => {
  const sections = buildKlingPromptSections({
    shot: {
      subject: 'Creator holding the serum bottle',
      action: 'Turns the bottle toward camera with a quick smile',
      dialogue: 'This is the glow boost I use every morning.'
    }
  });

  const result = fitKlingPromptWithinLimit({ sections });

  assert.equal(result.wasCompressed, false);
  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.equal(result.finalPrompt, result.originalPrompt);
});

test('long single-shot prompt compresses below Kling limit', () => {
  const sections = buildKlingPromptSections({
    shot: {
      subject: 'Confident creator with the product held close to the lens while describing every visible packaging detail and texture in a very verbose way',
      action: 'Explains the transformation, rotates the product, points at the label, demonstrates texture on skin, and repeats the core benefits with extra descriptive phrasing to intentionally overflow the limit',
      dialogue: 'You can see how the finish stays glossy, smooth, hydrated, fresh, reflective, premium, and camera-ready from every single angle without looking sticky or heavy on the skin at all.',
      context_environment: 'Luxury bathroom with layered marble, chrome shelving, oversized mirror reflections, candles, towels, and styled decor accents filling the full frame.',
      composition: 'Tight close-up with dramatic lens compression, product foreground emphasis, and shallow depth of field.',
      camera_motion_positioning: 'Fast push-in followed by a gentle orbit and final tilt down to the product cap.',
      style: 'High-end skincare ad with glossy highlights and polished social-first pacing.',
      ambiance_colour_lighting: 'Warm golden key light mixed with bright window bounce and reflective sparkle flares.',
      audio: 'Soft beauty-pop soundtrack with airy whooshes and subtle sink ambience.'
    }
  });

  const result = fitKlingPromptWithinLimit({ sections });

  assert.ok(result.wasCompressed);
  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.match(result.finalPrompt, /Explains the transformation/);
  assert.match(result.finalPrompt, /Confident creator/);
  assert.ok(result.originalLength > result.finalLength);
});

test('first shot keeps action subject and dialogue before trimming lower-priority fields', () => {
  const sections = buildKlingPromptSections({
    shot: {
      subject: 'Creator and product locked in a central close-up',
      action: 'Snaps open the compact and reveals the texture immediately',
      dialogue: 'Watch the payoff hit in one swipe.',
      context_environment: 'Dense descriptive background with many layered props and unnecessary detail repeated several times for overflow.',
      style: 'Verbose polished ad styling with repeated luxury descriptors and extra filler text that should be removed first.',
      ambiance_colour_lighting: 'Extremely detailed warm lighting paragraph that can be sacrificed before core beats.',
      audio: 'Long audio description that is the least important field.'
    }
  });

  const result = fitKlingPromptWithinLimit({ sections });

  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.match(result.finalPrompt, /Snaps open the compact/);
  assert.match(result.finalPrompt, /Creator and product locked/);
  assert.match(result.finalPrompt, /Watch the payoff hit in one swipe/);
});

test('merged overflow action still produces a valid capped prompt', () => {
  const sections = buildKlingPromptSections({
    shot: {
      action: [
        'Creator picks up the bottle from the sink.',
        'Creator rotates it toward the lens.',
        'Creator applies a drop to the cheek.',
        'Creator points at the texture change.',
        'Creator smiles and places the bottle beside the mirror.'
      ].join(' Then '),
      subject: 'Creator and skincare bottle',
      dialogue: 'Five quick beats, one clean result.'
    }
  });

  const result = fitKlingPromptWithinLimit({ sections });

  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.match(result.finalPrompt, /Creator picks up the bottle/);
});

test('mention tags survive compression and remain appended', () => {
  const sections = buildKlingPromptSections({
    shot: {
      subject: '@character(Anna) holding @product(Glow Serum)',
      action: '@character(Anna) demonstrates @product(Glow Serum) in a long descriptive walkthrough that forces compression.',
      dialogue: '@product(Glow Serum) gives me that glass-skin finish in seconds.'
    }
  });

  const tokenMap: Record<string, string> = {
    'character:anna': 'element_anna_a',
    'product:glow serum': 'element_glow_serum_b'
  };
  const replaceMention = (text: string) => text.replace(/@(?<type>character|product)\((?<name>[^)]*)\)/g, (_match, type: string, name: string) => {
    const key = `${type}:${String(name || '').trim().toLowerCase()}`;
    return tokenMap[key] ? `@${tokenMap[key]}` : name;
  });
  const tags = ['@element_anna_a', '@element_glow_serum_b'];

  const result = fitKlingPromptWithinLimit({ sections, tags, replaceMention });

  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.match(result.finalPrompt, /@element_anna_a/);
  assert.match(result.finalPrompt, /@element_glow_serum_b/);
});

test('tag-heavy prompt still returns a valid capped string', () => {
  const sections = buildKlingPromptSections({
    shot: {
      action: 'Quick reveal.',
      subject: 'Product demo.'
    }
  });

  const tags = Array.from({ length: 18 }, (_value, index) => `@element_tag_${index.toString(36).padStart(2, '0')}`);
  const result = fitKlingPromptWithinLimit({ sections, tags });

  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
  assert.match(result.finalPrompt, /@element_tag_00/);
});

test('throws typed validation error when tags alone exceed Kling limit', () => {
  const sections = buildKlingPromptSections({
    shot: {
      action: 'Short action.'
    }
  });

  const tags = Array.from({ length: 80 }, (_value, index) => `@element_extremely_long_tag_name_${index.toString().padStart(2, '0')}`);

  assert.throws(
    () => fitKlingPromptWithinLimit({ sections, tags }),
    KlingPromptValidationError
  );
});

test('truncation never leaves a partial @product token behind', () => {
  const sections = buildKlingPromptSections({
    shot: {
      action: '@product(massager-2) on lower leg with an intentionally long trailing explanation that forces compression before the field can finish naturally and would previously leave a broken mention token behind if cut mid-way.',
      subject: 'Close-up product demo'
    }
  });

  const tokenMap: Record<string, string> = {
    'product:massager-2': 'element_massager_2'
  };
  const replaceMention = (text: string) => text.replace(/@(?<type>character|product)\((?<name>[^)]*)\)/g, (_match, type: string, name: string) => {
    const key = `${type}:${String(name || '').trim().toLowerCase()}`;
    return tokenMap[key] ? `@${tokenMap[key]}` : name;
  });

  const result = fitKlingPromptWithinLimit({
    sections,
    tags: ['@element_massager_2'],
    replaceMention,
    maxChars: 90,
    softTarget: 80
  });

  assert.doesNotMatch(result.finalPrompt, /@product\(/);
  assert.match(result.finalPrompt, /@element_massager_2/);
});

test('client-side Kling usage estimator stays within the same ceiling', () => {
  const result = estimateKlingPromptUsage({
    shot: {
      subject: '@character(Anna) with @product(Glow Serum)',
      action: 'Walks through the use case in a deliberately long way so the estimator exercises compression behavior for the UI warning state.',
      dialogue: 'This serum keeps the finish bright, glossy, hydrated, and smooth through a full day on camera.'
    }
  });

  assert.ok(result.finalLength <= KLING_PROMPT_MAX_CHARS);
});

test('route helper maps Kling prompt validation errors to 422 responses', () => {
  const response = getKlingPromptValidationResponse(
    new KlingPromptValidationError('Kling 3.0 prompt exceeds the provider limit after compression.')
  );

  assert.deepEqual(response, {
    error: 'Kling 3.0 prompt exceeds the provider limit after compression.',
    status: 422
  });
});
