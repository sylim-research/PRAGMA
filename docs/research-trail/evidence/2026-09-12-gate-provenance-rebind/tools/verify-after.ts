// Read-only post-rebind verification: old row preserved, provenance linked, semantic evidence carried,
// and the professor judgement now required on the current gate.
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
const result = JSON.parse(readFileSync(`${dir}/rebind-result.json`, 'utf8'));

const canonical = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v as any).sort().filter((k) => (v as any)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`;
};
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const ids = result.cells.flatMap((c: any) => [c.old_review_id, c.new_review_id]).filter(Boolean);
  const res = await db.from('content_review_runs')
    .select('id, target_id, criteria_version, source_hash, content_hash, snapshot, rules, generation_quality, openai_review, claude_review, adjudication, prepared_finalization, professor_decisions, approved_at, independent_review_requested, superseded_by, rebound_from, rebound_at, rebound_by, created_at')
    .in('id', ids);
  if (res.error) throw new Error(res.error.message);
  const byId = new Map<string, any>(res.data.map((r: any) => [r.id, r]));

  const rows: any[] = [];
  for (const cell of result.cells) {
    const old = byId.get(cell.old_review_id);
    const next = cell.new_review_id ? byId.get(cell.new_review_id) : null;
    const rebound = cell.action === 'rebound';
    const carried = rebound ? ['snapshot', 'rules', 'openai_review', 'claude_review', 'adjudication',
      'source_hash', 'content_hash', 'criteria_version', 'independent_review_requested']
      .every((k) => same(old[k], next[k])) : null;
    const gateFindings = (next ?? old).generation_quality?.quality_check?.findings ?? [];
    rows.push({
      key: cell.key, action: cell.action,
      old_review_id: cell.old_review_id, new_review_id: cell.new_review_id ?? null,
      old_preserved: Boolean(old),
      old_gate_prompt_version: old?.generation_quality?.quality_check?.prompt_version ?? null,
      old_prepared_prompt_version: old?.prepared_finalization?.quality_check?.prompt_version ?? null,
      old_superseded_by: old?.superseded_by ?? null,
      old_approved_at: old?.approved_at ?? null,
      new_rebound_from: next?.rebound_from ?? null,
      new_rebound_at: next?.rebound_at ?? null,
      new_gate_prompt_version: next?.generation_quality?.quality_check?.prompt_version ?? null,
      new_prepared_prompt_version: next?.prepared_finalization?.quality_check?.prompt_version ?? null,
      semantic_evidence_carried: carried,
      claude_findings: (next ?? old)?.claude_review?.result?.findings?.length ?? null,
      adjudication_decisions: (next ?? old)?.adjudication?.result?.decisions?.length ?? null,
      current_gate_verdict: (next ?? old)?.generation_quality?.quality_check?.verdict ?? null,
      override_required_findings: gateFindings.filter((f: any) => f.severity === 'fail')
        .map((f: any, i: number) => ({ id: `generation-${gateFindings.indexOf(f) + 1}`, code: f.code, where: f.where, note_ko: f.note_ko })),
    });
  }
  const summary = {
    at: new Date().toISOString(),
    cells: rows.length,
    rebound: rows.filter((r) => r.action === 'rebound').length,
    no_change: rows.filter((r) => r.action === 'no_change').length,
    old_rows_preserved: rows.filter((r) => r.old_preserved).length,
    old_rows_still_v22: rows.filter((r) => r.old_gate_prompt_version === 'quality_v22_observed_pdr_scene').length,
    old_rows_approved: rows.filter((r) => r.old_approved_at).length,
    provenance_linked: rows.filter((r) => r.action === 'rebound' && r.old_superseded_by === r.new_review_id && r.new_rebound_from === r.old_review_id).length,
    semantic_evidence_carried: rows.filter((r) => r.semantic_evidence_carried === true).length,
    cells_needing_override: rows.filter((r) => r.override_required_findings.length > 0)
      .map((r) => ({ key: r.key, findings: r.override_required_findings.map((f: any) => f.id) })),
    total_override_findings: rows.reduce((n, r) => n + r.override_required_findings.length, 0),
    model_calls: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const r of rows) {
    console.log(`${r.key.padEnd(6)} ${r.action.padEnd(10)} old=${r.old_review_id.slice(0, 8)}(${r.old_gate_prompt_version?.replace('quality_', '')}) `
      + `new=${(r.new_review_id ?? '-').slice(0, 8)}(${r.new_gate_prompt_version?.replace('quality_', '') ?? '-'}) `
      + `carried=${r.semantic_evidence_carried} claude=${r.claude_findings} adj=${r.adjudication_decisions} `
      + `gate=${r.current_gate_verdict} override=${r.override_required_findings.length}`);
  }
  writeFileSync(`${dir}/verify-after.json`, `${JSON.stringify({ summary, cells: rows }, null, 2)}\n`);
  console.log(`\nwrote ${dir}/verify-after.json`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
