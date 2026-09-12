// Read-only: MJT1/MJT2 highlight spans for the 20 cells, to test a data-driven "shared form" rule.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  },
});
const { supabase } = await import('../../../../../src/integrations/supabase/client');
const { readFileSync, writeFileSync } = await import('node:fs');
const dir = 'docs/research-trail/evidence/2026-09-12-gate-provenance-rebind';
const data = JSON.parse(readFileSync(`${dir}/checklist-data.json`, 'utf8'));
const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const res = await db.from('scenarios').select('scenario_id, mission_content').in('scenario_id', data.rows.map((r: any) => r.scenario_id));
  if (res.error) throw new Error(res.error.message);
  const keyOf = new Map(data.rows.map((r: any) => [r.scenario_id, r.key]));
  const han = (t: string) => [...(t || '')].filter((c) => /\p{Script=Han}|[吧吗呢啊]/u.test(c)).join('');
  const lcs = (a: string, b: string) => { let best = ''; const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; if (dp[i][j] > best.length) best = a.slice(i - dp[i][j], i); }
    return best; };
  const rows = res.data.map((s: any) => {
    const [a, b] = s.mission_content.mpj_items;
    const h1 = (a.highlights ?? []).join(' / '), h2 = (b.highlights ?? []).join(' / ');
    const shared = lcs(han(h1), han(h2));
    return { key: keyOf.get(s.scenario_id), h1, h2, shared, len: shared.length, relation1: a.relation_ko, relation2: b.relation_ko };
  }).sort((x: any, y: any) => x.key.localeCompare(y.key, undefined, { numeric: true }));
  for (const r of rows) console.log(`${r.key.padEnd(6)} lcs=${String(r.len).padStart(2)} 「${r.shared}」  | MJT1 ${r.h1}  ⇄  MJT2 ${r.h2}`);
  writeFileSync(`${dir}/highlights.json`, `${JSON.stringify(rows, null, 2)}\n`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
