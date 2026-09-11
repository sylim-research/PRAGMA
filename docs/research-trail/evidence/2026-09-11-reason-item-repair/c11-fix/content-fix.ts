// Researcher ruling 2026-09-12 (last language fix before approval): w5-0 only.
//   «有我照片参展的公司内部展览» → «我有照片参展的公司内部展览» at every learner-facing position where the phrase
//   repeats (MJT2~4 target · recommended · MJT3/4 corrections). Situation, P/D/R, target feature, bands,
//   highlights and item structure are untouched. Through reviseMissionDraft (v24 gate, evaluator unchanged).
//   node run-with-env.cjs .../c11-fix/content-fix.ts
import { writeFileSync, existsSync } from 'node:fs';
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
const ID = 'b9a5249f-fc09-4121-b4de-512f2f4a9079';
const OLD = '有我照片参展的公司内部展览';
const NEW = '我有照片参展的公司内部展览';
const out = resolve(here, 'w5-0-fix.json');
if (existsSync(out)) { console.log(JSON.stringify({ key: 'w5-0', preserved: true })); process.exit(0); }

const { error: authError } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (authError) throw new Error(authError.message);
try {
  const { data: row, error } = await db.from('scenarios').select('*').eq('scenario_id', ID).single();
  if (error) throw new Error(error.message);
  if (row.mission_status !== 'generated') throw new Error(`mission_status=${row.mission_status}`);
  const before = row.mission_content?.provenance?.mission_content_hash ?? null;
  const mission = structuredClone(row.mission_content);
  const changes: Array<{ path: string; before: string; after: string }> = [];
  const rep = (obj: any, field: string, path: string) => {
    const cur = obj[field]; if (typeof cur !== 'string' || !cur.includes(OLD)) throw new Error(`${path}.${field}: expected «${OLD}»`);
    const next = cur.split(OLD).join(NEW); changes.push({ path: `${path}.${field}`, before: cur, after: next }); obj[field] = next;
  };
  const untouched = JSON.stringify({ situations: mission.mpj_items.map((it: any) => [it.situation_ko, it.pdr, it.highlights, it.accepted_band_codes ?? it.accepted_scale_codes ?? null]),
    unit: mission.unit, production: mission.production_task });
  for (const i of [1, 2, 3]) {
    const it = mission.mpj_items[i]; const path = `mpj_items[${i}]`;
    rep(it, 'target', path); rep(it, 'recommended_example', path);
    for (const [j, c] of (it.corrections ?? []).entries()) rep(c, 'text', `${path}.corrections[${j}]`);
  }
  if (JSON.stringify(mission).includes(OLD)) throw new Error('old phrase still present');
  const after = JSON.stringify({ situations: mission.mpj_items.map((it: any) => [it.situation_ko, it.pdr, it.highlights, it.accepted_band_codes ?? it.accepted_scale_codes ?? null]),
    unit: mission.unit, production: mission.production_task });
  if (untouched !== after) throw new Error('situation/pdr/highlights/bands/unit/production changed unexpectedly');
  const result = await promote.reviseMissionDraft(row, { itemBlocks: [1, 2, 3].map((itemIndex) => ({ itemIndex, item: mission.mpj_items[itemIndex] })) }, 'ai');
  const quality = result.quality as any;
  if (quality && quality.prompt_version !== CURRENT_MISSION_QUALITY_PROMPT_VERSION) throw new Error(`gate ran with ${quality.prompt_version}`);
  const { data: saved } = await db.from('scenarios').select('mission_content').eq('scenario_id', ID).single();
  const hash = saved?.mission_content?.provenance?.mission_content_hash ?? null;
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: 'w5-0', scenario_id: ID, before_hash: before, after_hash: hash, changes,
    revised: { ok: result.ok, error: result.error, ruleResult: result.ruleResult, violations: result.violations, quality },
    scope: 'Researcher-ruled last language fix before approval; not instructor approval.' }, null, 2) + '\n');
  console.log(JSON.stringify({ key: 'w5-0', changed: changes.length, ok: result.ok, verdict: quality?.verdict, hash: String(hash).slice(0, 8),
    findings: (quality?.findings ?? []).map((f: any) => `${f.severity}:${f.code}@${f.where}${(String(f.note_ko ?? '').match(/^\[[^\]]+\]/) ?? [''])[0]}`), rule: result.ruleResult, error: result.error }));
} finally { await supabase.auth.signOut({ scope: 'local' }); }
