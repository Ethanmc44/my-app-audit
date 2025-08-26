import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  // simple read of tables count to prove admin client works
  const { count, error } = await supabaseAdmin
    .from('sites')
    .select('id', { count: 'exact', head: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sitesCount: count ?? 0 });
}
