// app/api/hot-test/route.ts
import { NextResponse } from 'next/server';
import { getHotMessage } from '@/lib/test-hot'; // 或者 ../.. 相对路径按你tsconfig来

export async function GET() {


  console.log('===================getHotMessage:=====================', getHotMessage());
  return NextResponse.json({
    msg: getHotMessage(),
    time: new Date().toISOString(),
  });
}
