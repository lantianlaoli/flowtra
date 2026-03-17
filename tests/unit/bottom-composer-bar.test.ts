import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBottomComposerButtonLabel } from '@/components/ui/BottomComposerBar';

test('bottom composer keeps Start label while idle', () => {
  assert.equal(resolveBottomComposerButtonLabel({
    showInsufficientCredits: false,
    isGenerating: false,
    generateButtonText: 'Start',
  }), 'Start');
});

test('bottom composer shows Processing while busy for Start flows', () => {
  assert.equal(resolveBottomComposerButtonLabel({
    showInsufficientCredits: false,
    isGenerating: true,
    generateButtonText: 'Start',
  }), 'Processing...');
});

test('bottom composer keeps Generate label while idle', () => {
  assert.equal(resolveBottomComposerButtonLabel({
    showInsufficientCredits: false,
    isGenerating: false,
    generateButtonText: 'Generate',
  }), 'Generate');
});

test('bottom composer shows Generating while busy for Generate flows', () => {
  assert.equal(resolveBottomComposerButtonLabel({
    showInsufficientCredits: false,
    isGenerating: true,
    generateButtonText: 'Generate',
  }), 'Generating...');
});

test('bottom composer prioritizes insufficient credits label', () => {
  assert.equal(resolveBottomComposerButtonLabel({
    showInsufficientCredits: true,
    isGenerating: true,
    generateButtonText: 'Start',
  }), 'Insufficient');
});
