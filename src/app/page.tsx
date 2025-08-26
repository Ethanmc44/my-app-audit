'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

type Site = { id: string; url: string; created_at?: string };

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);

  const isAuthed = useMemo(() => !!email, [email]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) { setLoading(false); return; }
      setEmail(user.email ?? null);

      const [{ data: userRow }, { data: siteRows, error: sitesErr }] = await Promise.all([
        supabase.from('users').select('plan').single(),
        supabase.from('sites').select('id,url,created_at').order('created_at', { ascending: false }),
      ]);
      setPlan(userRow?.plan ?? 'free');
      if (sitesErr) setError(sitesErr.message);
      setSites(siteRows ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading && !isAuthed) window.location.href = '/login'; }, [loading, isAuthed]);

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); } catch { return alert('Enter a valid URL, e.g. https://example.com'); }

    setBusy(true); setError(null);
    const { data: udata } = await supabase.auth.getUser();
    if (!udata.user) return;
    const optimistic: Site = { id: `tmp-${Date.now()}`, url: u, created_at: new Date().toISOString() };
    setSites(s => [optimistic, ...s]); setUrl('');
    const { data, error } = await supabase.from('sites').insert({ user_id: udata.user.id, url: u }).select('id,url,created_at').single();
    if (error) { setError(error.message); setSites(s => s.filter(x => x.id !== optimistic.id)); }
    else { setSites(s => [data!, ...s.filter(x => x.id !== optimistic.id)]); }
    setBusy(false);
  }

  async function removeSite(id: string) {
    setBusy(true);
    const prev = sites;
    setSites(s => s.filter(x => x.id !== id));
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) { setSites(prev); setError(error.message); }
    setBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); window.location.href = '/login'; }

  async function runScan(id: string) {
    try {
      setScanning(id);
      const r = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'scan failed');
      window.location.href = `/scans/${j.scanId}`;
    } catch (e: any) { alert(`Scan error: ${e.message}`); }
    finally { setScanning(null); }
  }

  if (loading) return <div style={{ opacity: 0.7 }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Welcome{email ? `, ${email}` : ''}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Plan: <b>{plan ?? 'free'}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/" style={{ padding: '6px 10px', border: '1px solid #374151', borderRadius: 8 }}>
            Dashboard
          </Link>
          {!isAuthed && (
            <Link href="/login" style={{ display: 'inline-block' }}>
              Login
            </Link>
          )}
          {isAuthed && <button onClick={signOut}>Sign out</button>}
        </div>
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 14, border: '1px solid #7f1d1d', padding: 8, borderRadius: 6 }}>
          Error: {error}
        </div>
      )}

      {/* Add site */}
      <section style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Add a website</h3>
        <form onSubmit={addSite} style={{ display: 'flex', gap: 8 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' }}
          />
          <button type="submit" disabled={busy} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #374151' }}>
            {busy ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>

      {/* List sites */}
      <section style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Your websites</h3>
        {sites.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No sites yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sites.map(s => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #111827' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.url}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{new Date(s.created_at ?? '').toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => runScan(s.id)}
                    disabled={scanning === s.id}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #374151', opacity: scanning === s.id ? 0.6 : 1 }}
                  >
                    {scanning === s.id ? 'Scanning…' : 'Scan'}
                  </button>
                  <Link href={`/sites/${s.id}`} style={{ padding: '6px 10px', border: '1px solid #374151', borderRadius: 8 }}>
                    View scans
                  </Link>
                  <button
                    onClick={() => removeSite(s.id)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #4b5563', color: '#f87171' }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upgrade */}
      {plan !== 'pro' && (
        <section style={{ border: '1px dashed #374151', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Upgrade to Pro</h3>
          <ul style={{ marginTop: 4 }}>
            <li>AI fixes</li>
            <li>Multi-page crawl</li>
            <li>PDF/CSV export</li>
          </ul>
          <button onClick={() => alert('Stripe checkout will be wired next')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #374151' }}>
            Go Pro
          </button>
        </section>
      )}
    </div>
  );
}