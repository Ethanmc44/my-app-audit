import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ws = (process.env.BROWSERLESS_WS || '').trim();

  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'BROWSERLESS_WS not set' },
      { status: 500 }
    );
  }
  if (!ws.startsWith('wss://')) {
    return NextResponse.json(
      { ok: false, error: 'BROWSERLESS_WS must start with wss://' },
      { status: 500 }
    );
  }

  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: ws,
      ignoreHTTPSErrors: true,
    });

    const version = await browser.version();
    return NextResponse.json({ ok: true, wsHost: new URL(ws).host, version });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
