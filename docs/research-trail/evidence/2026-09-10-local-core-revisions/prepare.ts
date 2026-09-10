// Offline draft preparation; no DB connection or model calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCore } from '../../../../src/lib/pragma/coreSchema';
import { checkCore, type CheckContext } from '../../../../src/lib/pragma/missionRules';
import { CORE_LENGTH_POLICY_VERSION, coreLengthRange, countCoreEffectiveChars } from '../../../../supabase/functions/_shared/coreLengthPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const request = '오늘 오후에는 집에 없어 택배를 직접 받기 어렵습니다. 작은 상자를 대신 받아 댁 현관 안에 잠시 두어 주실 수 있을까요? 저녁 여섯 시에 찾아가겠습니다.';
const opposition = '我觉得通勤时间这一项需要保留。我们的研究关注通勤时间对课堂参与的影响，删掉这一项就很难分析两者的关系。';
const checks = [];
for (const key of ['w9-1', 'w2-0', 'pilot-reverse-opposition']) {
  const originalPath = resolve(here, '../2026-09-10-scene-grounding-confirmation-2', `${key}-core.json`);
  const raw = readFileSync(originalPath, 'utf8');
  const original = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const core = structuredClone(original.result.coreContent);
  // A previous AI verdict/lexical audit does not certify a human-edited draft.
  delete core.generation;
  delete core.provenance;
  delete core.hsk_lexical_audit;
  if (key === 'w9-1') {
    core.focal_segments = [
      { text: '기다리게 해서 정말 죄송합니다.', role: 'head' },
      { text: '앞으로는 이런 일 없도록 더 주의할게요.', role: 'support' },
    ];
  } else if (key === 'w2-0') {
    core.source_text = request;
    core.focal_segments = [
      { text: '작은 상자를 대신 받아 댁 현관 안에 잠시 두어 주실 수 있을까요?', role: 'head' },
      { text: '저녁 여섯 시에 찾아가겠습니다.', role: 'support' },
    ];
  } else {
    core.source_text = opposition;
    // Core R8 still requires a preceding turn; native MJT/DCT must absorb it into the scene.
    core.preceding_turn = '통학 시간 질문은 빼는 게 어떨까요?';
    core.focal_segments = [
      { text: '我觉得通勤时间这一项需要保留。', role: 'head' },
      { text: '删掉这一项就很难分析两者的关系。', role: 'support' },
    ];
  }
  const cell = original.plan.cell;
  const range = coreLengthRange(cell.level, cell.mode);
  core.length_policy = { version: CORE_LENGTH_POLICY_VERSION, unit: 'effective_chars', ...range, actual: countCoreEffectiveChars(core.source_text) };
  const schema = normalizeCore(core);
  const context: CheckContext = {
    speech_act: cell.speech_act_ui, level: cell.level, domain: cell.domain,
    theme_code: cell.theme_code, topic_code: cell.topic_code, mode: cell.mode,
    direction: cell.direction, source_modality: core.source_modality,
  };
  const rules = checkCore(core, context);
  const draft = {
    status: 'local_unapproved_revision', author: 'Codex',
    original_scenario_id: original.result.scenarioId,
    original_artifact: `../2026-09-10-scene-grounding-confirmation-2/${key}-core.json`,
    original_sha256: createHash('sha256').update(raw).digest('hex'),
    review_required: 'Fresh semantic check of edited content, instructor review, then whole MJT5+DCT1 review. No approval or DB write performed.',
    plan: original.plan, coreContent: core,
  };
  writeFileSync(resolve(here, `${key}-draft.json`), JSON.stringify(draft, null, 2) + '\n');
  checks.push({ key, schema_ok: schema.ok, schema_error: schema.error?.issues, length: core.length_policy, rules });
}
writeFileSync(resolve(here, 'checks.json'), JSON.stringify({ scope: 'Offline schema and deterministic rules only; not semantic approval', checks }, null, 2) + '\n');
process.stdout.write(JSON.stringify(checks, null, 2) + '\n');
if (checks.some(check => !check.schema_ok || !check.rules.ok)) process.exitCode = 1;
