// Operational gate-provenance rebind (2026-09-12). One RPC per cell, no model call, no content write,
// no approval. Each cell is re-checked immediately before its call and skipped when anything differs.
// Usage (from the worktree root):
//   node docs/research-trail/evidence/2026-09-11-reason-item-repair/tools/run-with-env.cjs \
//     docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/tools/rebind.ts [--apply] <out.json>
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
const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
const { dirname } = await import('node:path');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const out = args.find((a) => !a.startsWith('--')) ?? 'docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/rebind-result.json';
const before = JSON.parse(readFileSync('docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/preflight-before.json', 'utf8'));

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort()
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
};
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (signInError) throw new Error(signInError.message);

try {
  const db = supabase as unknown as { from: (t: string) => any; rpc: (n: string, a: Record<string, unknown>) => any };
  const results: any[] = [];
  for (const cell of before.cells) {
    const expected = cell.current_review;
    const record: any = { key: cell.key, scenario_id: cell.scenario_id, old_review_id: expected.id };

    // Immediate preflight: read the live row and mission again, never trusting the earlier snapshot.
    const [row, scenario] = await Promise.all([
      db.from('content_review_runs')
        .select('id, target_id, criteria_version, approval_policy, source_hash, content_hash, generation_quality, prepared_finalization, professor_decisions, professor_decisions_at, professor_note, openai_fail_override, approved_at, instructor_experience, running_stage, superseded_by')
        .eq('id', expected.id).maybeSingle(),
      db.from('scenarios').select('mission_status, mission_content').eq('scenario_id', cell.scenario_id).maybeSingle(),
    ]);
    if (row.error || scenario.error) throw new Error(`${cell.key}: ${(row.error ?? scenario.error).message}`);
    const live = row.data;
    const mission = scenario.data?.mission_content;
    const liveQuality = mission?.quality_check ?? null;
    const liveSource = await db.rpc('get_content_review_source', { p_kind: 'mission', p_target_id: cell.scenario_id, p_week_no: 0 });
    if (liveSource.error) throw new Error(`${cell.key}: ${liveSource.error.message}`);

    const skip: string[] = [];
    if (!live) skip.push('review row missing');
    else {
      if (live.superseded_by) skip.push('already superseded');
      if (live.content_hash !== expected.content_hash) skip.push('content hash moved');
      if (live.source_hash !== liveSource.data.source_hash) skip.push('source hash moved');
      if (live.approved_at) skip.push('already approved');
      if ((live.professor_decisions?.length ?? 0) > 0 || live.professor_decisions_at) skip.push('professor decision recorded');
      if (live.professor_note || live.openai_fail_override) skip.push('professor note or override recorded');
      if (live.instructor_experience) skip.push('instructor experience recorded');
      if (live.running_stage) skip.push('a stage is running');
      if (scenario.data?.mission_status !== 'generated') skip.push(`mission status ${scenario.data?.mission_status}`);
    }
    record.skip_reasons = skip;
    record.already_current = Boolean(live) && same(live.generation_quality?.quality_check, liveQuality)
      && same(live.prepared_finalization?.quality_check, liveQuality);

    if (skip.length) { record.action = 'blocked'; results.push(record); continue; }
    if (record.already_current) { record.action = 'no_change'; record.new_review_id = live.id; results.push(record); continue; }
    if (!apply) { record.action = 'would_rebind'; results.push(record); continue; }

    const call = await db.rpc('rebind_content_review_gate', { p_review_id: live.id, p_content_hash: live.content_hash });
    if (call.error) { record.action = 'error'; record.error = call.error.message; results.push(record); continue; }
    record.action = 'rebound';
    record.new_review_id = call.data;
    results.push(record);
  }

  const tally = (action: string) => results.filter((r) => r.action === action).length;
  const summary = {
    at: new Date().toISOString(), applied: apply, cells: results.length,
    rebound: tally('rebound'), no_change: tally('no_change'), would_rebind: tally('would_rebind'),
    blocked: tally('blocked'), errors: tally('error'),
    blocked_detail: results.filter((r) => r.action === 'blocked').map((r) => ({ key: r.key, reasons: r.skip_reasons })),
    error_detail: results.filter((r) => r.action === 'error').map((r) => ({ key: r.key, error: r.error })),
    model_calls: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const r of results) console.log(`${r.key.padEnd(6)} ${r.action.padEnd(13)} ${r.old_review_id.slice(0, 8)} → ${(r.new_review_id ?? '-').slice(0, 8)}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ summary, cells: results }, null, 2)}\n`);
  console.log(`\nwrote ${out}`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
