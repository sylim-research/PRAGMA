// Offline draft preparation for the opposition core, revision 2. No DB connection or model calls.
// Builds pilot-reverse-opposition-draft-v2.json from the Codex draft (v1) and re-runs the same
// schema/rule checks. v1 stays untouched as history.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCore } from '../../../../src/lib/pragma/coreSchema';
import { checkCore, type CheckContext } from '../../../../src/lib/pragma/missionRules';
import { CORE_LENGTH_POLICY_VERSION, coreLengthRange, countCoreEffectiveChars } from '../../../../supabase/functions/_shared/coreLengthPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const v1Path = resolve(here, 'pilot-reverse-opposition-draft.json');
const v1Raw = readFileSync(v1Path, 'utf8');
const v1 = JSON.parse(v1Raw.replace(/^﻿/, ''));

// Advanced zh→ko translation source: disagreement preface + position + seed-bound reasoning +
// group-addressed request to reconsider. No facts beyond the seed (group chat, one semester
// together, survey item on commute time, research on commute time → class participation).
const opposition =
  '关于通勤时间这一项，我的看法有点不一样，我觉得还是需要保留。我们这次研究关注的就是通勤时间对课堂参与的影响，如果把这一项删掉，后面就很难分析两者之间的关系了。这一点大家再考虑一下，好吗？';

const core = structuredClone(v1.coreContent);
core.source_text = opposition;
core.focal_segments = [
  { text: '我的看法有点不一样，我觉得还是需要保留。', role: 'head' },
  { text: '这一点大家再考虑一下，好吗？', role: 'support' },
];
const cell = v1.plan.cell;
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
  ...v1,
  status: 'local_unapproved_revision',
  author: 'Claude (FABLE) on Codex draft v1',
  revision: 2,
  revision_basis: 'pilot-reverse-opposition-draft.json',
  revision_basis_sha256: createHash('sha256').update(v1Raw).digest('hex'),
  revision_reason: 'v1 source was 48 effective chars against the advanced translation range 80-110 (R29 warning). v2 adds a disagreement preface, seed-bound reasoning, and a group-addressed reconsideration request; no facts beyond the seed.',
  coreContent: core,
};
writeFileSync(resolve(here, 'pilot-reverse-opposition-draft-v2.json'), JSON.stringify(draft, null, 2) + '\n');
const check = { key: 'pilot-reverse-opposition-v2', schema_ok: schema.ok, schema_error: schema.error?.issues, length: core.length_policy, rules };
writeFileSync(resolve(here, 'checks-opposition-v2.json'), JSON.stringify({ scope: 'Offline schema and deterministic rules only; not semantic approval', checks: [check] }, null, 2) + '\n');
process.stdout.write(JSON.stringify(check, null, 2) + '\n');
if (!schema.ok || !rules.ok) process.exitCode = 1;
