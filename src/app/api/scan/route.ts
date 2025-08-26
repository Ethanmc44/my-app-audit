import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const axeSource = fs.readFileSync(axePath, 'utf8');

function normalize(url: string) {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const parsed = new URL(u);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https allowed');
  return parsed.toString();
}

type Body = { siteId: string };

export async function POST(req: Request) {
  try {
    const { siteId } = (await req.json()) as Body;
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const { data: site, error: siteErr } = await supabaseAdmin
      .from('sites').select('id,url,user_id').eq('id', siteId).single();
    if (siteErr || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

    const url = normalize(site.url);

    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123 Safari/537.36'
    });
    page.setDefaultNavigationTimeout(45000);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch {
      await browser.close();
      return NextResponse.json({ error: 'Page blocked or timed out' }, { status: 504 });
    }

    await page.addScriptTag({ content: axeSource });
    const results: any = await page.evaluate(async () => {
      // @ts-ignore
      return await (window as any).axe.run(document, { resultTypes: ['violations'] });
    });

    await browser.close();

    const violations = results?.violations ?? [];
    const score = Math.max(0, 100 - Math.min(100, violations.length * 5));

    const { data: scanRow, error: scanErr } = await supabaseAdmin
      .from('scans').insert({ site_id: site.id, status: 'done', score })
      .select('id').single();
    if (scanErr || !scanRow) return NextResponse.json({ error: 'scan insert failed' }, { status: 500 });

    if (violations.length) {
      const rows = violations.flatMap((v: any) =>
        v.nodes.map((n: any) => ({
          scan_id: scanRow.id,
          type: v.id,
          selector: n.target?.[0] ?? null,
          severity: v.impact ?? 'minor',
          message: v.help ?? v.description ?? 'Issue',
          fix: { helpUrl: v.helpUrl, tags: v.tags, html: n.html },
        }))
      );
      const { error: issuesErr } = await supabaseAdmin.from('issues').insert(rows);
      if (issuesErr) return NextResponse.json({ error: 'issues insert failed' }, { status: 500 });
    }

    return NextResponse.json({ siteId: site.id, scanId: scanRow.id, score, issues: violations.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'scan error' }, { status: 500 });
  }
}
