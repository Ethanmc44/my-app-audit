import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are an accessibility engineer. Given an issue (rule id, severity, message), the failing HTML snippet, and a CSS selector, produce:
1) A short explanation.
2) A concrete fix description.
3) Minimal code (HTML/CSS/ARIA) snippet.
Return JSON with keys: explanation, fix, code.`;

type Req = {
  issueId: string;       // NEW: we will save against this issue
  rule: string;
  severity: string;
  message: string;
  html?: string | null;
  selector?: string | null;
};

function fakeFix(rule: string, html?: string | null) {
  const r = rule.toLowerCase();
  if (r.includes('image') || r.includes('alt')) {
    return {
      explanation: 'Images need alternative text so screen readers can describe them.',
      fix: 'Add a meaningful alt attribute that describes the image’s purpose.',
      code: `<img src="hero.jpg" alt="Team working in the office">`,
    };
  }
  if (r.includes('label') || r.includes('name-role-value')) {
    return {
      explanation: 'Interactive controls must have accessible names.',
      fix: 'Link inputs to labels with for/id or add aria-label.',
      code: `<label for="email">Email</label>\n<input id="email" type="email">`,
    };
  }
  if (r.includes('contrast')) {
    return {
      explanation: 'Text needs sufficient contrast against its background.',
      fix: 'Increase contrast to meet WCAG 2.1 AA (4.5:1 normal text).',
      code: `.button { color: #111; background:#fff; }`,
    };
  }
  return {
    explanation: 'General accessibility issue.',
    fix: 'Apply the referenced WCAG rule and use semantic HTML. Add ARIA only when needed.',
    code: html ? `<!-- Review and correct -->\n${html}` : '<!-- Provide semantic HTML and labels -->',
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Req;
  if (!body.issueId) {
    return NextResponse.json({ error: 'issueId required' }, { status: 400 });
  }

  // 1) If USE_FAKE_FIXES is set, return a stub and save it
  if (process.env.USE_FAKE_FIXES === 'true') {
    const out = fakeFix(body.rule, body.html);
    const { data: saved, error } = await supabaseAdmin
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: out.explanation,
        fix: out.fix,
        code: out.code,
      })
      .select('id, issue_id, explanation, fix, code, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(saved);
  }

  // 2) Try OpenAI
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY missing');
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(body) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0]?.message?.content || '{}';
    let json: any = {};
    try { json = JSON.parse(content); } catch { json = { explanation: content }; }

    // 3) Save to Supabase
    const { data: saved, error } = await supabaseAdmin
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: json.explanation ?? null,
        fix: json.fix ?? null,
        code: json.code ?? null,
      })
      .select('id, issue_id, explanation, fix, code, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(saved);
  } catch (e: any) {
    // 4) On quota/other errors, fallback + save
    const out = fakeFix(body.rule, body.html);
    const { data: saved, error } = await supabaseAdmin
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: out.explanation,
        fix: out.fix,
        code: out.code,
      })
      .select('id, issue_id, explanation, fix, code, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(saved);
  }
}
