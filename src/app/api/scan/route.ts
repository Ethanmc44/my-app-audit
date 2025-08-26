import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

export async function POST(req: Request) {
  let browser: puppeteer.Browser | null = null;

  try {
    const { siteId }: ScanReq = await req.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .select('url')
      .eq('id', siteId)
      .single();
    if (siteErr || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .insert({ site_id: siteId, score: null })
      .select('id')
      .single();
    if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 });

    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const axe = new AxePuppeteer(page);
    const analysis = await axe.analyze();

    const violations = analysis.violations || [];
    const issues = violations.flatMap(v =>
      v.nodes.slice(0, 5).map(n => ({
        scan_id: scan.id,
        severity: v.impact || 'moderate',
        type: v.id,
        message: v.help,
        selector: n.target?.[0] || null,
        fix: { helpUrl: v.helpUrl, html: n.html }
      }))
    ).slice(0, 50);

    const score = Math.max(0, 100 - violations.length * 2);

    if (issues.length) {
      const { error: issuesErr } = await supabase.from('issues').insert(issues);
      if (issuesErr) return NextResponse.json({ error: issuesErr.message }, { status: 500 });
    }

    const { error: updErr } = await supabase.from('scans').update({ score }).eq('id', scan.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ scanId: scan.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'scan failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
