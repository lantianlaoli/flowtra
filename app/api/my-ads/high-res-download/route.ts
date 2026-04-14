import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  return NextResponse.json(
    {
      error: 'High-resolution export downloads are no longer supported. Download the native generated file instead.'
    },
    { status: 410 }
  );
}
