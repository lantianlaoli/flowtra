/**
 * Test script for dialogue duration estimator
 * Usage: npx ts-node scripts/test-dialogue-duration.ts
 */

import {
  estimateDialogueDuration,
  getMaxDialogueLength,
  validateDialogueDuration,
  generateDialogueLengthGuidance,
  validateSceneDurations
} from '../lib/dialogue-duration-estimator';

console.log('🎯 Testing Dialogue Duration Estimator\n');

// Test 1: Basic duration estimation (English)
console.log('=== Test 1: English Dialogue Duration ===');
const englishDialogues = [
  'This product changed my life.',
  'I absolutely love this skincare routine - it made my skin glow in just two weeks!',
  'If you are looking for a high-quality, affordable, and durable backpack for your daily commute or weekend adventures, this is the perfect choice for you and I highly recommend it to everyone.',
];

englishDialogues.forEach((dialogue, idx) => {
  const duration = estimateDialogueDuration(dialogue, 'en');
  const validation = validateDialogueDuration(dialogue, 8, 'en');
  console.log(`\nDialogue ${idx + 1}: "${dialogue}"`);
  console.log(`  Words: ${dialogue.split(/\s+/).length}`);
  console.log(`  Estimated duration: ${duration}s`);
  console.log(`  Fits in 8s? ${validation.isValid ? '✅' : '❌'}`);
  console.log(`  ${validation.recommendation}`);
});

// Test 2: Chinese dialogue duration
console.log('\n\n=== Test 2: Chinese Dialogue Duration ===');
const chineseDialogues = [
  '这个产品改变了我的生活',
  '我真的非常喜欢这个护肤套装，两周内我的皮肤就变得光彩照人了！',
  '如果你正在寻找一款高品质、价格实惠且耐用的背包，无论是日常通勤还是周末探险，这款背包都是你的完美选择，我强烈推荐给每个人',
];

chineseDialogues.forEach((dialogue, idx) => {
  const duration = estimateDialogueDuration(dialogue, 'zh');
  const validation = validateDialogueDuration(dialogue, 8, 'zh');
  console.log(`\nDialogue ${idx + 1}: "${dialogue}"`);
  console.log(`  Characters: ${dialogue.replace(/\s/g, '').length}`);
  console.log(`  Estimated duration: ${duration}s`);
  console.log(`  Fits in 8s? ${validation.isValid ? '✅' : '❌'}`);
  console.log(`  ${validation.recommendation}`);
});

// Test 3: Max dialogue length calculation
console.log('\n\n=== Test 3: Max Dialogue Length for 8s ===');
const languages = ['en', 'es', 'zh', 'ja', 'de'];
languages.forEach(lang => {
  const maxLength = getMaxDialogueLength(8, lang);
  console.log(`${lang.toUpperCase()}: ${JSON.stringify(maxLength)}`);
});

// Test 4: AI Prompt Guidance Generation
console.log('\n\n=== Test 4: AI Prompt Guidance ===');
const guidance = generateDialogueLengthGuidance(3, 8, 'en');
console.log(guidance);

// Test 5: Scene validation (simulated)
console.log('\n\n=== Test 5: Scene Validation ===');
const mockScenes = [
  {
    scene: 1,
    prompt: {
      dialog: 'Hey everyone, I just discovered this amazing coffee maker!'
    }
  },
  {
    scene: 2,
    prompt: {
      dialog: 'It brews the perfect cup every single time and has completely transformed my morning routine - I wake up excited just to use it!'
    }
  },
  {
    scene: 3,
    prompt: {
      dialog: 'Grab yours today!'
    }
  }
];

const sceneValidation = validateSceneDurations(mockScenes, 8, 'en');
console.log('\nScene Validation Results:');
console.log(`All valid: ${sceneValidation.allValid ? '✅' : '❌'}`);
console.log(`\n${sceneValidation.overallRecommendation}`);

sceneValidation.sceneValidations.forEach(sv => {
  console.log(`\nScene ${sv.sceneNumber}:`);
  console.log(`  Dialogue: "${sv.dialogue}"`);
  console.log(`  Estimated: ${sv.validation.estimatedDuration}s`);
  console.log(`  Status: ${sv.validation.isValid ? '✅ Optimal' : '⚠️ Needs adjustment'}`);
  if (!sv.validation.isValid) {
    console.log(`  Issue: ${sv.validation.recommendation}`);
  }
});

console.log('\n\n✅ All tests completed!');
