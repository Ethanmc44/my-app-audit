import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE!; // service role key

export function getSupabaseAdmin() {
  if (!url || !key) throw new Error('Supabase envs missing');
  return createClient(url, key);
}
