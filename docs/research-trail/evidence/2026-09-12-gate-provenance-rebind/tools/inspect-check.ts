// Read-only end-to-end check: the deployed content-review `inspect` resolves exactly one active review
// per cell and reports the next step. No write, no model call.
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
const { nextReviewStage } = await import('../../../../../supabase/functions/_shared/contentReview.ts');
const { readFileSync, writeFileSync } = await import('node:fs');
const dir = 'docs/research-trail/evidence/2026-09-12-gate-provenance-rebind';
const result = JSON.parse(readFileSync(`${dir}/rebind-result.json`, 'utf8'));

const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const rows: any[] = [];
  for (const cell of result.cells) {
    const { data, error: callError } = await supabase.functions.invoke('content-review', {
      body: { action: 'inspect', target: { kind: 'mission', targetId: cell.scenario_id } },
    });
    if (callError || data?.error) { rows.push({ key: cell.key, error: data?.error ?? callError?.message }); continue; }
    rows.push({
      key: cell.key,
      run_id: data.run?.id ?? null,
      matches_expected_active: (data.run?.id ?? null) === (cell.new_review_id ?? cell.old_review_id),
      criteria_version: data.run?.criteria_version ?? null,
      gate_prompt_version: data.run?.generation_quality?.quality_check?.prompt_version ?? null,
      prepared: Boolean(data.run?.prepared_finalization),
      next: nextReviewStage(data.run ?? null),
      history_rows: data.history?.length ?? 0,
      history_superseded: (data.history ?? []).filter((h: any) => h.superseded_by).length,
    });
  }
  const summary = {
    at: new Date().toISOString(), cells: rows.length,
    errors: rows.filter((r) => r.error).length,
    active_row_resolved: rows.filter((r) => r.matches_expected_active).length,
    next_professor: rows.filter((r) => r.next === 'professor').length,
    on_current_gate: rows.filter((r) => r.gate_prompt_version === 'quality_v24_reason_facts_severity').length,
    model_calls: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const r of rows) console.log(`${r.key.padEnd(6)} run=${(r.run_id ?? '-').slice(0, 8)} active_ok=${r.matches_expected_active} gate=${r.gate_prompt_version?.replace('quality_', '') ?? '-'} prepared=${r.prepared} next=${r.next} history=${r.history_rows}(superseded ${r.history_superseded})${r.error ? ` ERROR ${r.error}` : ''}`);
  writeFileSync(`${dir}/inspect-check.json`, `${JSON.stringify({ summary, cells: rows }, null, 2)}\n`);
  console.log(`\nwrote ${dir}/inspect-check.json`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
