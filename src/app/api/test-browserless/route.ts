import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const raw = (process.env.BROWSERLESS_WS || '').trim();
  const ws = raw.replace(/\.(?=\?|$)/, '');
  if (!ws.startsWith('wss://')) return NextResponse.json({ ok:false,error:'BROWSERLESS_WS malformed' },{ status:500 });
  let browser:null|puppeteer.Browser=null;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: ws, ignoreHTTPSErrors: true });
    const version = await browser.version();
    return NextResponse.json({ ok:true, wsHost:new URL(ws).host, version });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message||String(e) },{ status:500 });
  } finally {
    if (browser) await browser.close().catch(()=>{});
  }
}
