import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

function wsToHttpPressure(wsUrl: string) {
  // wss://chrome.browserless.io?token=XXX  -> https://chrome.browserless.io/pressure?token=XXX
  const u = new URL(wsUrl);
  const token = u.searchParams.get('token') || '';
  return `https://chrome.browserless.io/pressure?token=${token}`;
}

export async function POST(req: Request) {
  let browser: puppeteer.Browser | null = null;

  try {
    const { siteId }: ScanReq = await req.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: site, error: siteErr } = await supabase.from('sites').select('url').eq('id', siteId).single();
    if (siteErr || !site?.url) return NextResponse.json({ error: 'site not found' }, { status: 404 });

    const { data: scanRow, error: scanErr } = await supabase
      .from('scans').insert({ site_id: siteId, score: null }).select('id').single();
    if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 });

    const raw = (process.env.BROWSERLESS_WS || '').trim();
    if (!raw || !raw.startsWith('wss://chrome.browserless.io')) {
      return NextResponse.json({ error: 'BROWSERLESS_WS missing or malformed' }, { status: 500 });
    }

    // Preflight: check token/quota
    const probe = await fetch(wsToHttpPressure(raw), { method: 'GET' });
    if (probe.status === 403) {
      return NextResponse.json({ error: 'Browserless 403: invalid/revoked token or no quota' }, { status: 500 });
    }
    if (!probe.ok) {
      return NextResponse.json({ error: `Browserless preflight failed: ${probe.status}` }, { status: 500 });
    }

    browser = await puppeteer.connect({ browserWSEndpoint: raw, ignoreHTTPSErrors: true });
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const axe = new AxePuppeteer(page);
    const analysis = await axe.analyze();

    const violations = analysis.violations || [];
    const issues = violations.flatMap(v =>
      v.nodes.slice(0, 5).map(n => ({
        scan_id: scanRow.id,
        severity: (v.impact as string) || 'moderate',
        type: v.id,
        message: v.help,
        selector: n.target?.[0] || null,
        fix: { helpUrl: v.helpUrl, html: n.html }
      }))
    ).slice(0, 50);

    const score = Math.max(0, 100 - violations.length * 2);
    if (issues.length) {
      const { error: insErr } = await supabase.from('issues').insert(issues);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    const { error: updErr } = await supabase.from('scans').update({ score }).eq('id', scanRow.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ scanId: scanRow.id, score });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'scan failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
