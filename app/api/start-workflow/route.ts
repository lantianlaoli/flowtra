import { NextRequest, NextResponse } from 'next/server';

// Backward compatibility redirect to new single-video API
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Redirect to new single-video API endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/single-video/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      },
      body
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: response.headers
    });

  } catch (error) {
    console.error('Legacy API redirect error:', error);
    return NextResponse.json({
      error: 'API endpoint has been moved to /api/single-video/start',
      message: 'Please update your API calls to use the new endpoint'
    }, { status: 301 });
  }
}