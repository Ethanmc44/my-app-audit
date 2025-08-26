import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

export async function POST(req: Request) {
  try {
    const { siteId }: ScanReq = await req.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .insert({ site_id: siteId, score: 90 })
      .select('id')
      .single();
    if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 });

    const sampleIssues = [
      {
        scan_id: scan.id,
        severity: 'serious',
        type: 'image-alt',
        message: 'Image elements must have [alt] attributes',
        selector: 'img.hero',
        fix: { helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/image-alt', html: '<img src="/hero.jpg">' },
      },
      {
        scan_id: scan.id,
        severity: 'moderate',
        type: 'button-name',
        message: 'Buttons must have discernible text',
        selector: 'button.icon-only',
        fix: { helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/button-name', html: '<button><svg></svg></button>' },
      },
      {
        scan_id: scan.id,
        severity: 'critical',
        type: 'color-contrast',
        message: 'Elements must have sufficient color contrast',
        selector: '.btn.primary',
        fix: { helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast', html: '<a class="btn primary">Buy</a>' },
      },
      {
        scan_id: scan.id,
        severity: 'minor',
        type: 'html-has-lang',
        message: 'html element must have a lang attribute',
        selector: 'html',
        fix: { helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/html-has-lang', html: '<html>' },
      },
      {
        scan_id: scan.id,
        severity: 'moderate',
        type: 'label',
        message: 'Form inputs must have associated labels',
        selector: 'input#email',
        fix: { helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/label', html: '<input id="email" type="email">' },
      },
    ];

    const { error: issuesErr } = await supabase.from('issues').insert(sampleIssues);
    if (issuesErr) return NextResponse.json({ error: issuesErr.message }, { status: 500 });

    return NextResponse.json({ scanId: scan.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'scan failed' }, { status: 500 });
  }
}
