// Researcher rulings on the professor decision packet (2026-09-12): the two learner-facing 보완 items only.
//   w5-0   MJT2~4 anchor/corrections/recommended — «我也展出了照片的公司内部展览» → «有我照片参展的公司内部展览».
//          Source «제가 사진을 출품한 사내 전시»: speaker exhibited photos, in-company exhibition. «也» has no
//          source basis and is dropped; «照片» and the speaker's participation are kept. Band devices untouched.
//   w12-0  MJT4 Reason explanation replaced with item-specific feedback (why r2 is primary, why r1 — a request
//          present in the source — and r3 — information order — are not); no reference to MJT3 corrections.
// Mission-level edits through reviseMissionDraft (same mechanics as c9-fix). Results: <key>-fix.json.
//   node run-with-env.cjs .../c10-fix/content-fix.ts mission w5-0,w12-0
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote, { CURRENT_MISSION_QUALITY_PROMPT_VERSION }] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/promoteMission'),
  import('../../../../../supabase/functions/_shared/contentRelease'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const db = supabase as unknown as { from: (t: string) => any };

const TARGETS: Record<string, string> = {
  'w5-0': 'b9a5249f-fc09-4121-b4de-512f2f4a9079', 'w12-0': '97c4834a-ee4a-4691-a042-0255c8fadc4b',
};
type Change = { path: string; before: unknown; after: unknown };
const changes: Change[] = [];
function rep(obj: any, field: string, from: string, to: string, path: string) {
  const cur = obj[field]; if (typeof cur !== 'string' || !cur.includes(from)) throw new Error(`${path}.${field}: expected «${from}»`);
  const next = cur.split(from).join(to); changes.push({ path: `${path}.${field}`, before: cur, after: next }); obj[field] = next;
}
function set(obj: any, field: string, to: unknown, path: string) { changes.push({ path: `${path}.${field}`, before: obj[field], after: to }); obj[field] = to; }

const W50_OLD = '我也展出了照片的公司内部展览';
const W50_NEW = '有我照片参展的公司内部展览';

const MISSION_FIXES: Record<string, (m: any) => { items: number[]; refs: boolean }> = {
  'w5-0': (m) => {
    for (const i of [1, 2, 3]) {
      const it = m.mpj_items[i]; const path = `mpj_items[${i}]`;
      rep(it, 'target', W50_OLD, W50_NEW, path);
      rep(it, 'recommended_example', W50_OLD, W50_NEW, path);
      for (const [j, c] of (it.corrections ?? []).entries()) rep(c, 'text', W50_OLD, W50_NEW, `${path}.corrections[${j}]`);
      if (JSON.stringify(it).includes(W50_OLD)) throw new Error(`${path}: old phrase still present somewhere`);
    }
    return { items: [1, 2, 3], refs: false };
  },
  'w12-0': (m) => {
    const it = m.mpj_items[3];
    if (it.type !== 'reason' || it.accepted_reason_id !== 'r2') throw new Error('w12-0 mpj_items[3] unexpected');
    set(it, 'explanation_ko',
      '가장 큰 문제는 ‘都是因为你…才’입니다. 확인된 회의실 초과 사용과 30분 지연을 연결하는 데 그치지 않고 모든 원인을 상대 개인에게 몰아 붙여, 동등한 동료에게 확인된 행동 이상의 책임을 지우기 때문입니다. 지연·참석자 일정 변경·불편을 한 문장에 이어 붙인 정보 배열은 읽기 편의의 문제일 뿐 책임 범위를 넓히지는 않으므로 주된 이유가 아닙니다. 마지막의 재발 방지 요청은 원문의 ‘앞으로는 제 예약 시간에 맞춰 회의실을 비워주실 수 있을까요?’를 그대로 옮긴 것이라 과한 요구가 아니며 그대로 유지해야 합니다. ‘你…用着会议室，导致…’처럼 행동과 결과를 사실로 연결하는 데 그치면 충분합니다.',
      'mpj_items[3]');
    return { items: [3], refs: false };
  },
};

async function loadRow(id: string) {
  const { data, error } = await db.from('scenarios').select('*').eq('scenario_id', id).single();
  if (error) throw new Error(`${id}: ${error.message}`); return data;
}
const mode = process.argv[2];
const keys = process.argv[3].split(',');
if (mode !== 'mission') throw new Error('mode: mission');
const { error: authError } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (authError) throw new Error(authError.message);
try {
  for (const key of keys) {
    changes.length = 0;
    const out = resolve(here, `${key}-fix.json`);
    if (existsSync(out)) { console.log(JSON.stringify({ key, preserved: true })); continue; }
    const row = await loadRow(TARGETS[key]);
    if (row.mission_status !== 'generated') throw new Error(`${key}: mission_status=${row.mission_status}`);
    const before = { revision_hash: row.mission_content?.provenance?.mission_content_hash ?? null };
    const mission = structuredClone(row.mission_content);
    const { items } = MISSION_FIXES[key](mission);
    const result = await promote.reviseMissionDraft(row, { itemBlocks: items.map((itemIndex) => ({ itemIndex, item: mission.mpj_items[itemIndex] })) }, 'ai');
    const quality = result.quality as any;
    if (quality && quality.prompt_version !== CURRENT_MISSION_QUALITY_PROMPT_VERSION) throw new Error(`${key}: gate ran with ${quality.prompt_version}`);
    const after = await loadRow(TARGETS[key]);
    const revised = { ok: result.ok, error: result.error, ruleResult: result.ruleResult, violations: result.violations, quality,
      mission_content_hash: after.mission_content?.provenance?.mission_content_hash ?? null };
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key, scenario_id: row.scenario_id, mode, before, changes, revised,
      scope: 'Researcher-ruled learner-facing fix through reviseMissionDraft; not instructor approval.' }, null, 2) + '\n');
    console.log(JSON.stringify({ key, changed: changes.length, ok: revised.ok, verdict: quality?.verdict, hash: String(revised.mission_content_hash).slice(0, 8),
      findings: (quality?.findings ?? []).map((f: any) => `${f.severity}:${f.code}@${f.where}${(String(f.note_ko ?? '').match(/^\[[^\]]+\]/) ?? [''])[0]}`), rule: revised.ruleResult, error: revised.error }));
  }
} finally { await supabase.auth.signOut({ scope: 'local' }); }
