import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const raw = (process.env.BROWSERLESS_WS || '').trim();
  if (!raw) return NextResponse.json({ ok: false, error: 'BROWSERLESS_WS not set' }, { status: 500 });

  // normalize: remove any trailing dot from hostname only
  const u = new URL(raw);
  u.hostname = u.hostname.replace(/\.$/, '');
  const ws = u.toString();

  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: ws, ignoreHTTPSErrors: true });
    const version = await browser.version();
    return NextResponse.json({ ok: true, ws, host: u.hostname, version });
  } catch (e: any) {
    return NextResponse.json({ ok: false, ws, host: u.hostname, error: e?.message || String(e) }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
