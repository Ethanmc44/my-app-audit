import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

function j(x: unknown) { try { return JSON.stringify(x); } catch { return String(x); } }

export async function POST(req: Request) {
  let browser: puppeteer.Browser | null = null;
  const step = (s: string, extra?: unknown) => console.log(`[scan] ${s}`, extra ? j(extra) : '');

  try {
    step('start');
    const { siteId }: ScanReq = await req.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    step('env', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'missing',
      anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'missing',
      service: process.env.SUPABASE_SERVICE_ROLE ? 'ok' : 'missing',
    });

    const { data: site, error: siteErr } = await supabase
      .from('sites').select('url').eq('id', siteId).single();
    if (siteErr || !site?.url) return NextResponse.json({ error: 'site not found' }, { status: 404 });
    step('site', site.url);

    const { data: scanRow, error: scanErr } = await supabase
      .from('scans').insert({ site_id: siteId, score: null }).select('id').single();
    if (scanErr) { step('scan insert error', scanErr.message); return NextResponse.json({ error: scanErr.message }, { status: 500 }); }
    step('scan id', scanRow.id);

    const execPath = await chromium.executablePath();
    step('chromium.executablePath', execPath);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: chromium.headless,
    });
    step('puppeteer.launch ok');

    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    step('page.goto ok');

    const axe = new AxePuppeteer(page);
    const analysis = await axe.analyze();
    step('axe ok', { violations: analysis.violations?.length || 0 });

    const violations = analysis.violations || [];
    const issues = violations.flatMap(v =>
      v.nodes.slice(0, 5).map(n => ({
        scan_id: scanRow.id,
        severity: (v.impact as string) || 'moderate',
        type: v.id,
        message: v.help,
        selector: n.target?.[0] || null,
        fix: { helpUrl: v.helpUrl, html: n.html },
      }))
    ).slice(0, 50);

    const score = Math.max(0, 100 - violations.length * 2);
    if (issues.length) {
      const { error: insErr } = await supabase.from('issues').insert(issues);
      if (insErr) { step('issues insert error', insErr.message); return NextResponse.json({ error: insErr.message }, { status: 500 }); }
    }
    const { error: updErr } = await supabase.from('scans').update({ score }).eq('id', scanRow.id);
    if (updErr) { step('scan update error', updErr.message); return NextResponse.json({ error: updErr.message }, { status: 500 }); }

    step('done');
    return NextResponse.json({ scanId: scanRow.id });
  } catch (e: any) {
    console.error('[scan] fail', e?.stack || e?.message || e);
    return NextResponse.json({ error: e?.message || 'scan failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
