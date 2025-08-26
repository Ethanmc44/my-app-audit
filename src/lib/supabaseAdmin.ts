import { createClient, SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url) throw new Error('SUPABASE url missing');
  if (!key) throw new Error('SUPABASE service role key missing');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}
