// Read-only: every R19 and R5 rule finding on the 20 active reviews, next to the item content the rule read.
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
  const reviewIds = data.rows.map((r: any) => r.active_review_id);
  const scenarioIds = data.rows.map((r: any) => r.scenario_id);
  const [reviews, scenarios] = await Promise.all([
    db.from('content_review_runs').select('id, target_id, rules').in('id', reviewIds),
    db.from('scenarios').select('scenario_id, speech_act, mode, mission_content').in('scenario_id', scenarioIds),
  ]);
  if (reviews.error || scenarios.error) throw new Error((reviews.error ?? scenarios.error).message);
  const keyOf = new Map(data.rows.map((r: any) => [r.scenario_id, r.key]));
  const missionOf = new Map((scenarios.data ?? []).map((s: any) => [s.scenario_id, s]));
  const len = (t: string) => [...(t ?? '')].length;

  const out: any[] = [];
  for (const review of reviews.data ?? []) {
    const key = keyOf.get(review.target_id);
    const s = missionOf.get(review.target_id);
    const m = s.mission_content;
    const withinCode = m.unit?.target_feature ? null : null;
    const items = (m.mpj_items ?? []).map((it: any) => ({
      id: it.id, type: it.type, item_focus: it.item_focus, pdr: it.pdr,
      source: it.source, target: it.target ?? null,
      accepted_band_codes: it.accepted_band_codes ?? null,
      candidates: it.candidates?.map((c: any, i: number) => ({ n: i + 1, text: c.text, len: len(c.text),
        bands: c.accepted_band_codes ?? [], role: c.comparison_role ?? null, note_ko: c.note_ko ?? c.annotation_ko ?? null })) ?? null,
      corrections: it.corrections?.map((c: any, i: number) => ({ n: i + 1, text: c.text, is_valid: c.is_valid })) ?? null,
    }));
    const findings = (review.rules?.findings ?? []).filter((f: any) => /^R19:|^R5:/.test(f.issue_ko))
      .map((f: any) => ({ id: f.id, rule: f.issue_ko.startsWith('R19') ? 'R19' : 'R5', issue_ko: f.issue_ko, needs_professor: f.needs_professor, severity: f.severity }));
    out.push({ key, scenario_id: review.target_id, speech_act: s.speech_act, mode: s.mode,
      target_feature: m.unit?.target_feature ?? null, within_code: m.unit?.within_band_code ?? m.contrast_plan?.within_band_code ?? null,
      production_pdr: m.production_task?.pdr ?? null, findings, items });
  }
  out.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  writeFileSync(`${dir}/r19-r5-findings.json`, `${JSON.stringify({ at: new Date().toISOString(), missions: out }, null, 2)}\n`);
  let r19 = 0, r5 = 0;
  for (const mmm of out) {
    const a = mmm.findings.filter((f: any) => f.rule === 'R19').length, b = mmm.findings.filter((f: any) => f.rule === 'R5').length;
    r19 += a; r5 += b;
    console.log(`${mmm.key.padEnd(6)} R19=${a} R5=${b} | ${mmm.findings.map((f: any) => f.issue_ko.replace(/^R\d+: /, '').slice(0, 60)).join(' | ')}`);
  }
  console.log(`\nR19 total=${r19} R5 total=${r5}\nwrote ${dir}/r19-r5-findings.json`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
