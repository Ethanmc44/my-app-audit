'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState('usera@test.com');
  const [pw, setPw] = useState('password123');
  const [err, setErr] = useState<string|null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    else r.push('/');
  }

  return (
    <form onSubmit={onSubmit} style={{display:'grid',gap:8,maxWidth:320,margin:'2rem'}}>
      <h2>Login</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
      <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="password" type="password" />
      <button type="submit">Sign in</button>
      {err && <small style={{color:'tomato'}}>{err}</small>}
    </form>
  );
}
