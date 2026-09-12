// Read-only preflight for the gate-provenance rebind (2026-09-12).
// Writes one JSON report; performs no writes and calls no model.
// Usage (from the worktree root):
//   node docs/research-trail/evidence/2026-09-11-reason-item-repair/tools/run-with-env.cjs \
//     docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/tools/preflight.ts <out.json>
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

const MANIFEST = 'docs/research-trail/evidence/2026-09-11-reason-item-repair/v3-manifest-after-c9.json';
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const rows: Array<{ key: string; scenario_id: string }> = manifest.rows;
const keyOf = new Map(rows.map((r) => [r.scenario_id, r.key]));
const ids = rows.map((r) => r.scenario_id);

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
  const scenarioResult = await db.from('scenarios')
    .select('scenario_id, mission_status, archived_at, updated_at, mission_content')
    .in('scenario_id', ids);
  if (scenarioResult.error) throw new Error(scenarioResult.error.message);
  const scenarios = new Map<string, any>((scenarioResult.data ?? []).map((s: any) => [s.scenario_id, s]));

  const reviewResult = await db.from('content_review_runs')
    .select('id, target_id, week_no, kind, criteria_version, approval_policy, source_hash, content_hash, rules, generation_quality, openai_review, claude_review, adjudication, prepared_finalization, professor_decisions, professor_decisions_at, approved_at, approved_by, professor_note, openai_fail_override, independent_review_requested, running_stage, last_error, created_at')
    .eq('kind', 'mission').in('target_id', ids).order('created_at');
  if (reviewResult.error) throw new Error(reviewResult.error.message);
  const reviews: any[] = reviewResult.data ?? [];

  const report: any[] = [];
  for (const { key, scenario_id } of rows) {
    const scenario = scenarios.get(scenario_id);
    const mission = scenario?.mission_content ?? null;
    const liveSource = await db.rpc('get_content_review_source', { p_kind: 'mission', p_target_id: scenario_id, p_week_no: 0 });
    if (liveSource.error) throw new Error(`${key}: ${liveSource.error.message}`);
    const liveSourceHash: string = liveSource.data.source_hash;
    const liveQuality = mission?.quality_check ?? null;
    const liveMissionHash: string | null = mission?.provenance?.mission_content_hash ?? null;

    const mine = reviews.filter((r) => r.target_id === scenario_id);
    const supported = mine.filter((r) => ['content_review_v2', 'content_review_v3'].includes(r.criteria_version));
    // Operational "current" row: the newest supported-criteria row on the live source hash.
    const current = [...supported].filter((r) => r.source_hash === liveSourceHash)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;

    report.push({
      key,
      scenario_id,
      mission_status: scenario?.mission_status ?? null,
      archived_at: scenario?.archived_at ?? null,
      live_source_hash: liveSourceHash,
      live_mission_content_hash: liveMissionHash,
      live_quality_prompt_version: liveQuality?.prompt_version ?? null,
      live_quality_verdict: liveQuality?.verdict ?? null,
      live_quality_findings: Array.isArray(liveQuality?.findings) ? liveQuality.findings.length : null,
      live_quality_fail_findings: Array.isArray(liveQuality?.findings)
        ? liveQuality.findings.filter((f: any) => f.severity === 'fail').length : null,
      review_rows_total: mine.length,
      review_rows_by_version: Object.fromEntries(
        [...new Set(mine.map((r) => r.criteria_version))].map((v) => [v, mine.filter((r) => r.criteria_version === v).length]),
      ),
      current_review: current && {
        id: current.id,
        criteria_version: current.criteria_version,
        approval_policy: current.approval_policy,
        created_at: current.created_at,
        source_hash_matches: current.source_hash === liveSourceHash,
        content_hash: current.content_hash,
        rules_verdict: current.rules?.verdict ?? null,
        gq_prompt_version: current.generation_quality?.quality_check?.prompt_version ?? null,
        gq_verdict: current.generation_quality?.quality_check?.verdict ?? null,
        gq_mission_content_hash: current.generation_quality?.mission_content_hash ?? null,
        gq_matches_live_quality: same(current.generation_quality?.quality_check, liveQuality),
        gq_hash_matches_live: current.generation_quality?.mission_content_hash === liveMissionHash,
        prepared_present: Boolean(current.prepared_finalization),
        prepared_quality_prompt_version: current.prepared_finalization?.quality_check?.prompt_version ?? null,
        prepared_quality_verdict: current.prepared_finalization?.quality_check?.verdict ?? null,
        prepared_quality_matches_live: same(current.prepared_finalization?.quality_check, liveQuality),
        prepared_instructional_matches_live: (() => {
          const strip = (m: any) => {
            if (!m || typeof m !== 'object') return null;
            const copy = { ...m };
            for (const k of ['provenance', 'quality_check', 'hsk_lexical_audit', 'authoring', 'item_lineage']) delete copy[k];
            return copy;
          };
          return same(strip(current.prepared_finalization), strip(mission));
        })(),
        prepared_mission_content_hash: current.prepared_finalization?.provenance?.mission_content_hash ?? null,
        openai_review: Boolean(current.openai_review),
        claude_findings: current.claude_review ? (current.claude_review.result?.findings?.length ?? 0) : null,
        adjudication_decisions: current.adjudication ? (current.adjudication.result?.decisions?.length ?? 0) : null,
        independent_review_requested: current.independent_review_requested,
        professor_decision_count: Array.isArray(current.professor_decisions) ? current.professor_decisions.length : null,
        professor_decisions_at: current.professor_decisions_at,
        professor_note: current.professor_note,
        openai_fail_override: current.openai_fail_override,
        approved_at: current.approved_at,
        approved_by: current.approved_by,
        running_stage: current.running_stage,
        last_error: current.last_error,
      },
      other_rows: mine.filter((r) => r.id !== current?.id).map((r) => ({
        id: r.id, criteria_version: r.criteria_version, created_at: r.created_at,
        source_hash_matches: r.source_hash === liveSourceHash, content_hash: r.content_hash,
        approved_at: r.approved_at, professor_decision_count: Array.isArray(r.professor_decisions) ? r.professor_decisions.length : null,
      })),
    });
  }

  const needsRebind = report.filter((r) => r.current_review && !r.current_review.gq_matches_live_quality);
  const blockers = report.filter((r) => r.current_review
    && ((r.current_review.professor_decision_count ?? 0) > 0 || r.current_review.approved_at || r.current_review.openai_fail_override));
  const summary = {
    at: new Date().toISOString(),
    cells: report.length,
    with_current_review: report.filter((r) => r.current_review).length,
    gq_matches: report.filter((r) => r.current_review?.gq_matches_live_quality).length,
    gq_mismatch: needsRebind.length,
    gq_mismatch_keys: needsRebind.map((r) => r.key),
    prepared_quality_mismatch_keys: report.filter((r) => r.current_review && !r.current_review.prepared_quality_matches_live).map((r) => r.key),
    prepared_instructional_mismatch_keys: report.filter((r) => r.current_review && !r.current_review.prepared_instructional_matches_live).map((r) => r.key),
    source_hash_mismatch_keys: report.filter((r) => r.current_review && !r.current_review.source_hash_matches).map((r) => r.key),
    approved_keys: report.filter((r) => r.current_review?.approved_at).map((r) => r.key),
    professor_decision_keys: report.filter((r) => (r.current_review?.professor_decision_count ?? 0) > 0).map((r) => r.key),
    override_keys: report.filter((r) => r.current_review?.openai_fail_override).map((r) => r.key),
    blocker_keys: blockers.map((r) => r.key),
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const r of report) {
    const c = r.current_review;
    console.log(`${r.key.padEnd(6)} ${r.scenario_id.slice(0, 8)} status=${r.mission_status} live_gate=${r.live_quality_prompt_version}/${r.live_quality_verdict}`
      + ` | review=${c ? c.id.slice(0, 8) : '-'} ${c?.criteria_version ?? '-'} rules=${c?.rules_verdict ?? '-'}`
      + ` gq=${c?.gq_prompt_version ?? '-'}/${c?.gq_verdict ?? '-'} match=${c?.gq_matches_live_quality}`
      + ` prep=${c?.prepared_quality_prompt_version ?? '-'} prep_match=${c?.prepared_quality_matches_live}`
      + ` decisions=${c?.professor_decision_count ?? '-'} approved=${Boolean(c?.approved_at)}`);
  }
  const out = process.argv[2] ?? 'docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/preflight.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ summary, cells: report }, null, 2)}\n`);
  console.log(`\nwrote ${out}`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
