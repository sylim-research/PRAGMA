// Final three content fixes (researcher ruling 2026-09-11 night, on the C7 official-review findings):
//   w12-0  mission  — the anchor's added blame sentence («…问题都在你这边») and MPJ5 candidate 4's added
//                     «这是一次严重的通知失误» are removed; over_attributed is now carried by emphasis only
//                     («都是因为你…才» / «害得»), no proposition beyond the source. Same type in MPJ3/4
//                     correction 3 («根本没把我的预约当回事») cleaned the same way. Reason r1 re-cut so it no
//                     longer overlaps the primary.
//   w5-1   core     — pdr.r mid → high (scene unchanged). Rule cascade (R23/R2/R3/R4/R27 are fail-level) moves
//                     production_task and MPJ1–4 labels to high; MPJ5 stays low (one-axis contrast). One phrase
//                     in MPJ2's explanation that names the burden level is aligned.
//   w13-1  mission  — MPJ5 explanation quotes the current candidates («旁边那支备用笔»).
// Same mechanics as c7-fix/content-fix.ts: mission-level edits through reviseMissionDraft; the core-level edit
// as a NEW draft core row (semantic gate → save_generated_core → mission transplant → reviseMissionDraft).
// Origin rows and their review runs are never modified. Results: <key>-fix.json.
//   node run-with-env.cjs .../c8-fix/content-fix.ts mission w12-0,w13-1
//   node run-with-env.cjs .../c8-fix/content-fix.ts core w5-1
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote, { checkCoreSemanticFit }, { coreContentForHash, normalizeCore }] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/promoteMission'),
  import('../../../../../src/lib/pragma/coreBatchRun'),
  import('../../../../../src/lib/pragma/coreSchema'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, '../../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const plan = JSON.parse(readFileSync(resolve(here, '../../../../../.tmp/scene-grounding/plan.json'), 'utf8'));
const RUN_ID = 'scene_grounding_course_20260910';
function hashString(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>).call(supabase, fn, args);
const db = supabase as unknown as { from: (t: string) => any };

// Current canonical rows (after C7): w12-0 is the corrected core row 97c4834a.
const TARGETS: Record<string, string> = {
  'w12-0': '97c4834a-ee4a-4691-a042-0255c8fadc4b', 'w5-1': '793a1576-55c4-4790-9791-621685a9b3bb', 'w13-1': '26412ba9-8942-4cba-a7c8-12e744f3891a',
};
type Change = { path: string; before: unknown; after: unknown };
const changes: Change[] = [];
function rep(obj: any, field: string, from: string, to: string, path: string) {
  const cur = obj[field]; if (typeof cur !== 'string' || !cur.includes(from)) throw new Error(`${path}.${field}: expected «${from}»`);
  const next = cur.split(from).join(to); changes.push({ path: `${path}.${field}`, before: cur, after: next }); obj[field] = next;
}
function set(obj: any, field: string, to: unknown, path: string) { changes.push({ path: `${path}.${field}`, before: obj[field], after: to }); obj[field] = to; }

/** Core-level edits (new core row). */
const CORE_FIXES: Record<string, (core: any) => void> = {
  'w5-1': (c) => { if (c.pdr.r !== 'mid') throw new Error('w5-1 core pdr.r expected mid'); set(c.pdr, 'r', 'high', 'core.pdr'); },
};
/** Semantic-gate cell overrides: the researcher re-ruled the cell's burden, so the gate is asked for high. */
const CELL_OVERRIDES: Record<string, Record<string, unknown>> = { 'w5-1': { pdr_burden: 'high' } };
/** Copies the core-level changes into the production_task copy of the mission (transplant only). */
const PRODUCTION_SYNC: Record<string, (m: any) => void> = {
  'w5-1': (m) => { if (m.production_task.pdr.r !== 'mid') throw new Error('w5-1 production_task pdr.r expected mid'); set(m.production_task.pdr, 'r', 'high', 'production_task.pdr'); },
};

const W12_ANCHOR_OLD = '你在我预约的时段还一直用着会议室，导致我们的会议晚了三十分钟才开始，三位参会者都得调整接下来的安排，这让我很不方便。这次日程安排上的问题都在你这边，以后能不能在我预约的时间把会议室空出来？';
const W12_ANCHOR_NEW = '都是因为你在我预约的时段还一直用着会议室，我们的会议才晚开了三十分钟，三位参会者都得调整接下来的安排，这让我很不方便。以后能不能在我预约的时间把会议室空出来？';
const W12_HL_OLD = '这次日程安排上的问题都在你这边';
const W12_HL_NEW = '都是因为你在我预约的时段还一直用着会议室';
const W12_CORR2_OLD = '你在我预约的时段还一直用着会议室，根本没把我的预约当回事，导致我们的会议晚了三十分钟才开始，三位参会者都得调整接下来的安排，这让我很不方便。以后能不能在我预约的时间把会议室空出来？';
const W12_CORR2_NEW = '你在我预约的时段还一直用着会议室，害得我们的会议晚了三十分钟才开始，三位参会者都得调整接下来的安排，这让我很不方便。以后能不能在我预约的时间把会议室空出来？';
const W12_EXPL34_OLD = '이처럼 구체적인 책임과 요청은 유지하되, 일정 문제 전체를 상대 탓으로 돌리는 ‘这次日程安排上的问题都在你这边’이나 예약을 경시했다고 단정하는 ‘根本没把我的预约当回事’로 비난을 확장하지 않는 것이 적절합니다.';
const W12_EXPL34_NEW = '이처럼 구체적인 책임과 요청은 유지하되, 모든 원인을 상대 개인에게 몰아 붙이는 ‘都是因为你…才’나 상대가 피해를 입혔다고 탓하는 어감을 더하는 ‘害得’로 비난을 키우지 않는 것이 적절합니다.';
function w12AnchorItem(it: any, path: string) {
  rep(it, 'target', W12_ANCHOR_OLD, W12_ANCHOR_NEW, path);
  if (JSON.stringify(it.highlights) !== JSON.stringify([W12_HL_OLD])) throw new Error(`${path}.highlights unexpected`);
  set(it, 'highlights', [W12_HL_NEW], path);
}
function w12Corrections(it: any, path: string) {
  rep(it.corrections[0], 'note_ko', '일정 전체를 비난하지 않고 해당 사용 문제에 초점을 유지할 수 있습니다.', '모든 원인을 상대 개인에게 몰아 붙이지 않고 해당 사용 문제에 초점을 유지할 수 있습니다.', `${path}.corrections[0]`);
  rep(it.corrections[2], 'text', W12_CORR2_OLD, W12_CORR2_NEW, `${path}.corrections[2]`);
  set(it.corrections[2], 'note_ko', '확인된 초과 사용과 직접적 영향은 유지하면서 ‘导致’를 ‘害得’로 바꾸어, 결과를 전하는 데서 상대가 피해를 입혔다고 탓하는 어감으로 옮겼다. 원문에 없는 내용을 더하지 않고도 행동에 대한 불만을 책임 추궁으로 키워 over_attributed 경계를 넘는다.', `${path}.corrections[2]`);
  rep(it, 'explanation_ko', W12_EXPL34_OLD, W12_EXPL34_NEW, path);
}

/** Mission-level edits. Return the changed item indexes and whether reference alternatives changed. */
const MISSION_FIXES: Record<string, (m: any) => { items: number[]; refs: boolean }> = {
  'w12-0': (m) => {
    // MPJ2 (judge3)
    const it1 = m.mpj_items[1]; w12AnchorItem(it1, 'mpj_items[1]');
    set(it1, 'explanation_ko', '첫 장면처럼 책임을 직접 짚는 전략은 같고, P와 R은 그대로인 채 D만 친한 친구에서 몇 차례 함께 일한 동료로 바뀌었습니다. 여기서는 ‘都是因为你…才’가 확인된 회의실 초과 사용과 지연을 연결하는 데서 나아가 모든 원인을 상대 개인에게 몰아 붙여, 동료에게 일정 차질 전체의 책임을 추궁하는 인상을 줍니다. 직접성 자체를 없애기보다 ‘你…用着会议室，导致…’처럼 행동과 결과를 연결하는 데 그쳐야 합니다.', 'mpj_items[1]');
    // MPJ3 (fix_choice)
    const it2 = m.mpj_items[2]; w12AnchorItem(it2, 'mpj_items[2]'); w12Corrections(it2, 'mpj_items[2]');
    // MPJ4 (reason)
    const it3 = m.mpj_items[3]; w12AnchorItem(it3, 'mpj_items[3]'); w12Corrections(it3, 'mpj_items[3]');
    const r2 = it3.reasons.find((r: any) => r.id === 'r2'); const r1 = it3.reasons.find((r: any) => r.id === 'r1');
    set(r2, 'text_ko', '‘都是因为你…才’가 확인된 회의실 초과 사용과 지연을 연결하는 데서 나아가 모든 원인을 상대 개인에게 몰아 붙이기 때문이다.', 'mpj_items[3].reasons[r2]');
    set(r1, 'text_ko', '‘以后能不能在我预约的时间把会议室空出来？’로 불만 뒤에 재발 방지 요구까지 덧붙여, 동료에게 요구하는 것이 지나치게 많아지기 때문이다.', 'mpj_items[3].reasons[r1]');
    // MPJ5 (multi_judge) candidate 4
    const it4 = m.mpj_items[4]; const c3 = it4.candidates[3];
    rep(c3, 'text', '虽然只晚到了三分钟，但因为你把通知里的房间号写错，我先去了隔壁，还是觉得有些不便。这是一次严重的通知失误。', '都是因为你把通知里的房间号写错了，害得我先去了隔壁，晚到了三分钟。这个错误的通知让我很不方便。', 'mpj_items[4].candidates[3]');
    set(c3, 'note_ko', '앵커의 안내 오류·옆방 방문·3분 지연·불편이라는 내용은 그대로 두고, ‘都是因为你’와 ‘害得’로 3분 지연의 모든 원인을 상대 개인에게 돌리는 어감을 더했다. 낮은 피해 수준에 비해 책임 추궁의 강도를 키워, 원문에 없는 내용을 더하지 않고도 over_attributed 방향으로 이동한다.', 'mpj_items[4].candidates[3]');
    rep(it4, 'explanation_ko', '‘严重的通知失误’로 심각도를 확대하지 않도록 합니다.', '‘都是因为你…害得’로 작은 지연의 책임을 상대 개인에게 몰아 붙이지 않도록 합니다.', 'mpj_items[4]');
    return { items: [1, 2, 3, 4], refs: false };
  },
  'w5-1': (m) => {
    for (const i of [0, 1, 2, 3]) { const it = m.mpj_items[i]; if (it.pdr.r !== 'mid') throw new Error(`w5-1 mpj_items[${i}] pdr.r expected mid`); set(it.pdr, 'r', 'high', `mpj_items[${i}].pdr`); }
    if (m.mpj_items[4].pdr.r !== 'low') throw new Error('w5-1 mpj_items[4] pdr.r expected low');
    rep(m.mpj_items[1], 'explanation_ko', '아는 사이·보통 부담도 같지만', '아는 사이이고 주말에 시간을 내야 하는 부담도 같지만', 'mpj_items[1]');
    return { items: [0, 1, 2, 3], refs: false };
  },
  'w13-1': (m) => {
    rep(m.mpj_items[4], 'explanation_ko', '旁边的一支备用笔', '旁边那支备用笔', 'mpj_items[4]');
    return { items: [4], refs: false };
  },
};

async function loadRow(id: string) {
  const { data, error } = await db.from('scenarios').select('*').eq('scenario_id', id).single();
  if (error) throw new Error(`${id}: ${error.message}`); return data;
}
async function revise(row: any, key: string) {
  const mission = structuredClone(row.mission_content);
  const { items, refs } = MISSION_FIXES[key](mission);
  const edits: any = { itemBlocks: items.map((itemIndex) => ({ itemIndex, item: mission.mpj_items[itemIndex] })) };
  if (refs) edits.referenceAlternatives = mission.production_task.reference_alternatives;
  const result = await promote.reviseMissionDraft(row, edits, 'ai');
  return { ok: result.ok, error: result.error, ruleResult: result.ruleResult, violations: result.violations, quality: result.quality,
    reason_findings: (result.quality?.findings ?? []).filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? '')).length };
}

const mode = process.argv[2];
const keys = process.argv[3].split(',');
const { error: authError } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (authError) throw new Error(authError.message);
try {
  for (const key of keys) {
    changes.length = 0;
    const out = resolve(here, `${key}-fix.json`);
    if (existsSync(out)) { console.log(JSON.stringify({ key, preserved: true })); continue; }
    const row = await loadRow(TARGETS[key]);
    if (row.mission_status !== 'generated') throw new Error(`${key}: mission_status=${row.mission_status}`);
    if (mode === 'mission') {
      const revised = await revise(row, key);
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, scenario_id: row.scenario_id, mode, changes, revised, scope: 'Mission-level local fix through reviseMissionDraft; not instructor approval.' }, null, 2) + '\n');
      console.log(JSON.stringify({ key, mode, changed: changes.length, ok: revised.ok, verdict: revised.quality?.verdict, rule: revised.ruleResult, reason_findings: revised.reason_findings, error: revised.error, violations: revised.violations }));
      continue;
    }
    if (mode !== 'core') throw new Error('mode: mission | core');
    const core: any = structuredClone(row.core_content); const originalGeneration = core.generation ?? {}; delete core.generation;
    CORE_FIXES[key](core);
    const cell = { ...plan.cells.find((c: any) => c.key === key).cell, ...(CELL_OVERRIDES[key] ?? {}) };
    const semantic = await checkCoreSemanticFit(cell, core, RUN_ID, `corrected3:${key}`);
    if (!semantic.ok || semantic.result.verdict !== 'pass') {
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, scenario_id: row.scenario_id, mode, cell, changes, semantic, outcome: 'core_semantic_gate_failed' }, null, 2) + '\n');
      console.log(JSON.stringify({ key, outcome: 'core_semantic_gate_failed', verdict: semantic.ok ? semantic.result.verdict : semantic.error })); continue;
    }
    core.generation = { ...originalGeneration, semantic_check: semantic.result.check, local_revision: {
      revision_of_scenario_id: row.scenario_id, author: 'Claude (FABLE), researcher ruling 2026-09-11 night on the C7 official findings', edited_at: new Date().toISOString(),
      reason: `core-level fix: ${changes.map((c) => `${c.path} ${c.before}→${c.after}`).join(', ')}`,
      note: 'Researcher re-ruled the burden of this scene (whole act: Saturday-morning off-campus attendance plus critique) as high; scene text unchanged. scene_plan above is the origin row\'s generator observation. Mission transplanted from the origin row, then labels aligned through reviseMissionDraft.' } };
    if (!normalizeCore(core).ok) throw new Error(`${key}: corrected core fails schema`);
    const payload = {
      title: core.brief_note_ko || String(core.situation_ko ?? '').slice(0, 40),
      speech_act: cell.speech_act_ui, learner_level: cell.level, domain: cell.domain, industry_sector: cell.industry, business_function: cell.business_function ?? row.business_function ?? null,
      mode: cell.mode, source_modality: core.source_modality, theme_code: cell.theme_code, topic_code: cell.topic_code, language_direction: cell.direction,
      core_content: core, auto_check_result: 'pass', meta: { provider: row.generation_provider, model: row.generator_model, prompt_version: row.generation_prompt_version },
      generation_run_id: RUN_ID, generation_item_key: `corrected3:${key}`, content_hash: hashString(JSON.stringify(coreContentForHash(core))), prompt_snapshot_hash: row.prompt_snapshot_hash ?? null,
    };
    const { data: newId, error: saveError } = await rpc('save_generated_core', { p_payload: payload });
    if (saveError) throw new Error(`${key}: save_generated_core: ${saveError.message}`);
    const mission: any = structuredClone(row.mission_content); delete mission.item_lineage;
    PRODUCTION_SYNC[key](mission);
    mission.provenance = { ...(mission.provenance ?? {}), local_transplant: { from_scenario_id: row.scenario_id, to_scenario_id: newId, at: new Date().toISOString(), reason: 'core-level fix (pdr.r mid→high); mission content carried over, then item labels aligned through reviseMissionDraft' } };
    const { data: lin } = await db.from('mission_lineage_versions').select('realization_pack_id, realization_pack_version, coverage_status, rule_scope_ids, risk_scope_ids, evidence_scope_ids').eq('scenario_id', row.scenario_id).order('version_no', { ascending: false }).limit(1).maybeSingle();
    const { data: savedId, error: msErr } = await rpc('save_generated_mission', { p_scenario_id: newId, p_payload: {
      mission_content: mission, validation_result: { result: 'transplant', note: 'carried over from origin row; rule and quality checks run in the following revision' }, lineage_meta: lin ?? {} } });
    if (msErr) throw new Error(`${key}: save_generated_mission: ${msErr.message}`);
    const newRow = await loadRow(newId as string);
    const revised = await revise(newRow, key);
    const runCorePath = resolve(runDir, `${key}-core.json`);
    if (existsSync(runCorePath)) renameSync(runCorePath, resolve(runDir, `${key}-core.superseded-20260911c.json`));
    writeFileSync(runCorePath, JSON.stringify({ at: new Date().toISOString(), plan: plan.cells.find((c: any) => c.key === key), cell_override: CELL_OVERRIDES[key] ?? null, result: { ok: true, cell, scenarioId: newId, coreContent: core, ruleResult: 'pass', ruleFindings: [], terminalStage: 'core_eligible' }, note: `corrected3 row; origin ${row.scenario_id} preserved` }, null, 2) + '\n');
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, origin_scenario_id: row.scenario_id, new_scenario_id: newId, mode, cell, changes, semantic: { verdict: semantic.result.verdict, issues: semantic.result.issues, check: semantic.result.check }, transplant: { saved: savedId, lineage_meta: lin ?? null }, revised,
      scope: 'Core-level fix as a new draft core row + mission transplant + revision; origin row and its review runs preserved; not instructor approval.' }, null, 2) + '\n');
    console.log(JSON.stringify({ key, mode, origin: row.scenario_id.slice(0, 8), new: String(newId).slice(0, 8), changed: changes.length, semantic: semantic.result.verdict, ok: revised.ok, verdict: revised.quality?.verdict, rule: revised.ruleResult, reason_findings: revised.reason_findings, error: revised.error, violations: revised.violations }));
  }
} finally { await supabase.auth.signOut({ scope: 'local' }); }
