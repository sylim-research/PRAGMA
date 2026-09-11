// Builds the corrected w6-1 core draft from the stored row (700f0bdd) with exactly two changes to
// core_content.preceding_turn, on the researcher's 2026-09-11 ruling (content blocker, freeze lifted for w6-1 only):
//   1) role inversion — the preceding turn addressed "教授" as if a student were asking the professor,
//      while the scene is the professor asking the student; drop the address so the professor speaks;
//   2) 接待 → 签到 so the professor's request names the same task as the Korean source (접수 업무) and the
//      mission's reference alternatives (签到工作).
// Nothing else in the core or the mission is touched. Output: w6-1-draft.json (input of check-and-save.ts).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const { supabase } = await import('../../../../../src/integrations/supabase/client');
const here = dirname(fileURLToPath(import.meta.url));
const ORIGINAL = '700f0bdd-54f7-4192-80e4-07dcd262e2de';
const BEFORE = '教授，我想请你帮忙负责明天中午系里活动的接待工作，可以吗？';
const AFTER = '我想请你帮忙负责明天中午系里活动的签到工作，可以吗？';
const plan = { key: 'w6-1', week: 6, position: 1, replaces: '83fd3cdf-d3b3-4ab0-b808-9117cb0ae2b8', cell: {
  speech_act_ui: 'refusal', level: 'intermediate', domain: 'school', mode: 'stt_interpreting', industry: null, business_function: null,
  pdr_power: 'higher', pdr_distance: 'acquaintance', pdr_burden: 'mid', theme_code: 'campus_study', topic_code: 'school_request_refusal',
  situation_seed_ko: '이번 학기 과제 지도로 두 차례 면담한 교수가 다음 날 점심에 학과 행사 접수를 한 시간 맡아 달라고 부탁했다. 나는 그 시간에 다른 수업의 시험이 있어 수업 후 직접 맡을 수 없다고 말한다.',
  direction: 'ko_zh', count: 1 } };

const { error } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const { data, error: rowError } = await db.from('scenarios').select('core_content').eq('scenario_id', ORIGINAL).single();
  if (rowError) throw new Error(rowError.message);
  const core = { ...data.core_content } as Record<string, unknown>;
  if (core.preceding_turn !== BEFORE) throw new Error(`preceding_turn differs from the expected original: ${JSON.stringify(core.preceding_turn)}`);
  delete core.generation; // check-and-save.ts re-attaches generation with local_revision provenance
  core.preceding_turn = AFTER;
  const draft = {
    status: 'draft', author: 'Claude (FABLE), on researcher ruling 2026-09-11 (w6-1 content blocker)',
    original_scenario_id: ORIGINAL,
    revision_reason: 'preceding_turn read as the student asking the professor ("教授，…") although the scene is the professor asking the student (role inversion, Claude independent review fail); and it named the task 接待工作 while the Korean source (접수 업무) and the mission reference alternatives use 签到工作. Address dropped, 接待→签到. No other change.',
    review_required: 'core semantic check (production gate) → new draft core row → mission promotion → official content-review',
    change: { field: 'core_content.preceding_turn', before: BEFORE, after: AFTER },
    plan, coreContent: core,
  };
  writeFileSync(resolve(here, 'w6-1-draft.json'), JSON.stringify(draft, null, 2) + '\n');
  console.log(JSON.stringify({ written: 'w6-1-draft.json', before: BEFORE, after: AFTER }));
} finally { await supabase.auth.signOut({ scope: 'local' }); }
