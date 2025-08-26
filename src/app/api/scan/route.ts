import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

export async function POST(req: Request) {
  let browser: puppeteer.Browser | null = null;

  try {
    console.log('[scan] request started');

    const { siteId }: ScanReq = await req.json();
    if (!siteId) {
      console.error('[scan] missing siteId');
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .select('url')
      .eq('id', siteId)
      .single();

    if (siteErr || !site?.url) {
      console.error('[scan] site lookup failed', siteErr);
      return NextResponse.json({ error: 'site not found' }, { status: 404 });
    }

    console.log('[scan] scanning URL:', site.url);

    const { data: scanRow, error: scanErr } = await supabase
      .from('scans')
      .insert({ site_id: siteId, score: null })
      .select('id')
      .single();

    if (scanErr) {
      console.error('[scan] scan insert failed', scanErr);
      return NextResponse.json({ error: scanErr.message }, { status: 500 });
    }

    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    console.log('[scan] getting chromium executablePath...');
    const executablePath = await chromium.executablePath();
    console.log('[scan] executablePath:', executablePath);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    console.log('[scan] opening page...');
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log('[scan] running axe-core...');
    const axe = new AxePuppeteer(page);
    const analysis = await axe.analyze();

    const violations = analysis.violations || [];
    console.log('[scan] violations found:', violations.length);

    const issues = violations
      .flatMap(v =>
        v.nodes.slice(0, 5).map(n => ({
          scan_id: scanRow.id,
          severity: (v.impact as string) || 'moderate',
          type: v.id,
          message: v.help,
          selector: n.target?.[0] || null,
          fix: { helpUrl: v.helpUrl, html: n.html }
        }))
      )
      .slice(0, 50);

    const score = Math.max(0, 100 - violations.length * 2);

    if (issues.length) {
      console.log('[scan] inserting issues:', issues.length);
      const { error: insErr } = await supabase.from('issues').insert(issues);
      if (insErr) {
        console.error('[scan] insert issues failed', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    const { error: updErr } = await supabase.from('scans').update({ score }).eq('id', scanRow.id);
    if (updErr) {
      console.error('[scan] update score failed', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    console.log('[scan] finished successfully');
    return NextResponse.json({ scanId: scanRow.id, score });
  } catch (e: any) {
    console.error('[scan error]', e);
    return NextResponse.json({ error: e.message || 'scan failed' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(err => console.error('[scan] browser close error', err));
    }
  }
}
