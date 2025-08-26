'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Issue = {
  id: string;
  selector: string | null;
  severity: 'minor' | 'moderate' | 'serious' | 'critical' | string;
  message: string;
  type: string;
  fix: { helpUrl?: string; tags?: string[]; html?: string } | null;
};

type SavedFix = { id: string; issue_id: string; explanation: string | null; fix: string | null; code: string | null };

export default function ScanDetails() {
  const { id } = useParams() as { id: string };
  const [issues, setIssues] = useState<Issue[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<'all' | 'minor' | 'moderate' | 'serious' | 'critical'>('all');
  const [q, setQ] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, SavedFix>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: scan } = await supabase.from('scans').select('score').eq('id', id).single();
      if (scan) setScore(scan.score);

      const { data: rows } = await supabase.from('issues').select('id,selector,severity,message,type,fix').eq('scan_id', id);
      const list = (rows as Issue[]) ?? [];
      setIssues(list);

      if (list.length) {
        const { data: fxRows } = await supabase.from('fixes').select('id,issue_id,explanation,fix,code').in('issue_id', list.map(i => i.id));
        const map: Record<string, SavedFix> = {};
        (fxRows ?? []).forEach((f: any) => { map[f.issue_id] = f; });
        setFixes(map);
      }

      setLoading(false);
    })();
  }, [id]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return issues.filter(i => {
      if (severity !== 'all' && i.severity !== severity) return false;
      if (!text) return true;
      return (
        i.message.toLowerCase().includes(text) ||
        (i.type || '').toLowerCase().includes(text) ||
        (i.selector || '').toLowerCase().includes(text)
      );
    });
  }, [issues, q, severity]);

  function downloadCSV() {
    const header = ['id','severity','type','message','selector','helpUrl'];
    const rows = filtered.map(i => [
      i.id, i.severity, i.type,
      `"${(i.message||'').replace(/"/g,'""')}"`,
      `"${(i.selector||'').replace(/"/g,'""')}"`,
      i.fix?.helpUrl || ''
    ].join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `scan-${id}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  async function suggestFix(issue: Issue) {
    try {
      setFixing(issue.id);
      const r = await fetch('/api/fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: issue.id, rule: issue.type, severity: issue.severity,
          message: issue.message, html: issue.fix?.html ?? null, selector: issue.selector ?? null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'fix failed');
      setFixes(prev => ({ ...prev, [issue.id]: j as SavedFix }));
    } catch (e: any) { alert(`AI fix error: ${e.message}`); }
    finally { setFixing(null); }
  }

  if (loading) return <main style={{ padding: '1rem' }}>Loading…</main>;

  return (
    <main style={{ padding: '1rem', display:'grid', gap:12 }}>
      {/* Header with only Dashboard link */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ margin:0 }}>Scan Results</h2>
        <Link href="/" style={{ padding:'6px 10px', border:'1px solid #374151', borderRadius:8 }}>Dashboard</Link>
      </div>

      {score !== null && <p>Accessibility Score: <b>{score}</b></p>}

      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <select value={severity} onChange={e=>setSeverity(e.target.value as any)} style={{padding:6, border:'1px solid #374151', borderRadius:8}}>
          <option value="all">All severities</option>
          <option value="critical">critical</option>
          <option value="serious">serious</option>
          <option value="moderate">moderate</option>
          <option value="minor">minor</option>
        </select>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter by text…"
          style={{flex:1, padding:6, border:'1px solid #374151', borderRadius:8}} />
        <button onClick={downloadCSV} style={{ padding:'6px 10px', border:'1px solid #374151', borderRadius:8 }}>Export CSV</button>
      </div>

      {filtered.length === 0 ? (
        <p>No matching issues.</p>
      ) : (
        <table style={{ borderCollapse:'collapse', width:'100%' }}>
          <thead>
            <tr>
              <th style={{ border:'1px solid #333', padding:6 }}>Severity</th>
              <th style={{ border:'1px solid #333', padding:6 }}>Rule</th>
              <th style={{ border:'1px solid #333', padding:6 }}>Message</th>
              <th style={{ border:'1px solid #333', padding:6 }}>Selector</th>
              <th style={{ border:'1px solid #333', padding:6 }}>Help</th>
              <th style={{ border:'1px solid #333', padding:6 }}>AI Fix</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const fx = fixes[i.id];
              return (
                <tr key={i.id}>
                  <td style={{ border:'1px solid #333', padding:6 }}>{i.severity}</td>
                  <td style={{ border:'1px solid #333', padding:6 }}>{i.type}</td>
                  <td style={{ border:'1px solid #333', padding:6 }}>{i.message}</td>
                  <td style={{ border:'1px solid #333', padding:6 }}>{i.selector}</td>
                  <td style={{ border:'1px solid #333', padding:6 }}>
                    {i.fix?.helpUrl ? <a href={i.fix.helpUrl} target="_blank">Docs</a> : '-'}
                  </td>
                  <td style={{ border:'1px solid #333', padding:6, minWidth:260 }}>
                    {!fx ? (
                      <button
                        onClick={()=>suggestFix(i)}
                        disabled={fixing === i.id}
                        style={{ padding:'4px 8px', border:'1px solid #374151', borderRadius:8, opacity: fixing===i.id ? 0.6 : 1 }}
                      >
                        {fixing === i.id ? 'Thinking…' : 'Suggest fix'}
                      </button>
                    ) : (
                      <div style={{display:'grid', gap:6}}>
                        {fx.explanation && <div><b>Why:</b> {fx.explanation}</div>}
                        {fx.fix && <div><b>Fix:</b> {fx.fix}</div>}
                        {fx.code && (
                          <pre style={{whiteSpace:'pre-wrap', background:'#0b0b0b', padding:8, borderRadius:8, border:'1px solid #374151'}}>
{fx.code}
                          </pre>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}