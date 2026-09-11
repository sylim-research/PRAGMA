// Last local content fixes for the seven C-grade missions (researcher ruling 2026-09-11, on the v3 official findings).
// Mission-level fields go through reviseMissionDraft (rule check + production critic → new content_hash, new
// lineage version). Core-level fields (source_text / situation_ko / focal_segments) have no in-place edit path:
// the corrected core is checked (core semantic gate) and saved as a NEW draft row via save_generated_core, the
// existing mission is transplanted onto it unchanged via save_generated_mission (no model regeneration), and the
// mission-level edits are then applied on the new row through reviseMissionDraft. Old rows and their review runs
// are never modified. Results: <key>-fix.json. Run from the worktree root with the admin process env.
//   node run-with-env.cjs .../content-fix.ts mission w6-0,w5-0,w5-1,w13-1
//   node run-with-env.cjs .../content-fix.ts core w12-0,w6-1,w10-0
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');
function hashString(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>).call(supabase, fn, args);
const db = supabase as unknown as { from: (t: string) => any };

const TARGETS: Record<string, string> = {
  'w5-0': 'b9a5249f-fc09-4121-b4de-512f2f4a9079', 'w5-1': '793a1576-55c4-4790-9791-621685a9b3bb', 'w6-0': 'def83b4f-b281-4285-af06-7e9339269706',
  'w6-1': '09bc6c81-0a33-4c3f-aca7-c668623ef6c5', 'w10-0': '1f6d8863-c334-4d2b-a97f-3eb622e48c0c', 'w12-0': '013cc144-9793-4e9b-a292-6ba58abe99dc',
  'w13-1': '26412ba9-8942-4cba-a7c8-12e744f3891a',
};
type Change = { path: string; before: unknown; after: unknown };
const changes: Change[] = [];
function rep(obj: any, field: string, from: string, to: string, path: string) {
  const cur = obj[field]; if (typeof cur !== 'string' || !cur.includes(from)) throw new Error(`${path}.${field}: expected «${from}»`);
  const next = cur.split(from).join(to); changes.push({ path: `${path}.${field}`, before: cur, after: next }); obj[field] = next;
}
function set(obj: any, field: string, to: unknown, path: string) { changes.push({ path: `${path}.${field}`, before: obj[field], after: to }); obj[field] = to; }

/** Core-level edits (new core row). Return true when the core changed. */
const CORE_FIXES: Record<string, (core: any) => void> = {
  'w12-0': (c) => {
    rep(c, 'source_text', '가능한 빨리', '가능한 한 빨리', 'core');
    rep(c, 'source_text', '앞으로도 이런 일이 반복되지 않기를', '앞으로는 이런 일이 반복되지 않기를', 'core');
    const seg = c.focal_segments.find((s: any) => s.role === 'support'); rep(seg, 'text', '가능한 빨리', '가능한 한 빨리', 'core.focal_segments[support]');
  },
  'w6-1': (c) => { rep(c, 'situation_ko', '교수에게 학과 행사 접수 업무를 부탁받았다', '교수에게 내일 점심 학과 행사 접수 업무를 부탁받았다', 'core'); },
  'w10-0': (c) => { rep(c, 'situation_ko', '단체 메신저에 제안하려 한다.', '단체 메신저에 제안하려 한다. 이 단체방에서는 친한 사이여도 서로 존댓말을 쓴다.', 'core'); },
};
/** Copies the core-level changes into the production_task copy of the mission (transplant only). */
const PRODUCTION_SYNC: Record<string, (m: any) => void> = {
  'w12-0': (m) => { const p = m.production_task; rep(p, 'source_text', '가능한 빨리', '가능한 한 빨리', 'production_task'); rep(p, 'source_text', '앞으로도 이런 일이 반복되지 않기를', '앞으로는 이런 일이 반복되지 않기를', 'production_task'); const seg = p.focal_segments.find((s: any) => s.role === 'support'); rep(seg, 'text', '가능한 빨리', '가능한 한 빨리', 'production_task.focal_segments[support]'); },
  'w6-1': (m) => { rep(m.production_task, 'situation_ko', '교수에게 학과 행사 접수 업무를 부탁받았다', '교수에게 내일 점심 학과 행사 접수 업무를 부탁받았다', 'production_task'); },
  'w10-0': (m) => { rep(m.production_task, 'situation_ko', '단체 메신저에 제안하려 한다.', '단체 메신저에 제안하려 한다. 이 단체방에서는 친한 사이여도 서로 존댓말을 쓴다.', 'production_task'); },
};
/** Mission-level edits. Return the changed item indexes and whether reference alternatives changed. */
const MISSION_FIXES: Record<string, (m: any) => { items: number[]; refs: boolean }> = {
  'w6-0': (m) => {
    const r3 = m.mpj_items[3].reasons.find((r: any) => r.id === 'r3');
    set(r3, 'text_ko', '‘明天没办法…那一小时班’으로 날짜와 범위가 문장 끝에 와서, 무엇을 거절하는지가 끝에서야 드러나기 때문이다.', 'mpj_items[3].reasons[r3]');
    return { items: [3], refs: false };
  },
  'w5-0': (m) => {
    rep(m.mpj_items[0], 'target', '不收参加费', '不收费', 'mpj_items[0]'); rep(m.mpj_items[0], 'recommended_example', '不收参加费', '不收费', 'mpj_items[0]');
    set(m.production_task.reference_alternatives[1], 'text', '这周六下午我打算去附近的公园散步，时间大约是半个小时。另外两位会员也已经说好一起走了，你有空的话，想邀请你也一起来。不用有压力，轻轻松松来就好！', 'production_task.reference_alternatives[1]');
    return { items: [0], refs: true };
  },
  'w5-1': (m) => {
    rep(m.mpj_items[1], 'explanation_ko', "첫 장면과 '有空的话'에 이은 직접 초대 전략은 같고, 아는 사이·보통 부담을 유지한 채 권한 관계만 동료에서 업무 배정·평가를 맡는 팀장으로 바뀌었습니다.",
      "첫 장면과 '有空的话'에 이은 직접 초대 전략은 같고 아는 사이·보통 부담도 같지만, 초대하는 활동이 내가 주최하는 독서 모임에서 내가 출연하는 합창 공연 관람으로 바뀌었고 권한 관계도 동료에서 업무 배정·평가를 맡는 팀장으로 바뀌었습니다.", 'mpj_items[1]');
    return { items: [1], refs: false };
  },
  'w13-1': (m) => {
    const REC_FROM = '能不能帮我检查一下新活动的通知，看看有没有错别字、有没有漏掉的信息？明天上午之前把意见告诉我，时间上方便吗？';
    const REC_TO = '能不能帮我检查一下新活动的通知，看看有没有错别字、有没有漏掉的信息？意见请在明天上午之前告诉我。';
    for (const i of [1, 2, 3]) rep(m.mpj_items[i], 'recommended_example', REC_FROM, REC_TO, `mpj_items[${i}]`);
    const corr = m.mpj_items[2].corrections[0]; rep(corr, 'text', REC_FROM, REC_TO, 'mpj_items[2].corrections[0]');
    set(corr, 'note_ko', '30분의 검토와 기한이 걸린 부탁에서 ‘能不能’이 수행 여부를 열어 두고 기한은 원문대로 분명히 전하므로, 요청 내용과 이 조정 여지를 함께 유지합니다.', 'mpj_items[2].corrections[0]');
    rep(m.mpj_items[2], 'explanation_ko', '‘能不能’으로 검토 가능 여부를 묻고 ‘时间上方便吗’로 기한의 수용 여부를 확인하면, 검토 항목과 마감을 분명히 하면서도 상대의 일정 조정 여지를 존중할 수 있습니다. 이 두 질문을 유지하여',
      '‘能不能’으로 검토 가능 여부를 묻되 내일 오전이라는 기한은 원문대로 분명히 전하면, 검토 항목과 마감을 분명히 하면서도 상대가 수락 여부를 답할 여지를 존중할 수 있습니다. 이 질문을 유지하여', 'mpj_items[2]');
    rep(m.mpj_items[1], 'explanation_ko', '검토 가능 여부와 기한의 수용 가능성을 물어 조정 여지를 남기는 것이 좋습니다.', '검토 가능 여부를 물어 수락할 여지를 남기되 기한은 그대로 전하는 것이 좋습니다.', 'mpj_items[1]');
    rep(m.mpj_items[3], 'explanation_ko', '검토 내용은 유지하고 ‘能不能’이나 기한의 편의성을 묻는 질문으로 조정하세요.', '검토 내용과 기한은 유지하고 ‘能不能’으로 수락 여부를 묻는 질문으로 조정하세요.', 'mpj_items[3]');
    m.mpj_items[4].candidates.forEach((c: any, j: number) => rep(c, 'text', '旁边的一支备用笔', '旁边那支备用笔', `mpj_items[4].candidates[${j}]`));
    rep(m.mpj_items[4], 'recommended_example', '旁边的一支备用笔', '旁边那支备用笔', 'mpj_items[4]');
    return { items: [1, 2, 3, 4], refs: false };
  },
  'w12-0': (m) => {
    const r1 = m.mpj_items[3].reasons.find((r: any) => r.id === 'r1');
    set(r1, 'text_ko', '‘你在我预约的时段还一直用着会议室’로 첫머리부터 ‘你’를 주어로 상대의 행동을 서술해, 불만이 사실 확인보다 지적으로 먼저 들릴 수 있기 때문이다.', 'mpj_items[3].reasons[r1]');
    return { items: [3], refs: false };
  },
  'w6-1': (m) => {
    rep(m.mpj_items[3], 'explanation_ko', '마감 이유 자체가 잘못되거나 ‘再接’이 업무를 반납했다는 뜻인 것은 아닙니다.', '‘你’·‘吧’의 말투나 결론을 이유보다 앞에 둔 순서는 부차적인 관찰이지 주원인이 아닙니다.', 'mpj_items[3]');
    return { items: [3], refs: false };
  },
  'w10-0': (m) => {
    const it0 = m.mpj_items[0];
    rep(it0, 'target', '我建议做些分区指示牌摆好', '我建议做几块分区指示牌摆在入口', 'mpj_items[0]'); rep(it0, 'recommended_example', '我建议做些分区指示牌摆好', '我建议做几块分区指示牌摆在入口', 'mpj_items[0]');
    set(it0, 'highlights', it0.highlights.map((h: string) => h === '我建议做些分区指示牌摆好' ? '我建议做几块分区指示牌摆在入口' : h), 'mpj_items[0]');
    const it4 = m.mpj_items[4]; const OLD = '那家有我们俩都爱吃的菜的面馆';
    const NEW: Record<number, string> = {
      0: '附近几家餐馆的路程用时和价格都差不多。那家面馆有我们俩都爱吃的菜，今天中午要不要去？',
      1: '附近几家餐馆的路程用时和价格都差不多。那家面馆有我们俩都爱吃的菜，今天中午就去那儿，咱们这就算定下来了。',
      2: '附近几家餐馆的路程用时和价格都差不多。那家面馆有我们俩都爱吃的菜，如果今天中午去那儿吃，你觉得怎么样？',
      3: '附近几家餐馆的路程用时和价格都差不多。那家面馆有我们俩都爱吃的菜，如果今天中午去那儿吃，也许也行，不过真要不要去，我也没个准主意，先这么随便想想吧。',
    };
    it4.candidates.forEach((c: any, j: number) => { if (!c.text.includes(OLD)) throw new Error(`mpj_items[4].candidates[${j}]: expected «${OLD}»`); set(c, 'text', NEW[j], `mpj_items[4].candidates[${j}]`); });
    if (!it4.recommended_example.includes(OLD)) throw new Error('mpj_items[4].recommended_example: expected old phrase'); set(it4, 'recommended_example', NEW[0], 'mpj_items[4]');
    return { items: [0, 4], refs: false };
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
      console.log(JSON.stringify({ key, mode, changed: changes.length, ok: revised.ok, verdict: revised.quality?.verdict, rule: revised.ruleResult, reason_findings: revised.reason_findings, error: revised.error }));
      continue;
    }
    if (mode !== 'core') throw new Error('mode: mission | core');
    // 1) corrected core (drop generation; re-attached at save with local_revision provenance)
    const core: any = structuredClone(row.core_content); const originalGeneration = core.generation ?? {}; delete core.generation;
    CORE_FIXES[key](core);
    const cell = plan.cells.find((c: any) => c.key === key).cell;
    const semantic = await checkCoreSemanticFit(cell, core, RUN_ID, `corrected2:${key}`);
    if (!semantic.ok || semantic.result.verdict !== 'pass') {
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, scenario_id: row.scenario_id, mode, changes, semantic, outcome: 'core_semantic_gate_failed' }, null, 2) + '\n');
      console.log(JSON.stringify({ key, outcome: 'core_semantic_gate_failed', verdict: semantic.ok ? semantic.result.verdict : semantic.error })); continue;
    }
    core.generation = { ...originalGeneration, semantic_check: semantic.result.check, local_revision: {
      revision_of_scenario_id: row.scenario_id, author: 'Claude (FABLE), researcher ruling 2026-09-11 on v3 official findings', edited_at: new Date().toISOString(),
      reason: `core-level fix: ${changes.map((c) => c.path).join(', ')}`, note: 'Human-corrected core text; the generation prompt data above describes the origin row, not this text. Mission transplanted unchanged from the origin row.' } };
    if (!normalizeCore(core).ok) throw new Error(`${key}: corrected core fails schema`);
    const payload = {
      title: core.brief_note_ko || String(core.situation_ko ?? '').slice(0, 40),
      speech_act: cell.speech_act_ui, learner_level: cell.level, domain: cell.domain, industry_sector: cell.industry, business_function: cell.business_function ?? row.business_function ?? null,
      mode: cell.mode, source_modality: core.source_modality, theme_code: cell.theme_code, topic_code: cell.topic_code, language_direction: cell.direction,
      core_content: core, auto_check_result: 'pass', meta: { provider: row.generation_provider, model: row.generator_model, prompt_version: row.generation_prompt_version },
      generation_run_id: RUN_ID, generation_item_key: `corrected2:${key}`, content_hash: hashString(JSON.stringify(coreContentForHash(core))), prompt_snapshot_hash: row.prompt_snapshot_hash ?? null,
    };
    const { data: newId, error: saveError } = await rpc('save_generated_core', { p_payload: payload });
    if (saveError) throw new Error(`${key}: save_generated_core: ${saveError.message}`);
    // 2) transplant the existing mission (no regeneration); sync the production_task copies of the core fields
    const mission: any = structuredClone(row.mission_content); delete mission.item_lineage;
    PRODUCTION_SYNC[key](mission);
    mission.provenance = { ...(mission.provenance ?? {}), local_transplant: { from_scenario_id: row.scenario_id, to_scenario_id: newId, at: new Date().toISOString(), reason: 'core-level fix; mission content carried over unchanged, then revised through reviseMissionDraft' } };
    const { data: lin } = await db.from('mission_lineage_versions').select('realization_pack_id, realization_pack_version, coverage_status, rule_scope_ids, risk_scope_ids, evidence_scope_ids').eq('scenario_id', row.scenario_id).order('version_no', { ascending: false }).limit(1).maybeSingle();
    const { data: savedId, error: msErr } = await rpc('save_generated_mission', { p_scenario_id: newId, p_payload: {
      mission_content: mission, validation_result: { result: 'transplant', note: 'carried over from origin row; rule and quality checks run in the following revision' }, lineage_meta: lin ?? {} } });
    if (msErr) throw new Error(`${key}: save_generated_mission: ${msErr.message}`);
    // 3) mission-level edits + production gate on the new row
    const newRow = await loadRow(newId as string);
    const revised = await revise(newRow, key);
    // 4) repoint the run core file so status/official-review use the corrected row
    const runCorePath = resolve(runDir, `${key}-core.json`);
    if (existsSync(runCorePath)) renameSync(runCorePath, resolve(runDir, `${key}-core.superseded-20260911b.json`));
    writeFileSync(runCorePath, JSON.stringify({ at: new Date().toISOString(), plan: plan.cells.find((c: any) => c.key === key), result: { ok: true, cell, scenarioId: newId, coreContent: core, ruleResult: 'pass', ruleFindings: [], terminalStage: 'core_eligible' }, note: `corrected2 row; origin ${row.scenario_id} preserved` }, null, 2) + '\n');
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, origin_scenario_id: row.scenario_id, new_scenario_id: newId, mode, changes, semantic: { verdict: semantic.result.verdict, issues: semantic.result.issues }, transplant: { saved: savedId, lineage_meta: lin ?? null }, revised,
      scope: 'Core-level fix as a new draft core row + mission transplant + revision; origin row and its review runs preserved; not instructor approval.' }, null, 2) + '\n');
    console.log(JSON.stringify({ key, mode, origin: row.scenario_id.slice(0, 8), new: String(newId).slice(0, 8), changed: changes.length, semantic: semantic.result.verdict, ok: revised.ok, verdict: revised.quality?.verdict, rule: revised.ruleResult, reason_findings: revised.reason_findings, error: revised.error }));
  }
} finally { await supabase.auth.signOut({ scope: 'local' }); }
