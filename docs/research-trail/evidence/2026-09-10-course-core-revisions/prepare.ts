// Offline draft preparation for the sentence-level core corrections found in direct review.
// No DB connection and no model calls: copies each generated core, applies one text correction,
// then runs the real normalizeCore/checkCore. Prior AI verdicts do not certify edited text, so
// generation metadata is dropped and a fresh semantic check is required before any save.
// Run from the worktree root: npx.cmd vite-node docs/research-trail/evidence/2026-09-10-course-core-revisions/prepare.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCore } from '../../../../src/lib/pragma/coreSchema';
import { checkCore, type CheckContext } from '../../../../src/lib/pragma/missionRules';
import { CORE_LENGTH_POLICY_VERSION, coreLengthRange, countCoreEffectiveChars } from '../../../../supabase/functions/_shared/coreLengthPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, '../../../../.tmp/scene-grounding/scene_grounding_course_20260910');

/** One correction per finding in docs/dev-log/2026-09-10-course-core-review.md. Facts are not added. */
const EDITS: Record<string, { why: string; situation_ko?: string; focal_segments?: Array<{ text: string; role: 'head' | 'support' }> }> = {
  'w2-1': {
    why: 'situation_ko told the learner the register ("부담 없이 요청할 수 있는 상황"). Keep the notice as a fact, drop the evaluative steer.',
    situation_ko: '나는 처음 방문한 병원에서 접수 창구에 가서 예약 변경을 문의하려 한다. 안내문에는 변경 가능한 시간이 남아 있다고 적혀 있다.',
  },
  'w3-0': {
    why: 'situation_ko broke subject agreement ("나는 … 회원이 … 도움을 받았다"). Split into the helper\'s act and the speaker\'s intent; restore the seed\'s four boxes.',
    situation_ko: '동호회에서 몇 번 만난 회원이 주말에 내 이삿짐 상자 네 개를 삼십 분 동안 함께 옮겨 주었다. 나는 그 회원에게 메신저로 고마움을 전하려 한다.',
  },
  'w4-0': {
    why: 'Same subject-agreement break, and the support segment was a thanks clause. Support must modulate the compliment itself, so use the overall compliment sentence.',
    situation_ko: '동호회에서 몇 번 만난 회원이 내 졸업을 축하하며 직접 그린 꽃 카드 사진을 메신저로 보내 주었다. 나는 그 카드의 색 조합과 손글씨가 잘 어울린다고 칭찬하려 한다.',
    focal_segments: [
      { text: '색 조합이 아주 세련되고, 손글씨도 따뜻한 느낌이 잘 살아 있네요.', role: 'head' },
      { text: '보내 주신 꽃 카드 사진 정말 예뻐요.', role: 'support' },
    ],
  },
  'w5-0': {
    why: 'situation_ko put the invitation in the past ("초대했다") although the learner still has to produce it.',
    situation_ko: '나는 동호회에서 세 번 만난 회원에게 이번 토요일 오후 근처 공원에서 삼십 분 산책을 하자고 메신저로 초대하려 한다. 다른 회원 두 명도 함께 걷기로 했다.',
  },
  'w11-1': {
    why: 'situation_ko read unnaturally in Korean ("제안한 상황을 겪었다").',
    situation_ko: '이번 학기 내내 함께 과제를 해 온 조장이 리허설에서 발표 시간을 십 분 늘리자고 제안했다. 조장은 일정만 관리하고 평가 권한은 없으며, 나는 전체 발표 제한을 이유로 그 제안에 반대하려 한다.',
  },
};

const checks = [];
for (const [key, edit] of Object.entries(EDITS)) {
  const raw = readFileSync(resolve(sourceDir, `${key}-core.json`), 'utf8');
  const original = JSON.parse(raw.replace(/^﻿/, ''));
  const core = structuredClone(original.result.coreContent) as Record<string, unknown>;
  delete core.generation;
  delete core.provenance;
  delete core.hsk_lexical_audit;
  if (edit.situation_ko) core.situation_ko = edit.situation_ko;
  if (edit.focal_segments) core.focal_segments = edit.focal_segments;
  const cell = original.plan.cell;
  const range = coreLengthRange(cell.level, cell.mode);
  core.length_policy = { version: CORE_LENGTH_POLICY_VERSION, unit: 'effective_chars', ...range, actual: countCoreEffectiveChars(core.source_text as string) };
  const schema = normalizeCore(core);
  const context: CheckContext = {
    speech_act: cell.speech_act_ui, level: cell.level, domain: cell.domain,
    theme_code: cell.theme_code, topic_code: cell.topic_code, mode: cell.mode,
    direction: cell.direction, source_modality: core.source_modality as 'written' | 'spoken',
  };
  const rules = checkCore(core, context);
  writeFileSync(resolve(here, `${key}-draft.json`), JSON.stringify({
    status: 'local_unapproved_revision', author: 'Claude (FABLE)',
    original_scenario_id: original.result.scenarioId,
    original_artifact: `.tmp/scene-grounding/scene_grounding_course_20260910/${key}-core.json`,
    original_sha256: createHash('sha256').update(raw).digest('hex'),
    revision_reason: edit.why,
    review_required: 'Fresh semantic check of edited content, then promotion and whole-mission review. No approval or DB write performed.',
    plan: original.plan, coreContent: core,
  }, null, 2) + '\n');
  checks.push({ key, schema_ok: schema.ok, schema_error: schema.error?.issues, length: core.length_policy, rules });
}
writeFileSync(resolve(here, 'checks.json'), JSON.stringify({ scope: 'Offline schema and deterministic rules only; not semantic approval', checks }, null, 2) + '\n');
process.stdout.write(JSON.stringify(checks.map(c => ({ key: c.key, schema_ok: c.schema_ok, rules: c.rules.result, violations: c.rules.violations.length })), null, 2) + '\n');
if (checks.some(check => !check.schema_ok || !check.rules.ok)) process.exitCode = 1;
