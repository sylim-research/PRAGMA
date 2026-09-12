// Read-only: the exact identifiers the professor approval screen needs, plus the current gate findings.
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
const after = JSON.parse(readFileSync(`${dir}/preflight-after.json`, 'utf8'));

const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const ids = after.cells.map((c: any) => c.scenario_id);
  const [lineage, scenarios] = await Promise.all([
    db.from('mission_lineage_versions').select('scenario_id, version_no, stage, mission_content_hash, created_at').in('scenario_id', ids),
    db.from('scenarios').select('scenario_id, speech_act, mode, learner_level, mission_status, mission_content').in('scenario_id', ids),
  ]);
  if (lineage.error || scenarios.error) throw new Error((lineage.error ?? scenarios.error).message);
  const byScenario = new Map<string, any>((scenarios.data ?? []).map((s: any) => [s.scenario_id, s]));

  const rows = after.cells.map((cell: any) => {
    const s = byScenario.get(cell.scenario_id);
    const versions = (lineage.data ?? []).filter((v: any) => v.scenario_id === cell.scenario_id)
      .sort((a: any, b: any) => a.version_no - b.version_no);
    const latest = versions[versions.length - 1];
    const quality = s?.mission_content?.quality_check;
    const findings = (quality?.findings ?? []).map((f: any, i: number) => ({
      id: `generation-${i + 1}`, severity: f.severity, code: f.code, where: f.where,
      note_ko: f.note_ko, evidence_excerpt: f.evidence_excerpt ?? null,
    }));
    return {
      key: cell.key, scenario_id: cell.scenario_id,
      speech_act: s?.speech_act, mode: s?.mode, learner_level: s?.learner_level, mission_status: s?.mission_status,
      revision: latest?.version_no ?? null, revision_stage: latest?.stage ?? null,
      lineage_versions: versions.length,
      mission_content_hash: s?.mission_content?.provenance?.mission_content_hash ?? null,
      review_content_hash: cell.current_review.content_hash,
      active_review_id: cell.current_review.id,
      gate_prompt_version: quality?.prompt_version ?? null,
      gate_verdict: quality?.verdict ?? null,
      gate_summary_ko: quality?.summary_ko ?? null,
      findings,
      fail_findings: findings.filter((f: any) => f.severity === 'fail'),
      claude_findings: cell.current_review.claude_findings,
      adjudication_decisions: cell.current_review.adjudication_decisions,
    };
  });
  writeFileSync(`${dir}/checklist-data.json`, `${JSON.stringify({ at: new Date().toISOString(), rows }, null, 2)}\n`);
  for (const r of rows) {
    console.log(`${r.key.padEnd(6)} ${r.scenario_id} rev=${r.revision}(${r.revision_stage}) mch=${r.mission_content_hash?.slice(0, 12)} rch=${r.review_content_hash.slice(0, 12)} review=${r.active_review_id} act=${r.speech_act}/${r.mode} gate=${r.gate_verdict} fails=${r.fail_findings.length}`);
  }
  console.log('\n=== FAIL FINDINGS (current gate) ===');
  for (const r of rows.filter((x: any) => x.fail_findings.length)) {
    for (const f of r.fail_findings) console.log(`${r.key} ${f.id} [${f.code}] @${f.where}\n   ${f.note_ko}\n   excerpt: ${f.evidence_excerpt ?? '-'}`);
  }
  console.log(`\nwrote ${dir}/checklist-data.json`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
