#!/usr/bin/env tsx

import 'dotenv/config';

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export type UrlClassification =
  | 'google_only_removed'
  | 'google_only_redirected'
  | 'blocked_dashboard_indexed'
  | 'blog_removed_or_missing'
  | 'valid_missing_from_sitemap'
  | 'sitemap_dead'
  | 'canonical_mismatch'
  | 'robots_conflict'
  | 'ok';

export type RobotsRule = {
  type: 'allow' | 'disallow';
  path: string;
};

export type GoogleRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type LiveCheck = {
  status: number | null;
  redirectTarget: string | null;
  error: string | null;
};

export type InspectionSummary = {
  indexingState: string | null;
  lastCrawled: string | null;
  robotsTxtState: string | null;
  sitemapState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  pageFetchState: string | null;
  verdict: string | null;
  error: string | null;
};

export type ClassificationInput = {
  url: string;
  baseUrl: string;
  appearsInGoogle: boolean;
  googleClicks: number;
  googleImpressions: number;
  isInSitemap: boolean;
  isProjectRoute: boolean;
  liveStatus: number | null;
  redirectTarget: string | null;
  robotsBlocked: boolean;
  inspection: InspectionSummary | null;
};

export type ClassifiedUrl = ClassificationInput & {
  path: string;
  classifications: UrlClassification[];
  primaryClassification: UrlClassification;
  recommendedAction: string;
};

const DEFAULT_BASE_URL = 'https://www.flowtra.store';
const DEFAULT_SITE_URL = 'https://www.flowtra.store/';
const DEFAULT_REPORT_DIR = 'reports/seo-url-audit';

const IMPORTANT_KNOWN_URLS = [
  '/dashboard',
  '/dashboard/assets',
  '/dashboard/video-clone',
  '/dashboard/my-ads',
  '/academy',
  '/support',
  '/features/ai-agent',
];

function stripTrailingSlash(value: string) {
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function normalizeBaseUrl(value: string) {
  return stripTrailingSlash(value.trim());
}

function normalizeUrl(value: string, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL(value, baseUrl);
  url.hash = '';
  url.search = '';
  const normalized = `${url.origin}${url.pathname === '/' ? '' : stripTrailingSlash(url.pathname)}`;
  return normalized;
}

function pathFromUrl(value: string, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL(value, baseUrl);
  return url.pathname === '/' ? '/' : stripTrailingSlash(url.pathname);
}

function routeSegmentToPathPart(segment: string) {
  if (segment.startsWith('(') && segment.endsWith(')')) {
    return null;
  }
  if (segment === 'page.tsx' || segment === 'page.ts' || segment === 'page.jsx' || segment === 'page.js') {
    return null;
  }
  if (segment.startsWith('[')) {
    return null;
  }
  return segment;
}

export function extractRouteFromPagePath(pagePath: string) {
  const normalizedPath = pagePath.replaceAll('\\', '/');
  if (normalizedPath.includes('/api/') || normalizedPath.startsWith('app/api/')) {
    return null;
  }
  if (!/\/?page\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
    return null;
  }

  const appIndex = normalizedPath.split('/').indexOf('app');
  const parts = normalizedPath.split('/').slice(appIndex >= 0 ? appIndex + 1 : 0);
  const routeParts = parts
    .map(routeSegmentToPathPart)
    .filter((part): part is string => Boolean(part));

  return routeParts.length === 0 ? '/' : `/${routeParts.join('/')}`;
}

function collectPageFiles(root: string, files: string[] = []) {
  if (!existsSync(root)) {
    return files;
  }

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectPageFiles(fullPath, files);
    } else if (/page\.(tsx|ts|jsx|js)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectProjectRoutes(cwd: string, baseUrl: string) {
  const appRoot = join(cwd, 'app');
  const routes = new Set<string>();
  for (const file of collectPageFiles(appRoot)) {
    const route = extractRouteFromPagePath(relative(cwd, file));
    if (route) {
      routes.add(normalizeUrl(route, baseUrl));
    }
  }
  for (const path of IMPORTANT_KNOWN_URLS) {
    routes.add(normalizeUrl(path, baseUrl));
  }
  return routes;
}

export function parseRobotsRules(content: string) {
  const rules: RobotsRule[] = [];
  let appliesToAll = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'user-agent') {
      appliesToAll = value === '*';
      continue;
    }

    if (!appliesToAll) {
      continue;
    }

    if (key === 'allow' || key === 'disallow') {
      rules.push({ type: key, path: value });
    }
  }

  return rules;
}

function robotsPathMatches(pathname: string, rulePath: string) {
  if (!rulePath) {
    return false;
  }
  const cleanRule = rulePath.split('*')[0];
  return pathname.startsWith(cleanRule);
}

export function isRobotsBlocked(pathname: string, rules: RobotsRule[]) {
  const matches = rules
    .filter((rule) => robotsPathMatches(pathname, rule.path))
    .sort((a, b) => b.path.length - a.path.length);

  return matches[0]?.type === 'disallow';
}

function expectedCanonical(url: string, baseUrl: string) {
  return normalizeUrl(url, baseUrl);
}

export function classifyUrl(input: ClassificationInput): ClassifiedUrl {
  const path = pathFromUrl(input.url, input.baseUrl);
  const classifications: UrlClassification[] = [];

  if (input.appearsInGoogle && (input.liveStatus === 404 || input.liveStatus === 410)) {
    classifications.push('google_only_removed');
  }

  if (input.appearsInGoogle && input.redirectTarget) {
    classifications.push('google_only_redirected');
  }

  if (input.appearsInGoogle && path.startsWith('/dashboard')) {
    classifications.push('blocked_dashboard_indexed');
  }

  if (path.startsWith('/blog/') && (!input.isInSitemap || input.liveStatus !== 200)) {
    classifications.push('blog_removed_or_missing');
  }

  if (!input.isInSitemap && input.isProjectRoute && input.liveStatus === 200 && !input.robotsBlocked) {
    classifications.push('valid_missing_from_sitemap');
  }

  if (input.isInSitemap && input.liveStatus !== 200) {
    classifications.push('sitemap_dead');
  }

  const expected = expectedCanonical(input.url, input.baseUrl);
  const googleCanonical = input.inspection?.googleCanonical ? normalizeUrl(input.inspection.googleCanonical, input.baseUrl) : null;
  const userCanonical = input.inspection?.userCanonical ? normalizeUrl(input.inspection.userCanonical, input.baseUrl) : null;
  if ((googleCanonical && googleCanonical !== expected) || (userCanonical && userCanonical !== expected)) {
    classifications.push('canonical_mismatch');
  }

  if ((input.isProjectRoute && input.liveStatus === 200 && input.robotsBlocked) || (input.appearsInGoogle && input.robotsBlocked)) {
    classifications.push('robots_conflict');
  }

  const priority: UrlClassification[] = [
    'blocked_dashboard_indexed',
    'google_only_removed',
    'sitemap_dead',
    'blog_removed_or_missing',
    'google_only_redirected',
    'canonical_mismatch',
    'robots_conflict',
    'valid_missing_from_sitemap',
  ];

  const primaryClassification = priority.find((classification) => classifications.includes(classification)) ?? 'ok';

  return {
    ...input,
    path,
    classifications: classifications.length > 0 ? classifications : ['ok'],
    primaryClassification,
    recommendedAction: getRecommendedAction(primaryClassification),
  };
}

function getRecommendedAction(classification: UrlClassification) {
  switch (classification) {
    case 'blocked_dashboard_indexed':
      return 'Keep private routes out of sitemap, add permanent redirects for valuable legacy dashboard URLs if there is a public replacement, and request removal in Search Console.';
    case 'google_only_removed':
      return 'Add a relevant 301 redirect if the page has a replacement; otherwise keep 404/410 and request removal in Search Console.';
    case 'google_only_redirected':
      return 'Confirm the redirect target is intentional and update internal links/sitemaps to the destination URL.';
    case 'blog_removed_or_missing':
      return 'Restore the article, add a 301 redirect to a replacement, or request removal for deleted content.';
    case 'valid_missing_from_sitemap':
      return 'Add the public page to app/sitemap.ts if it should be indexed.';
    case 'sitemap_dead':
      return 'Remove the URL from app/sitemap.ts or restore the page.';
    case 'canonical_mismatch':
      return 'Review page metadata alternates.canonical and redirects so Google and user canonicals converge.';
    case 'robots_conflict':
      return 'Align robots.txt with indexing intent and remove stale Google URLs when the route should stay private.';
    case 'ok':
      return 'No action required.';
  }
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - Number(process.env.SEO_AUDIT_GSC_LAG_DAYS ?? 3));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Number(process.env.SEO_AUDIT_GSC_DAYS ?? 450));
  return {
    startDate: process.env.SEO_AUDIT_START_DATE ?? formatDate(start),
    endDate: process.env.SEO_AUDIT_END_DATE ?? formatDate(end),
  };
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseSitemapUrls(xml: string, baseUrl: string) {
  const urls = new Set<string>();
  const matches = xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi);
  for (const match of matches) {
    urls.add(normalizeUrl(match[1], baseUrl));
  }
  return urls;
}

async function querySearchAnalytics(input: {
  token: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowLimit: number;
}) {
  const rows: GoogleRow[] = [];
  let startRow = 0;

  while (true) {
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: ['page'],
          rowLimit: input.rowLimit,
          startRow,
          type: 'web',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Search Analytics failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
    };

    const pageRows = data.rows ?? [];
    for (const row of pageRows) {
      const url = row.keys?.[0];
      if (!url) {
        continue;
      }
      rows.push({
        url,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      });
    }

    if (pageRows.length < input.rowLimit) {
      break;
    }

    startRow += input.rowLimit;
  }

  return rows;
}

async function inspectUrl(input: { token: string; siteUrl: string; url: string }): Promise<InspectionSummary> {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: input.url,
      siteUrl: input.siteUrl,
      languageCode: 'en-US',
    }),
  });

  if (!response.ok) {
    return {
      indexingState: null,
      lastCrawled: null,
      robotsTxtState: null,
      sitemapState: null,
      googleCanonical: null,
      userCanonical: null,
      pageFetchState: null,
      verdict: null,
      error: `${response.status} ${await response.text()}`,
    };
  }

  const data = (await response.json()) as {
    inspectionResult?: {
      indexStatusResult?: Record<string, unknown>;
      indexStatusInspectionResult?: Record<string, unknown>;
    };
  };
  const status = data.inspectionResult?.indexStatusResult ?? data.inspectionResult?.indexStatusInspectionResult ?? {};

  return {
    indexingState: stringOrNull(status.indexingState),
    lastCrawled: stringOrNull(status.lastCrawlTime ?? status.lastCrawled),
    robotsTxtState: stringOrNull(status.robotsTxtState),
    sitemapState: stringOrNull(status.sitemap),
    googleCanonical: stringOrNull(status.googleCanonical),
    userCanonical: stringOrNull(status.userCanonical),
    pageFetchState: stringOrNull(status.pageFetchState ?? status.pageFetchStatus),
    verdict: stringOrNull(status.verdict),
    error: null,
  };
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

async function liveCheck(url: string): Promise<LiveCheck> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.status !== 405) {
      return {
        status: head.status,
        redirectTarget: head.headers.get('location'),
        error: null,
      };
    }

    const get = await fetch(url, { method: 'GET', redirect: 'manual' });
    return {
      status: get.status,
      redirectTarget: get.headers.get('location'),
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      redirectTarget: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function shouldInspect(input: ClassificationInput) {
  const path = pathFromUrl(input.url, input.baseUrl);
  return (
    input.appearsInGoogle &&
    (!input.isInSitemap ||
      !input.isProjectRoute ||
      path.startsWith('/dashboard') ||
      path.startsWith('/blog/') ||
      input.googleImpressions >= Number(process.env.SEO_AUDIT_HIGH_IMPRESSIONS ?? 25))
  );
}

function writeReports(input: {
  reportDir: string;
  generatedAt: string;
  dateRange: { startDate: string; endDate: string };
  siteUrl: string;
  baseUrl: string;
  urls: ClassifiedUrl[];
  sitemapUrls: string[];
  projectRoutes: string[];
  googleRows: GoogleRow[];
}) {
  mkdirSync(input.reportDir, { recursive: true });

  const jsonPath = join(input.reportDir, 'seo-url-audit.json');
  writeFileSync(jsonPath, JSON.stringify(input, null, 2));

  const csvRows = [
    [
      'url',
      'path',
      'primaryClassification',
      'classifications',
      'liveStatus',
      'redirectTarget',
      'inGoogle',
      'clicks',
      'impressions',
      'inSitemap',
      'projectRoute',
      'robotsBlocked',
      'indexingState',
      'googleCanonical',
      'userCanonical',
      'recommendedAction',
    ],
    ...input.urls.map((url) => [
      url.url,
      url.path,
      url.primaryClassification,
      url.classifications.join('|'),
      url.liveStatus ?? '',
      url.redirectTarget ?? '',
      url.appearsInGoogle,
      url.googleClicks,
      url.googleImpressions,
      url.isInSitemap,
      url.isProjectRoute,
      url.robotsBlocked,
      url.inspection?.indexingState ?? '',
      url.inspection?.googleCanonical ?? '',
      url.inspection?.userCanonical ?? '',
      url.recommendedAction,
    ]),
  ];
  writeFileSync(join(input.reportDir, 'seo-url-audit.csv'), csvRows.map((row) => row.map(escapeCsv).join(',')).join('\n'));

  const groups = new Map<UrlClassification, ClassifiedUrl[]>();
  for (const url of input.urls) {
    if (url.primaryClassification === 'ok') {
      continue;
    }
    const group = groups.get(url.primaryClassification) ?? [];
    group.push(url);
    groups.set(url.primaryClassification, group);
  }

  const lines = [
    '# Flowtra SEO URL Audit',
    '',
    `Generated: ${input.generatedAt}`,
    `Search Console range: ${input.dateRange.startDate} to ${input.dateRange.endDate}`,
    `Site property: ${input.siteUrl}`,
    '',
    '## Summary',
    '',
    `- Google rows: ${input.googleRows.length}`,
    `- Sitemap URLs: ${input.sitemapUrls.length}`,
    `- Project routes checked: ${input.projectRoutes.length}`,
    `- URL findings: ${input.urls.filter((url) => url.primaryClassification !== 'ok').length}`,
    '',
  ];

  for (const [classification, urls] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`## ${classification}`);
    lines.push('');
    for (const url of urls.slice(0, 50)) {
      lines.push(
        `- ${url.url} (${url.liveStatus ?? 'no-status'}, impressions ${url.googleImpressions}) - ${url.recommendedAction}`
      );
    }
    if (urls.length > 50) {
      lines.push(`- ... ${urls.length - 50} more in CSV/JSON`);
    }
    lines.push('');
  }

  writeFileSync(join(input.reportDir, 'seo-url-audit.md'), lines.join('\n'));
}

async function main() {
  const cwd = process.cwd();
  const baseUrl = normalizeBaseUrl(process.env.SEO_AUDIT_BASE_URL ?? DEFAULT_BASE_URL);
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? DEFAULT_SITE_URL;
  const token = process.env.GSC_ACCESS_TOKEN ?? process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ?? '';
  const reportDir = process.env.SEO_AUDIT_REPORT_DIR ?? DEFAULT_REPORT_DIR;
  const dateRange = getDateRange();

  const robotsContent = existsSync(join(cwd, 'public/robots.txt')) ? readFileSync(join(cwd, 'public/robots.txt'), 'utf8') : '';
  const robotsRules = parseRobotsRules(robotsContent);

  const sitemapXml = await fetchText(`${baseUrl}/sitemap.xml`);
  const sitemapUrls = parseSitemapUrls(sitemapXml, baseUrl);
  const projectRoutes = collectProjectRoutes(cwd, baseUrl);

  const googleRows = token
    ? await querySearchAnalytics({
        token,
        siteUrl,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        rowLimit: Number(process.env.SEO_AUDIT_GSC_ROW_LIMIT ?? 25000),
      })
    : [];

  if (!token) {
    console.warn('Missing GSC_ACCESS_TOKEN or GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN. Google data and URL Inspection were skipped.');
  }

  const googleByUrl = new Map(googleRows.map((row) => [normalizeUrl(row.url, baseUrl), row]));
  const candidateUrls = new Set<string>([...sitemapUrls, ...projectRoutes, ...googleByUrl.keys()]);

  const liveChecks = new Map<string, LiveCheck>();
  for (const url of candidateUrls) {
    liveChecks.set(url, await liveCheck(url));
  }

  const inspectionLimit = Number(process.env.SEO_AUDIT_INSPECTION_LIMIT ?? 50);
  let inspectionCount = 0;
  const inspectionByUrl = new Map<string, InspectionSummary>();

  const initialInputs = [...candidateUrls].map((url): ClassificationInput => {
    const google = googleByUrl.get(url);
    const live = liveChecks.get(url);
    return {
      url,
      baseUrl,
      appearsInGoogle: Boolean(google),
      googleClicks: google?.clicks ?? 0,
      googleImpressions: google?.impressions ?? 0,
      isInSitemap: sitemapUrls.has(url),
      isProjectRoute: projectRoutes.has(url),
      liveStatus: live?.status ?? null,
      redirectTarget: live?.redirectTarget ? normalizeUrl(live.redirectTarget, baseUrl) : null,
      robotsBlocked: isRobotsBlocked(pathFromUrl(url, baseUrl), robotsRules),
      inspection: null,
    };
  });

  const inspectionCandidates = initialInputs
    .filter(shouldInspect)
    .sort((a, b) => b.googleImpressions - a.googleImpressions)
    .slice(0, inspectionLimit);

  if (token) {
    for (const input of inspectionCandidates) {
      inspectionByUrl.set(input.url, await inspectUrl({ token, siteUrl, url: input.url }));
      inspectionCount += 1;
    }
  }

  const classified = initialInputs
    .map((input) => classifyUrl({ ...input, inspection: inspectionByUrl.get(input.url) ?? null }))
    .sort((a, b) => {
      if (a.primaryClassification === 'ok' && b.primaryClassification !== 'ok') return 1;
      if (a.primaryClassification !== 'ok' && b.primaryClassification === 'ok') return -1;
      return b.googleImpressions - a.googleImpressions || a.url.localeCompare(b.url);
    });

  writeReports({
    reportDir,
    generatedAt: new Date().toISOString(),
    dateRange,
    siteUrl,
    baseUrl,
    urls: classified,
    sitemapUrls: [...sitemapUrls].sort(),
    projectRoutes: [...projectRoutes].sort(),
    googleRows,
  });

  console.log(`SEO URL audit complete.`);
  console.log(`URLs checked: ${classified.length}`);
  console.log(`Google rows: ${googleRows.length}`);
  console.log(`URL inspections: ${inspectionCount}`);
  console.log(`Findings: ${classified.filter((url) => url.primaryClassification !== 'ok').length}`);
  console.log(`Reports: ${join(reportDir, 'seo-url-audit.md')}`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
