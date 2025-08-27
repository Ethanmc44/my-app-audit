import { NextResponse } from 'next/server';

export async function GET() {
  const v = (process.env.BROWSERLESS_WS || '').trim();
  return NextResponse.json({
    hasVar: !!v,
    value: v ? v.slice(0, 20) + '...' : null,
    startsWithWss: v.startsWith('wss://')
  });
}
