import { NextResponse } from 'next/server';
export async function GET() {
  const raw = (process.env.BROWSERLESS_WS || '').trim();
  return NextResponse.json({ raw, host: raw ? new URL(raw).host : null });
}
