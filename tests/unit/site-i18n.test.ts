import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { landingMessages } from '@/lib/i18n/landing-messages';
import { siteMessages } from '@/lib/i18n/site-messages';
import {
  inferSiteLocaleFromCountry,
  getDocumentLang,
  normalizeSiteLocale,
  formatLocaleNumber,
  resolveInitialSiteLocale,
  SITE_LOCALE_OPTIONS,
} from '@/lib/i18n/site';

test('normalizeSiteLocale falls back to english for unknown values', () => {
  assert.equal(normalizeSiteLocale('en'), 'en');
  assert.equal(normalizeSiteLocale('zh'), 'zh');
  assert.equal(normalizeSiteLocale('fr'), 'en');
  assert.equal(normalizeSiteLocale(null), 'en');
});

test('document lang mapping matches supported site locales', () => {
  assert.equal(getDocumentLang('en'), 'en');
  assert.equal(getDocumentLang('zh'), 'zh-CN');
});

test('geo locale inference defaults chinese only for supported zh regions', () => {
  assert.equal(inferSiteLocaleFromCountry('CN'), 'zh');
  assert.equal(inferSiteLocaleFromCountry('SG'), 'zh');
  assert.equal(inferSiteLocaleFromCountry('US'), 'en');
  assert.equal(inferSiteLocaleFromCountry(undefined), 'en');
});

test('initial locale resolution prefers cookie over geo fallback', () => {
  assert.equal(resolveInitialSiteLocale({ cookieLocale: 'zh', countryCode: 'US' }), 'zh');
  assert.equal(resolveInitialSiteLocale({ cookieLocale: 'en', countryCode: 'CN' }), 'en');
  assert.equal(resolveInitialSiteLocale({ cookieLocale: undefined, countryCode: 'CN' }), 'zh');
  assert.equal(resolveInitialSiteLocale({ cookieLocale: null, countryCode: 'US' }), 'en');
});

test('landing dictionaries expose translated header and pricing copy', () => {
  assert.equal(landingMessages.en.header.pricing, 'Pricing');
  assert.equal(landingMessages.zh.header.pricing, '价格');
  assert.equal(landingMessages.en.pricing.recommended, 'Recommended');
  assert.equal(landingMessages.zh.pricing.recommended, '推荐');
});

test('locale number formatting follows english and chinese grouping', () => {
  assert.equal(formatLocaleNumber('en', 12345), '12,345');
  assert.equal(formatLocaleNumber('zh', 12345), '12,345');
});

test('representative landing copy renders in both locales', () => {
  const enHtml = renderToStaticMarkup(React.createElement('h1', null, landingMessages.en.hero.title));
  const zhHtml = renderToStaticMarkup(React.createElement('h1', null, landingMessages.zh.hero.title));

  assert.match(enHtml, /Turn Viral Videos Into Your Own/);
  assert.match(zhHtml, /把爆款视频变成你的专属素材/);
});

test('site locale options and dashboard/tool dictionaries stay aligned', () => {
  assert.deepEqual(
    SITE_LOCALE_OPTIONS.map((option) => option.value),
    ['en', 'zh'],
  );
  assert.equal(siteMessages.en.dashboard.sidebar.assets, 'Assets');
  assert.equal(siteMessages.zh.dashboard.sidebar.assets, '素材库');
  assert.equal(siteMessages.en.tools.index.title, 'Marketing Utilities');
  assert.equal(siteMessages.zh.tools.index.title, '营销工具箱');
});
