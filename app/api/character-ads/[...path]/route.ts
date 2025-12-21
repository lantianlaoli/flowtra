import { NextRequest, NextResponse } from 'next/server';

// Backward compatibility redirect for old character-ads API routes
// Redirects all /api/character-ads/* requests to /api/avatar-ads/*
// This redirect will be maintained for 3 months from 2025-12-21 to allow gradual migration
// Remove after 2026-03-21

export async function GET(request: NextRequest) {
  const newPath = request.nextUrl.pathname.replace('/api/character-ads', '/api/avatar-ads');
  const url = new URL(newPath + request.nextUrl.search, request.url);
  return NextResponse.redirect(url, 308); // 308 Permanent Redirect
}

export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
export const PATCH = GET;
