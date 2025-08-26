import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReq = { siteId: string };

export async function POST(req: Request) {
  const { siteId }: ScanReq = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: scan, error } = await supabase
    .from('scans')
    .insert({ site_id: siteId, score: 90 })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ scanId: scan.id });
}
