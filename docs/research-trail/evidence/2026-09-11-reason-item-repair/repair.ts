// Targeted Reason-item repair for the fourteen existing course missions. Run from the worktree root
// with the admin process env, ONLY after the reason-item contract is deployed from main lineage.
//   audit  — re-runs the deployed mission quality check (new ⑨) and keeps the findings that point at
//            the Reason item; nothing is written to the DB.
//   repair — for missions whose audit flagged the Reason item: asks the deployed mission_repair
//            action for item-level operations using only those findings, takes the patched Reason
//            item, and saves it through reviseMissionDraft(core, …, 'ai') — which re-runs the rule
//            check and the quality check and stores an append-only revision with a new content hash.
//            No direct mission_content overwrite. Missions with no safe operations are listed as
//            needs_regeneration for the supersede → promoteCore path (run separately, explicitly).
//   apply  — hand-written replacement distractors (a replacements JSON, default human-replacements.json;
//            argv[4] = file name, argv[5] = output suffix, default "apply") through the same revision path.
//   recheck — re-runs the deployed quality check on the CURRENT Reason item without changing it, through
//            reviseMissionDraft, so the new verdict is stored as a new append-only lineage version (same
//            content hash, new ai_quality_result). Earlier versions and their verdicts stay in the ledger.
// Existing *-audit.json / *-repair.json / *-apply*.json / *-recheck.json results are preserved and never overwritten.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote, { getTargetFeature, DEFAULT_FEATURE_BY_ACT }, { SPEECH_ACT_UI }, { QualityCheckSchema }] = await Promise.all([
  import('../../../../src/integrations/supabase/client'),
  import('../../../../src/lib/pragma/promoteMission'),
  import('../../../../src/lib/pragma/targetFeatures'),
  import('../../../../src/lib/pragma/enums'),
  import('../../../../src/lib/pragma/missionSchema'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, '../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const earlier = resolve(here, '../2026-09-10-local-core-revisions');
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
const db = supabase as unknown as { from: (table: string) => any };

/** The fourteen missions that exist today. Keys not yet promoted (w2-1, w3-0, w4-0, w5-1, w13-0) are handled by promotion, not here. */
const TARGETS: Array<{ key: string; scenario_id: string }> = [
  { key: 'w2-0', scenario_id: readJson(resolve(earlier, 'w2-0-saved.json')).new_scenario_id },
  { key: 'w9-1', scenario_id: readJson(resolve(earlier, 'w9-1-saved.json')).new_scenario_id },
  ...['w3-1', 'w4-1', 'w5-0', 'w6-0', 'w9-0', 'w10-0', 'w10-1', 'w11-0', 'w11-1', 'w12-0', 'w12-1', 'w13-1',
    // Promoted on 2026-09-11 under the old shared rule; only their flagged Reason distractors are repaired
    // (w3-0·w5-1 critic-flagged false premises; w2-1·w4-0 passed the old critic but the human eye check found false premises).
    'w3-0', 'w5-1', 'w2-1', 'w4-0',
    // Generated under the aligned rule (v124); the eye check still found one false-premise distractor.
    'w6-1', 'w13-0']
    .map(key => ({ key, scenario_id: readJson(resolve(runDir, `${key}-core.json`)).result.scenarioId as string })),
];
const mode = process.argv[2];
const selected = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : TARGETS.map(t => t.key);
const replacementsFile = process.argv[4] ?? 'human-replacements.json';
const applySuffix = process.argv[5] ?? 'apply';
const isReasonFinding = (mission: any, where: string) => {
  const match = /^mpj_items\[(\d+)\]/.exec(where ?? '');
  if (!match) return false;
  const item = mission?.mpj_items?.[Number(match[1])];
  return item?.type === 'reason';
};

async function loadRow(scenarioId: string) {
  const { data, error } = await db.from('scenarios')
    .select('scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, language_direction, generation_run_id, generation_item_key, mission_status, core_content, mission_content')
    .eq('scenario_id', scenarioId).single();
  if (error) throw new Error(`${scenarioId}: ${error.message}`);
  return data;
}

async function qualityCheck(row: any) {
  const featureCode = DEFAULT_FEATURE_BY_ACT[row.speech_act as keyof typeof DEFAULT_FEATURE_BY_ACT];
  const feature = featureCode ? getTargetFeature(featureCode) : undefined;
  if (!feature) throw new Error(`${row.scenario_id}: no target feature`);
  const direction = row.core_content?.direction === 'zh_ko' || row.language_direction === 'zh_ko' ? 'zh_ko' : 'ko_zh';
  const zh = direction === 'zh_ko';
  const { data, error } = await supabase.functions.invoke('generate-scenario', { body: {
    action: 'quality_check',
    telemetry: { scenario_id: row.scenario_id, generation_run_id: row.generation_run_id ?? null,
      generation_item_key: `reason-reaudit:${row.generation_item_key ?? row.scenario_id}`, invocation_attempt: 1 },
    quality: {
      mission_content: row.mission_content,
      feature: {
        code: feature.code, learner_label: feature.learner_label,
        band_codes: feature.band_schema.map((b: any) => b.code),
        band_schema: feature.band_schema.map((b: any) => ({ code: b.code, label_ko: b.label_ko })),
        within_band_code: feature.within_band_code,
        operational_definition: zh && feature.operational_definition_zh_ko ? feature.operational_definition_zh_ko : feature.operational_definition,
        excluded_confounds: zh && feature.excluded_confounds_zh_ko ? feature.excluded_confounds_zh_ko : feature.excluded_confounds,
        counter_rule_note: zh && feature.counter_rule_note_zh_ko ? feature.counter_rule_note_zh_ko : feature.counter_rule_note,
      },
      direction, speech_act: row.speech_act,
    },
  } });
  if (error) throw new Error(`quality_check: ${error.message ?? String(error)}`);
  const parsed = QualityCheckSchema.safeParse((data as any)?.quality_check);
  if (!parsed.success) throw new Error(`quality_check response: ${parsed.error.message}`);
  return { quality: parsed.data, feature, direction };
}

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (authError) throw new Error(authError.message);
try {
  for (const target of TARGETS.filter(t => selected.includes(t.key))) {
    if (mode === 'audit') {
      const out = resolve(here, `${target.key}-audit.json`);
      if (existsSync(out)) { const p = readJson(out); console.log(JSON.stringify({ key: target.key, preserved: true, verdict: p.quality.verdict, reason_findings: p.reason_findings.length })); continue; }
      const row = await loadRow(target.scenario_id);
      const { quality } = await qualityCheck(row);
      const reasonFindings = quality.findings.filter(f => isReasonFinding(row.mission_content, f.where));
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, scenario_id: target.scenario_id,
        prompt_version: quality.prompt_version, verdict: quality.verdict, reason_findings: reasonFindings,
        other_findings: quality.findings.filter(f => !isReasonFinding(row.mission_content, f.where)), quality,
        scope: 'Automated re-audit only; no DB write.' }, null, 2) + '\n');
      console.log(JSON.stringify({ key: target.key, verdict: quality.verdict, reason_findings: reasonFindings.map(f => `${f.severity}:${f.code}@${f.where}`) }));
      continue;
    }
    if (mode === 'recheck') {
      // argv[4] = output suffix (default "recheck"); a second round writes e.g. *-recheck2.json and keeps the first.
      const out = resolve(here, `${target.key}-${process.argv[4] ?? 'recheck'}.json`);
      if (existsSync(out)) { console.log(JSON.stringify({ key: target.key, preserved: true })); continue; }
      const row = await loadRow(target.scenario_id);
      if (row.mission_status !== 'generated') { console.log(JSON.stringify({ key: target.key, skipped: `mission_status=${row.mission_status}` })); continue; }
      const reasonIndex = row.mission_content.mpj_items.findIndex((it: any) => it.type === 'reason');
      const item = structuredClone(row.mission_content.mpj_items[reasonIndex]);
      const previous = row.mission_content.quality_check ?? null;
      const result = await promote.reviseMissionDraft(row, { itemBlocks: [{ itemIndex: reasonIndex, item }] }, 'ai');
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, scenario_id: target.scenario_id,
        outcome: result.ok ? 'rechecked' : 'recheck_rejected', item_unchanged: true, reason_item: item,
        previous_quality: previous ? { verdict: previous.verdict, prompt_version: previous.prompt_version, checked_at: previous.checked_at,
          reason_findings: (previous.findings ?? []).filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? '')) } : null,
        result: { ok: result.ok, error: result.error, quality: result.quality, ruleResult: result.ruleResult, violations: result.violations },
        scope: 'Re-check only under the aligned shared rule; the Reason item is unchanged. Stored as a new lineage version.' }, null, 2) + '\n');
      console.log(JSON.stringify({ key: target.key, outcome: result.ok ? 'rechecked' : 'recheck_rejected', before: previous?.verdict ?? null, after: result.quality?.verdict ?? null,
        reason_findings: result.quality?.findings?.filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? '')).map((f: any) => `${f.severity}@${f.where}`), error: result.error }));
      continue;
    }
    if (mode === 'apply') {
      // Attempt 2+: hand-written replacement distractors through the same revision path.
      const out = resolve(here, `${target.key}-${applySuffix}.json`);
      if (existsSync(out)) { console.log(JSON.stringify({ key: target.key, preserved: true })); continue; }
      const repl = readJson(resolve(here, replacementsFile)).replacements?.[target.key];
      if (!repl) { console.log(JSON.stringify({ key: target.key, skipped: 'no replacements' })); continue; }
      const row = await loadRow(target.scenario_id);
      if (row.mission_status !== 'generated') { console.log(JSON.stringify({ key: target.key, skipped: `mission_status=${row.mission_status}` })); continue; }
      const reasonIndex = row.mission_content.mpj_items.findIndex((it: any) => it.type === 'reason');
      const before = row.mission_content.mpj_items[reasonIndex];
      const item = structuredClone(before);
      const missing: string[] = [];
      for (const [id, edit] of Object.entries(repl) as Array<[string, any]>) {
        const reason = item.reasons.find((r: any) => r.id === id);
        if (!reason) { missing.push(id); continue; }
        reason.text_ko = edit.text_ko;
        if (edit.kind) reason.kind = edit.kind;
      }
      if (missing.length) throw new Error(`${target.key}: reason ids not found: ${missing.join(',')}`);
      const result = await promote.reviseMissionDraft(row, { itemBlocks: [{ itemIndex: reasonIndex, item }] }, 'ai');
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, scenario_id: target.scenario_id,
        outcome: result.ok ? 'revised' : 'revision_rejected', replaced: Object.keys(repl), before, after: item,
        result: { ok: result.ok, error: result.error, quality: result.quality, ruleResult: result.ruleResult, violations: result.violations },
        scope: 'Human-authored distractor replacement through the existing AI-revision path; not instructor approval.' }, null, 2) + '\n');
      console.log(JSON.stringify({ key: target.key, outcome: result.ok ? 'revised' : 'revision_rejected', quality: result.quality?.verdict,
        reason_findings: result.quality?.findings?.filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? '')).map((f: any) => `${f.severity}@${f.where}`), error: result.error }));
      continue;
    }
    if (mode !== 'repair') throw new Error('Choose audit, repair, apply or recheck');
    const out = resolve(here, `${target.key}-repair.json`);
    if (existsSync(out)) { console.log(JSON.stringify({ key: target.key, preserved: true })); continue; }
    const audit = readJson(resolve(here, `${target.key}-audit.json`));
    // Researcher-accepted human re-audit findings are merged in; the automated critic missed several false premises.
    const humanPath = resolve(here, 'human-findings.json');
    const human: any[] = existsSync(humanPath) ? (readJson(humanPath).findings?.[target.key] ?? []) : [];
    const seenWhere = new Set<string>();
    // Human findings first so a researcher judgment (e.g. keep-but-reword) wins over the critic's verdict on the same option.
    const findings = [...human, ...audit.reason_findings].filter(f => { if (seenWhere.has(f.where)) return false; seenWhere.add(f.where); return true; });
    if (!findings.length) { console.log(JSON.stringify({ key: target.key, skipped: 'no reason findings' })); continue; }
    audit.reason_findings = findings;
    const row = await loadRow(target.scenario_id);
    if (row.mission_status !== 'generated') { console.log(JSON.stringify({ key: target.key, skipped: `mission_status=${row.mission_status}` })); continue; }
    const featureCode = DEFAULT_FEATURE_BY_ACT[row.speech_act as keyof typeof DEFAULT_FEATURE_BY_ACT];
    const feature = getTargetFeature(featureCode)!;
    const direction = row.core_content?.direction === 'zh_ko' || row.language_direction === 'zh_ko' ? 'zh_ko' : 'ko_zh';
    // Ask for item-level operations using only the Reason-item findings (targeted repair).
    const { data, error } = await supabase.functions.invoke('generate-scenario', { body: {
      action: 'mission_repair',
      telemetry: { scenario_id: row.scenario_id, generation_run_id: row.generation_run_id ?? null,
        generation_item_key: `reason-repair:${row.generation_item_key ?? row.scenario_id}`, invocation_attempt: 1 },
      mission_repair: { mission_content: row.mission_content, findings: audit.reason_findings,
        feature: promote.featureForGen(feature, direction), direction, speech_act: row.speech_act, speech_act_ko: SPEECH_ACT_UI[row.speech_act as keyof typeof SPEECH_ACT_UI] },
    } });
    if (error) throw new Error(`mission_repair: ${error.message ?? String(error)}`);
    const operations = Array.isArray((data as any)?.operations) ? (data as any).operations : [];
    const reasonIndex = row.mission_content.mpj_items.findIndex((it: any) => it.type === 'reason');
    const patched = operations.length ? promote.applyMissionRepairOperations(row.mission_content, operations) : null;
    const patchedItem = patched?.mpj_items?.[reasonIndex];
    if (!patchedItem || JSON.stringify(patchedItem) === JSON.stringify(row.mission_content.mpj_items[reasonIndex])) {
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, scenario_id: target.scenario_id,
        outcome: 'needs_regeneration', operations, note: 'Repair returned no change for the Reason item; use supersede → promoteCore explicitly.' }, null, 2) + '\n');
      console.log(JSON.stringify({ key: target.key, outcome: 'needs_regeneration' }));
      continue;
    }
    // Only the Reason item block changes; reviseMissionDraft re-checks rules + quality and stores an append-only revision.
    const result = await promote.reviseMissionDraft(row, { itemBlocks: [{ itemIndex: reasonIndex, item: patchedItem }] }, 'ai');
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, scenario_id: target.scenario_id,
      outcome: result.ok ? 'revised' : 'revision_rejected', before: row.mission_content.mpj_items[reasonIndex], after: patchedItem,
      operations, result: { ok: result.ok, error: result.error, quality: result.quality, ruleResult: result.ruleResult },
      scope: 'AI editorial revision through the existing revision path; not instructor approval.' }, null, 2) + '\n');
    console.log(JSON.stringify({ key: target.key, outcome: result.ok ? 'revised' : 'revision_rejected', quality: result.quality?.verdict, error: result.error }));
  }
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
