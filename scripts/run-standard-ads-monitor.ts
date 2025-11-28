import { NextRequest } from 'next/server';
import { POST as runStandardAdsMonitor } from '@/app/api/standard-ads/monitor-tasks/route';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    const unwrapped = rawValue.replace(/^['"]|['"]$/g, '');

    if (!(key in process.env)) {
      process.env[key] = unwrapped;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

async function main() {
  const request = new NextRequest('http://localhost/api/standard-ads/monitor-tasks', {
    method: 'POST',
    body: null
  });
  const response = await runStandardAdsMonitor(request);
  const result = await response.json();

  // eslint-disable-next-line no-console
  console.log('Standard ads monitor result:', result);
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('Failed to run standard ads monitor:', error);
  process.exitCode = 1;
});
