import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyUrl,
  extractRouteFromPagePath,
  isRobotsBlocked,
  parseRobotsRules,
} from '../../scripts/audit-google-seo-urls';

test('route extraction converts app route groups to public paths', () => {
  assert.equal(extractRouteFromPagePath('app/(app-shell)/dashboard/page.tsx'), '/dashboard');
});

test('route extraction ignores api route files', () => {
  assert.equal(extractRouteFromPagePath('app/api/articles/route.ts'), null);
});

test('robots parser blocks dashboard child pages', () => {
  const rules = parseRobotsRules(`
User-agent: *
Allow: /
Disallow: /dashboard/
`);

  assert.equal(isRobotsBlocked('/dashboard/my-ads', rules), true);
});

test('classifier marks indexed dashboard 404 pages as blocked dashboard indexed', () => {
  const result = classifyUrl({
    url: 'https://flowtra.ai/dashboard/video-clone',
    baseUrl: 'https://flowtra.ai',
    appearsInGoogle: true,
    googleImpressions: 12,
    googleClicks: 1,
    isInSitemap: false,
    isProjectRoute: false,
    liveStatus: 404,
    redirectTarget: null,
    robotsBlocked: true,
    inspection: null,
  });

  assert.equal(result.primaryClassification, 'blocked_dashboard_indexed');
  assert.ok(result.classifications.includes('google_only_removed'));
  assert.ok(result.classifications.includes('robots_conflict'));
});

test('classifier marks live public routes missing from sitemap', () => {
  const result = classifyUrl({
    url: 'https://flowtra.ai/features/ai-agent',
    baseUrl: 'https://flowtra.ai',
    appearsInGoogle: false,
    googleImpressions: 0,
    googleClicks: 0,
    isInSitemap: false,
    isProjectRoute: true,
    liveStatus: 200,
    redirectTarget: null,
    robotsBlocked: false,
    inspection: null,
  });

  assert.equal(result.primaryClassification, 'valid_missing_from_sitemap');
});
