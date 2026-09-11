const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(), key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; } } });
const { supabase } = await import('C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-takeover-2026-09-10/src/integrations/supabase/client');
const { writeFileSync } = await import('node:fs');
const KEYS: Record<string, string> = { '4c2adb9e': 'w5-0', 'df5ac4a7': 'w5-1', '25612a7a': 'w10-0', 'b0f49349': 'w12-0', '2bf34ca7': 'w13-1', 'd560f419': 'w6-1(new 09bc6c81)', '368877b6': 'w6-1(old 700f0bdd)' };
const { error } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const res = await db.from('content_review_runs').select('id, target_id, content_hash, claude_review, adjudication, independent_review_requested').eq('kind', 'mission').not('claude_review', 'is', null);
  const out: any[] = [];
  for (const r of res.data ?? []) {
    const key = KEYS[String(r.content_hash).slice(0, 8)]; if (!key) continue;
    const cr = r.claude_review; const fs = cr.result?.findings ?? []; const adj = r.adjudication;
    const decisions = adj?.result?.decisions ?? [];
    const tally: Record<string, number> = {}; for (const d of decisions) tally[d.decision] = (tally[d.decision] ?? 0) + 1;
    out.push({ key, run_id: r.id, content_hash: r.content_hash, claude: { model: cr.model, verdict: cr.result?.verdict, findings: fs }, adjudication: adj ? { model: adj.model, primary_review_source: adj.primary_review_source ?? null, primary_review_ref: adj.primary_review_ref ?? null, decisions } : null });
    console.log(`## ${key} claude=${cr.result?.verdict} findings=${fs.length} | adjudication=${adj ? JSON.stringify(tally) + ' src=' + (adj.primary_review_source ?? 'n/a') : 'none'}`);
    for (const f of fs) { const d = decisions.find((x: any) => x.finding_id === f.id); console.log(`  [${f.severity}] ${f.id} @${f.where}${f.needs_professor ? ' · 교수자 확인' : ''}\n    ${(f.issue_ko ?? '').slice(0, 230)}\n    → 재검토: ${d ? d.decision + (d.needs_professor ? ' · 교수자 확인' : '') + ' — ' + (d.rationale_ko ?? '').slice(0, 160) : '없음'}`); }
  }
  writeFileSync('docs/research-trail/evidence/2026-09-11-reason-item-repair/official-claude-adjudication-20260911.json', JSON.stringify({ at: new Date().toISOString(), runs: out }, null, 2) + '\n');
} finally { await supabase.auth.signOut({ scope: 'local' }); }
