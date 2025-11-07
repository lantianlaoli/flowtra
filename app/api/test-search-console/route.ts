/**
 * Diagnostic endpoint to check Google Search Console access
 *
 * This helps troubleshoot the "You do not own this site" error by:
 * 1. Listing all sites the Service Account has access to
 * 2. Verifying the siteUrl format matches Search Console configuration
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Use full webmasters scope (not readonly) for URL Inspection API
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      return NextResponse.json({
        error: 'Missing credentials',
        message: 'GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not configured'
      }, { status: 500 });
    }

    // Initialize auth
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
      scopes: [SEARCH_CONSOLE_SCOPE],
    });

    const searchConsole = google.searchconsole({
      version: 'v1',
      auth,
    });

    console.log('[Test Search Console] Fetching sites list...');

    // List all sites the Service Account has access to
    const sitesResponse = await searchConsole.sites.list();
    const sites = sitesResponse.data.siteEntry || [];

    console.log(`[Test Search Console] Found ${sites.length} sites`);

    // Get configured site URL from env
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowtra.store';

    // Check various URL formats that might be configured
    const urlVariants = [
      configuredSiteUrl,
      configuredSiteUrl.replace(/\/$/, ''), // Remove trailing slash
      configuredSiteUrl + '/', // Add trailing slash
      `sc-domain:${new URL(configuredSiteUrl).hostname}`, // Domain property format
    ];

    // Check if any variant is in the list
    const matchedSite = sites.find(site =>
      urlVariants.includes(site.siteUrl || '')
    );

    return NextResponse.json({
      success: true,
      serviceAccount: clientEmail,
      configuredSiteUrl,
      urlVariantsChecked: urlVariants,
      matchedSite: matchedSite ? {
        siteUrl: matchedSite.siteUrl,
        permissionLevel: matchedSite.permissionLevel,
      } : null,
      availableSites: sites.map(site => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      })),
      diagnosis: matchedSite
        ? `✅ Found matching site: ${matchedSite.siteUrl} with ${matchedSite.permissionLevel} permission`
        : `❌ No matching site found. You need to add ${clientEmail} as Owner to one of these property formats in Google Search Console: ${urlVariants.join(', ')}`,
      recommendation: matchedSite
        ? 'Configuration looks correct! If verification still fails, try waiting 5-10 minutes for permissions to propagate, or check if you need to enable the Search Console API in Google Cloud Console.'
        : `Please go to Google Search Console (https://search.google.com/search-console) and:\n1. Select or add property: ${configuredSiteUrl}\n2. Go to Settings > Users and permissions\n3. Add user: ${clientEmail}\n4. Set permission level to: Owner\n5. Wait 5-10 minutes for changes to take effect`,
    });

  } catch (error: unknown) {
    console.error('[Test Search Console] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    const errorDetails = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: unknown } }).response?.data || String(error)
      : String(error);

    return NextResponse.json({
      error: 'API Error',
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
    }, { status: 500 });
  }
}
