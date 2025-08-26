import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are an accessibility engineer. Given an issue (rule id, severity, message), the failing HTML snippet, and a CSS selector, produce:
1) A short explanation.
2) A concrete fix description.
3) Minimal code (HTML/CSS/ARIA) snippet.
Return JSON with keys: explanation, fix, code.`;

type FixRequest = {
  issueId: string;
  rule: string;
  severity: string;
  message: string;
  html?: string | null;
  selector?: string | null;
};

type FixResult = { explanation: string; fix: string; code: string };

function fakeFix(rule: string, html?: string | null): FixResult {
  const r = rule.toLowerCase();
  if (r.includes('alt') || r.includes('image')) {
    return {
      explanation: 'Images need alternative text.',
      fix: 'Add a meaningful alt attribute.',
      code: `<img src="hero.jpg" alt="Team working in an office">`,
    };
  }
  if (r.includes('label') || r.includes('name')) {
    return {
      explanation: 'Interactive controls need accessible names.',
      fix: 'Associate a label or add aria-label.',
      code: `<label for="email">Email</label>\n<input id="email" type="email">`,
    };
  }
  if (r.includes('contrast')) {
    return {
      explanation: 'Text must meet contrast ratios.',
      fix: 'Increase contrast to at least 4.5:1 for body text.',
      code: `.btn { color:#111; background:#fff; }`,
    };
  }
  return {
    explanation: 'General accessibility issue.',
    fix: 'Apply the relevant WCAG guidance and use semantic HTML.',
    code: html ? html : '<!-- Add labels, roles, and semantics as needed -->',
  };
}

export async function POST(req: Request) {
  const body: FixRequest = await req.json();
  if (!body.issueId) return NextResponse.json({ error: 'issueId required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  if (process.env.USE_FAKE_FIXES === 'true') {
    const out = fakeFix(body.rule, body.html);
    const { data, error } = await supabase
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: out.explanation,
        fix: out.fix,
        code: out.code,
      })
      .select('id,issue_id,explanation,fix,code,created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');

    const client = new OpenAI({ apiKey });

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
    let json: Partial<FixResult> = {};
    try {
      json = JSON.parse(content) as FixResult;
    } catch {
      json = { explanation: content, fix: '', code: '' };
    }

    const { data, error } = await supabase
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: json.explanation ?? null,
        fix: json.fix ?? null,
        code: json.code ?? null,
      })
      .select('id,issue_id,explanation,fix,code,created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch {
    const out = fakeFix(body.rule, body.html);
    const { data, error } = await supabase
      .from('fixes')
      .insert({
        issue_id: body.issueId,
        explanation: out.explanation,
        fix: out.fix,
        code: out.code,
      })
      .select('id,issue_id,explanation,fix,code,created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
