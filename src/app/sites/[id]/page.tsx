'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Scan = { id:string; score:number|null; created_at:string };

export default function SiteScans() {
  const { id: siteId } = useParams() as { id: string };
  const [scans,setScans] = useState<Scan[]>([]);
  const [url,setUrl] = useState<string>('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: site } = await supabase.from('sites').select('url').eq('id', siteId).single();
      setUrl(site?.url ?? '');
      const { data } = await supabase.from('scans').select('id,score,created_at').eq('site_id', siteId).order('created_at',{ascending:false});
      setScans(data ?? []);
      setLoading(false);
    })();
  }, [siteId]);

  async function rescan() {
    try {
      setBusy(true);
      const r = await fetch('/api/scan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ siteId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'scan failed');
      window.location.href = `/scans/${j.scanId}`;
    } catch(e:any) { alert(`Scan error: ${e.message}`); }
    finally { setBusy(false); }
  }

  if (loading) return <main style={{padding:'1rem'}}>Loading…</main>;

  return (
    <main style={{padding:'1rem', display:'grid', gap:12}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2 style={{margin:0}}>Scans for <span style={{opacity:.8}}>{url}</span></h2>
        <div style={{display:'flex', gap:8}}>
          <Link href="/" style={{ padding:'6px 10px', border:'1px solid #374151', borderRadius:8 }}>Dashboard</Link>
          <button onClick={rescan} disabled={busy} style={{padding:'6px 10px', border:'1px solid #374151', borderRadius:8}}>
            {busy ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {scans.length === 0 ? (
        <p>No scans yet.</p>
      ) : (
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {scans.map(s => (
            <li key={s.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #111827'}}>
              <div>
                <div>Score: <b>{s.score ?? '-'}</b></div>
                <div style={{fontSize:12,opacity:.7}}>{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <Link href={`/scans/${s.id}`}>View issues</Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/">← Back</Link>
    </main>
  );
}