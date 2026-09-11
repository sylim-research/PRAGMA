// w12-0 follow-up: the C8 anchor/candidate fix left diagnostic_dimensions[1].evidence_ko (force_calibration) pointing
// at the removed devices («일정 문제 전반으로 책임을 넓히는», «심각한 운영상 누락으로 평가하는»); the official review flagged
// it (claude-4, accept). Only that one evidence sentence is aligned, through reviseMissionDraft (diagnosticDimensions
// edit, no item change) → new content_hash, new lineage version, production gate re-run. Result: w12-0-diag-fix.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/promoteMission'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const db = supabase as unknown as { from: (t: string) => any };
const ID = '97c4834a-ee4a-4691-a042-0255c8fadc4b';
const OLD = '확인된 예약 실수에 책임을 직접 귀속하는 표현, 회의실 초과 사용에서 일정 문제 전반으로 책임을 넓히는 표현, 작은 안내 오류를 심각한 운영상 누락으로 평가하는 표현을 대비한다.';
const NEW = '확인된 예약 실수에 책임을 직접 귀속하는 표현, 회의실 초과 사용의 모든 원인을 상대 개인에게 몰아 붙이는 표현, 작은 안내 오류의 책임을 ‘都是因为你…害得’로 추궁하는 표현을 대비한다.';

const out = resolve(here, 'w12-0-diag-fix.json');
if (existsSync(out)) { console.log('preserved'); process.exit(0); }
const { error: authError } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (authError) throw new Error(authError.message);
try {
  const { data: row, error } = await db.from('scenarios').select('*').eq('scenario_id', ID).single();
  if (error) throw new Error(error.message);
  if (row.mission_status !== 'generated') throw new Error(`mission_status=${row.mission_status}`);
  const dims = structuredClone(row.mission_content.diagnostic_dimensions);
  const fc = dims.find((d: any) => d.code === 'force_calibration');
  if (fc?.evidence_ko !== OLD) throw new Error('force_calibration evidence_ko unexpected');
  fc.evidence_ko = NEW;
  const result = await promote.reviseMissionDraft(row, { itemBlocks: [], diagnosticDimensions: dims }, 'ai');
  const revised = { ok: result.ok, error: result.error, ruleResult: result.ruleResult, violations: result.violations, quality: result.quality,
    reason_findings: (result.quality?.findings ?? []).filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? '')).length };
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: 'w12-0', scenario_id: ID, mode: 'mission', changes: [{ path: 'diagnostic_dimensions[force_calibration].evidence_ko', before: OLD, after: NEW }], revised,
    scope: 'Follow-up to c8-fix w12-0: diagnostic evidence aligned with the emphasis-only over_attributed devices; not instructor approval.' }, null, 2) + '\n');
  console.log(JSON.stringify({ key: 'w12-0', ok: revised.ok, verdict: revised.quality?.verdict, rule: revised.ruleResult, reason_findings: revised.reason_findings, error: revised.error }));
} finally { await supabase.auth.signOut({ scope: 'local' }); }
