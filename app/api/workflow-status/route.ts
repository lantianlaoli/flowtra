import { NextRequest, NextResponse } from 'next/server';

// Backward compatibility redirect to new single-video API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Redirect to new single-video API endpoint with same parameters
    const response = await fetch(`${request.nextUrl.origin}/api/single-video/workflow-status?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        ...Object.fromEntries(request.headers.entries())
      }
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: response.headers
    });

  } catch (error) {
    console.error('Legacy API redirect error:', error);
    return NextResponse.json({
      error: 'API endpoint has been moved to /api/single-video/workflow-status',
      message: 'Please update your API calls to use the new endpoint'
    }, { status: 301 });
  }
}