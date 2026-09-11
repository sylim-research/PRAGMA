// Pre-approval cleanup (researcher ruling 2026-09-11 late night, after the C8 report). Runs AFTER the
// quality_v23 critic (reason_branch severity) is deployed, so each revision's production gate uses it.
//   w5-1   core     — the C8 high ruling is withdrawn: pdr.r high → mid on a NEW core row (from the high row
//                     d56896f5, which is preserved together with its review runs). production_task and MPJ1–4
//                     labels back to mid, MPJ5 low kept. MPJ2's explanation grounds the mid burden in the scene
//                     facts (near the office, 90 minutes, free). Scene text unchanged.
//   w12-0  mission  — MPJ5 only: candidate 3 loses the source-absent minimising «只» (new within_band wording),
//                     candidate 4's note states the intensity rise (有些不便→很不方便) instead of "no addition",
//                     explanation says 동아리 회원 instead of 동료, «这个通知错误» → «通知上的这个错误».
//   w13-1  mission  — MPJ5 only: candidate 4's structure (command + trailing «会不会让你为难？») made natural while
//                     keeping the burden-probing device and too_indirect; anchor too_direct kept.
// Same mechanics as c8-fix/content-fix.ts. Results: <key>-fix.json.
//   node run-with-env.cjs .../c9-fix/content-fix.ts mission w12-0,w13-1
//   node run-with-env.cjs .../c9-fix/content-fix.ts core w5-1
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote, { checkCoreSemanticFit }, { coreContentForHash, normalizeCore }, { CURRENT_MISSION_QUALITY_PROMPT_VERSION }] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/promoteMission'),
  import('../../../../../src/lib/pragma/coreBatchRun'),
  import('../../../../../src/lib/pragma/coreSchema'),
  import('../../../../../supabase/functions/_shared/contentRelease'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, '../../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const plan = JSON.parse(readFileSync(resolve(here, '../../../../../.tmp/scene-grounding/plan.json'), 'utf8'));
const RUN_ID = 'scene_grounding_course_20260910';
function hashString(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>).call(supabase, fn, args);
const db = supabase as unknown as { from: (t: string) => any };

const TARGETS: Record<string, string> = {
  'w12-0': '97c4834a-ee4a-4691-a042-0255c8fadc4b', 'w5-1': 'd56896f5-0d0e-4ec4-8e04-c2270baad51a', 'w13-1': '26412ba9-8942-4cba-a7c8-12e744f3891a',
};
type Change = { path: string; before: unknown; after: unknown };
const changes: Change[] = [];
function rep(obj: any, field: string, from: string, to: string, path: string) {
  const cur = obj[field]; if (typeof cur !== 'string' || !cur.includes(from)) throw new Error(`${path}.${field}: expected «${from}»`);
  const next = cur.split(from).join(to); changes.push({ path: `${path}.${field}`, before: cur, after: next }); obj[field] = next;
}
function set(obj: any, field: string, to: unknown, path: string) { changes.push({ path: `${path}.${field}`, before: obj[field], after: to }); obj[field] = to; }
function setExact(obj: any, field: string, from: string, to: string, path: string) {
  if (obj[field] !== from) throw new Error(`${path}.${field}: unexpected current value`); set(obj, field, to, path);
}

const CORE_FIXES: Record<string, (core: any) => void> = {
  'w5-1': (c) => { if (c.pdr.r !== 'high') throw new Error('w5-1 core pdr.r expected high'); set(c.pdr, 'r', 'mid', 'core.pdr'); },
};
const PRODUCTION_SYNC: Record<string, (m: any) => void> = {
  'w5-1': (m) => { if (m.production_task.pdr.r !== 'high') throw new Error('w5-1 production_task pdr.r expected high'); set(m.production_task.pdr, 'r', 'mid', 'production_task.pdr'); },
};

const MISSION_FIXES: Record<string, (m: any) => { items: number[]; refs: boolean }> = {
  'w5-1': (m) => {
    for (const i of [0, 1, 2, 3]) { const it = m.mpj_items[i]; if (it.pdr.r !== 'high') throw new Error(`w5-1 mpj_items[${i}] pdr.r expected high`); set(it.pdr, 'r', 'mid', `mpj_items[${i}].pdr`); }
    if (m.mpj_items[4].pdr.r !== 'low') throw new Error('w5-1 mpj_items[4] pdr.r expected low');
    rep(m.mpj_items[1], 'explanation_ko', '같고 아는 사이이고 주말에 시간을 내야 하는 부담도 같지만,',
      '같고, 아는 사이라는 점과 회사 근처에서 90분간 비용 없이 열리는 주말 활동이라 주말 시간을 조금 내는 정도의 보통 부담도 같지만,', 'mpj_items[1]');
    return { items: [0, 1, 2, 3], refs: false };
  },
  'w12-0': (m) => {
    const it = m.mpj_items[4]; const [c0, , c2, c3] = it.candidates;
    rep(c0, 'text', '这个通知错误让我有些不便。', '通知上的这个错误让我有些不便。', 'mpj_items[4].candidates[0]');
    rep(it, 'recommended_example', '这个通知错误让我有些不便。', '通知上的这个错误让我有些不便。', 'mpj_items[4]');
    setExact(c2, 'text', '虽然只晚到了三分钟，但因为你把通知里的房间号写错，我先去了隔壁，还是觉得有些不便。',
      '因为你在通知里写的房间号不对，我先去了隔壁，晚到了三分钟，这给我带来了一些不便。', 'mpj_items[4].candidates[2]');
    set(c2, 'note_ko', '‘因为你在通知里写的房间号不对’로 오류의 원인과 작성자를 짚고 ‘这给我带来了一些不便’으로 실제 불편을 담담하게 전하므로, 원문에 없는 평가를 더하지 않은 비례적인 불만으로 유지할 수 있습니다.', 'mpj_items[4].candidates[2]');
    set(c3, 'note_ko', '앵커의 안내 오류·옆방 방문·3분 지연·불편이라는 명제는 그대로 두되, ‘都是因为你’와 ‘害得’로 3분 지연의 모든 원인을 상대 개인에게 돌리는 어감을 더하고 ‘有些不便’ 대신 ‘很不方便’으로 불편의 강도도 높였다. 원문에 없는 명제는 더하지 않았지만 낮은 피해 수준에 비해 책임 추궁과 불편의 강도를 키워 over_attributed 방향으로 이동한다.', 'mpj_items[4].candidates[3]');
    rep(it, 'explanation_ko', '‘虽然只晚到了三分钟’과 ‘还是觉得有些不便’로 작은 피해와 실제 불편을 함께 인정하며', '‘因为你…写的房间号不对’와 ‘带来了一些不便’으로 원인과 실제 불편을 담담하게 전하며', 'mpj_items[4]');
    rep(it, 'explanation_ko', '두 방식 모두 동료 관계에 맞는', '두 방식 모두 동아리 회원 사이에 맞는', 'mpj_items[4]');
    return { items: [4], refs: false };
  },
  'w13-1': (m) => {
    const it = m.mpj_items[4]; const c3 = it.candidates[3];
    setExact(c3, 'text', '我这儿够不着。请你把旁边那支备用笔递给我，会不会让你为难？', '我这儿够不着。不知道会不会让你为难，能不能把旁边那支备用笔递给我？', 'mpj_items[4].candidates[3]');
    set(c3, 'note_ko', '‘能…吗’로 가능 여부만 묻던 부탁 앞에 ‘不知道会不会让你为难’라는 부담 우려를 덧붙였습니다. 바로 옆 여분 펜을 건네는 작은 행동인데도 상대가 곤란해질 가능성부터 타진하여 요청을 과도한 조심스러움으로 돌리므로 too_indirect 방향입니다.', 'mpj_items[4].candidates[3]');
    rep(it, 'explanation_ko', '‘会不会让你为难？’로 작은 부탁을 과도하게 타진하지', '‘不知道会不会让你为难’으로 작은 부탁을 과도하게 타진하지', 'mpj_items[4]');
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
  if (result.quality && (result.quality as any).prompt_version !== CURRENT_MISSION_QUALITY_PROMPT_VERSION) {
    throw new Error(`${key}: gate ran with ${(result.quality as any).prompt_version}; deploy the ${CURRENT_MISSION_QUALITY_PROMPT_VERSION} critic first`);
  }
  return { ok: result.ok, error: result.error, ruleResult: result.ruleResult, violations: result.violations, quality: result.quality };
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
      console.log(JSON.stringify({ key, mode, changed: changes.length, ok: revised.ok, verdict: revised.quality?.verdict, findings: (revised.quality?.findings ?? []).map((f: any) => `${f.severity}:${f.code}@${f.where}`), rule: revised.ruleResult, error: revised.error }));
      continue;
    }
    if (mode !== 'core') throw new Error('mode: mission | core');
    const core: any = structuredClone(row.core_content); const originalGeneration = core.generation ?? {}; delete core.generation;
    CORE_FIXES[key](core);
    const cell = plan.cells.find((c: any) => c.key === key).cell; // plan cell burden is mid
    if (cell.pdr_burden !== 'mid') throw new Error(`${key}: plan cell burden expected mid`);
    const semantic = await checkCoreSemanticFit(cell, core, RUN_ID, `corrected4:${key}`);
    if (!semantic.ok || semantic.result.verdict !== 'pass') {
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, scenario_id: row.scenario_id, mode, cell, changes, semantic, outcome: 'core_semantic_gate_failed' }, null, 2) + '\n');
      console.log(JSON.stringify({ key, outcome: 'core_semantic_gate_failed', verdict: semantic.ok ? semantic.result.verdict : semantic.error })); continue;
    }
    const priorRevision = originalGeneration.local_revision ?? null;
    const { local_revision: _drop, ...generationWithoutRevision } = originalGeneration;
    core.generation = { ...generationWithoutRevision, semantic_check: semantic.result.check,
      local_revision_history: [...(originalGeneration.local_revision_history ?? []), ...(priorRevision ? [priorRevision] : [])],
      local_revision: {
        revision_of_scenario_id: row.scenario_id, author: 'Claude, researcher ruling 2026-09-11 late night (pre-approval cleanup)', edited_at: new Date().toISOString(),
        reason: `core-level fix: ${changes.map((c) => `${c.path} ${c.before}→${c.after}`).join(', ')}`,
        note: 'Researcher withdrew the C8 high ruling after review: R is the burden of the act itself (the professor relation is carried by P/D); the anchor scene_plan observed_pdr is mid; the MPJ scenes (near the office, 90 minutes, free) support mid; the high labels contradicted MPJ1–4 scene facts (official review finding). Scene text unchanged. The high row is preserved as the previous revision.' } };
    if (!normalizeCore(core).ok) throw new Error(`${key}: corrected core fails schema`);
    const payload = {
      title: core.brief_note_ko || String(core.situation_ko ?? '').slice(0, 40),
      speech_act: cell.speech_act_ui, learner_level: cell.level, domain: cell.domain, industry_sector: cell.industry, business_function: cell.business_function ?? row.business_function ?? null,
      mode: cell.mode, source_modality: core.source_modality, theme_code: cell.theme_code, topic_code: cell.topic_code, language_direction: cell.direction,
      core_content: core, auto_check_result: 'pass', meta: { provider: row.generation_provider, model: row.generator_model, prompt_version: row.generation_prompt_version },
      generation_run_id: RUN_ID, generation_item_key: `corrected4:${key}`, content_hash: hashString(JSON.stringify(coreContentForHash(core))), prompt_snapshot_hash: row.prompt_snapshot_hash ?? null,
    };
    const { data: newId, error: saveError } = await rpc('save_generated_core', { p_payload: payload });
    if (saveError) throw new Error(`${key}: save_generated_core: ${saveError.message}`);
    const mission: any = structuredClone(row.mission_content); delete mission.item_lineage;
    PRODUCTION_SYNC[key](mission);
    const priorTransplant = mission.provenance?.local_transplant ?? null;
    mission.provenance = { ...(mission.provenance ?? {}),
      local_transplant_history: [...(mission.provenance?.local_transplant_history ?? []), ...(priorTransplant ? [priorTransplant] : [])],
      local_transplant: { from_scenario_id: row.scenario_id, to_scenario_id: newId, at: new Date().toISOString(), reason: 'core-level fix (pdr.r high→mid, C8 ruling withdrawn); mission carried over, then labels and one explanation aligned through reviseMissionDraft' } };
    const { data: lin } = await db.from('mission_lineage_versions').select('realization_pack_id, realization_pack_version, coverage_status, rule_scope_ids, risk_scope_ids, evidence_scope_ids').eq('scenario_id', row.scenario_id).order('version_no', { ascending: false }).limit(1).maybeSingle();
    const { data: savedId, error: msErr } = await rpc('save_generated_mission', { p_scenario_id: newId, p_payload: {
      mission_content: mission, validation_result: { result: 'transplant', note: 'carried over from the high row; rule and quality checks run in the following revision' }, lineage_meta: lin ?? {} } });
    if (msErr) throw new Error(`${key}: save_generated_mission: ${msErr.message}`);
    const newRow = await loadRow(newId as string);
    const revised = await revise(newRow, key);
    const runCorePath = resolve(runDir, `${key}-core.json`);
    if (existsSync(runCorePath)) renameSync(runCorePath, resolve(runDir, `${key}-core.superseded-20260911d.json`));
    writeFileSync(runCorePath, JSON.stringify({ at: new Date().toISOString(), plan: plan.cells.find((c: any) => c.key === key), result: { ok: true, cell, scenarioId: newId, coreContent: core, ruleResult: 'pass', ruleFindings: [], terminalStage: 'core_eligible' }, note: `corrected4 row (mid); high row ${row.scenario_id} preserved` }, null, 2) + '\n');
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, origin_scenario_id: row.scenario_id, new_scenario_id: newId, mode, cell, changes, semantic: { verdict: semantic.result.verdict, issues: semantic.result.issues, check: semantic.result.check }, transplant: { saved: savedId, lineage_meta: lin ?? null }, revised,
      scope: 'Core-level fix as a new draft core row + mission transplant + revision; the high row and its review runs preserved; not instructor approval.' }, null, 2) + '\n');
    console.log(JSON.stringify({ key, mode, origin: row.scenario_id.slice(0, 8), new: String(newId).slice(0, 8), changed: changes.length, semantic: semantic.result.verdict, ok: revised.ok, verdict: revised.quality?.verdict, findings: (revised.quality?.findings ?? []).map((f: any) => `${f.severity}:${f.code}@${f.where}`), rule: revised.ruleResult, error: revised.error }));
  }
} finally { await supabase.auth.signOut({ scope: 'local' }); }
