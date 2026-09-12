// Read-only probe: columns the preflight did not select (instructor experience, lease, quality_check deltas).
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
const { readFileSync } = await import('node:fs');
const preflight = JSON.parse(readFileSync('docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/preflight-before.json', 'utf8'));
const ids: string[] = preflight.cells.map((c: any) => c.current_review.id);

const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const res = await db.from('content_review_runs')
    .select('id, target_id, instructor_experience, instructor_experience_at, lease_token, lease_until, snapshot->criteria->>finalization, created_by')
    .in('id', ids);
  if (res.error) throw new Error(res.error.message);
  const keyOf = new Map(preflight.cells.map((c: any) => [c.current_review.id, c.key]));
  console.log(JSON.stringify({
    rows: res.data.length,
    with_instructor_experience: res.data.filter((r: any) => r.instructor_experience).length,
    with_lease_token: res.data.filter((r: any) => r.lease_token).length,
    finalization_criteria: [...new Set(res.data.map((r: any) => r.finalization))],
    created_by: [...new Set(res.data.map((r: any) => r.created_by))],
  }, null, 2));
  for (const r of res.data) {
    console.log(`${keyOf.get(r.id)} exp=${Boolean(r.instructor_experience)} lease=${Boolean(r.lease_token)} fin=${r.finalization}`);
  }
  // Show one concrete gate delta (w6-0: pass → pass) so "verdict equal but object differs" is on record.
  const w60 = preflight.cells.find((c: any) => c.key === 'w6-0');
  const one = await db.from('content_review_runs').select('generation_quality, prepared_finalization->quality_check').eq('id', w60.current_review.id).single();
  const sc = await db.from('scenarios').select('mission_content->quality_check').eq('scenario_id', w60.scenario_id).single();
  console.log('w6-0 review GQ quality_check:', JSON.stringify(one.data.generation_quality.quality_check).slice(0, 700));
  console.log('w6-0 live mission quality_check:', JSON.stringify(sc.data.quality_check).slice(0, 700));
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
