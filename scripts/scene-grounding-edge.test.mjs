import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';

const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;
let handle;
const axes = ['speech_act', 'power', 'distance', 'burden', 'domain', 'industry', 'mode', 'context_spec',
  'referents', 'decision_authority', 'topic_seed', 'adjacency', 'participant_roles',
  'scene_source_alignment', 'learner_scene', 'scene_plausibility'];
const pass = () => ({ verdict: 'pass', axes: Object.fromEntries(axes.map(axis =>
  [axis, { verdict: 'pass', reason_ko: '명시된 사건의 사실과 일치함' }])) });
const plan = {
  feasible: true, reason_ko: '기존 파일을 보내 달라는 동료 간 요청이다.',
  observed_pdr: { p: 'equal', d: 'acquaintance', r: 'low' },
  scene_ko: '같은 수업을 듣는 동급생에게 발표 파일을 이메일로 보내 달라고 요청합니다. 한 학기 동안 함께 공부했고, 이미 공유하기로 한 파일을 보내면 됩니다.',
  relation_ko: '한 학기 동안 함께 공부한 동급생', speaker_role_ko: '자료가 필요한 학생',
  addressee_role_ko: '파일을 가진 동급생', p_evidence_ko: '동급생으로 평가·지시 권한이 없다.',
  d_evidence_ko: '한 학기 동안 함께 공부했다.', r_evidence_ko: '이미 공유하기로 한 파일을 보내는 일이다.',
};
const source = '지난 수업에서 함께 발표했던 자료가 필요해서 연락했어요. 공유하기로 한 발표 파일을 오늘 제 이메일로 보내 주실 수 있나요?';
const draft = { situation_ko: '모델이 장면을 바꾸면 안 됩니다.', relation_ko: '모델의 별도 관계',
  source_text: source, preceding_turn: null, brief_note_ko: '발표 파일 요청',
  focal_segments: [{ text: '공유하기로 한 발표 파일을 오늘 제 이메일로 보내 주실 수 있나요?', role: 'head' }] };
const core = { direction: 'ko_zh', speech_act: 'request', speech_act_ko: '요청',
  level: 'beginner_intermediate', level_ko: '입문·중급', domain: 'school', domain_ko: '학교',
  topic_code: 'class_materials', mode: 'translation', source_modality: 'written',
  pdr: { p: 'equal', d: 'acquaintance', r: 'low' }, is_response_act: false,
  situation_seed_ko: '동급생에게 이미 공유하기로 한 발표 파일을 보내 달라고 요청한다.' };

before(async () => {
  globalThis.Deno = { env: { get: key => ({ OPENAI_API_KEY: 'fixture', SUPABASE_URL: 'https://db.test',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture' })[key] } };
  const built = await build({ entryPoints: ['supabase/functions/generate-scenario/index.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, define: { 'import.meta.main': 'false' } });
  ({ handleGenerateScenario: handle } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`));
});
after(() => { globalThis.fetch = originalFetch; globalThis.Deno = originalDeno; });

async function invoke(outputs, input = { action: 'core', core }) {
  let calls = 0;
  const ledger = [];
  globalThis.fetch = async (url, init) => {
    if (url === 'https://db.test/rest/v1/llm_invocation_events') {
      ledger.push(JSON.parse(init.body)); return new Response(null, { status: 201 });
    }
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.ok(calls < outputs.length, 'unexpected extra model call');
    const output = outputs[calls++];
    if (output === 'unavailable') return new Response('{}', { status: 503 });
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }],
      model: JSON.parse(init.body).model, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  };
  const response = await handle(new Request('https://edge.test', { method: 'POST',
    body: JSON.stringify(input) }));
  return { status: response.status, data: await response.json(), calls, ledger };
}

test('infeasible roles stop before source generation', async () => {
  const result = await invoke([{ feasible: false, reason_ko: '조장이라는 직함만으로 평가 권한을 확인할 수 없습니다.' }]);
  assert.equal(result.calls, 1);
  assert.equal(result.data.stop_code, 'CORE_PREFLIGHT_HOLD');
  assert.equal(result.data.core_content, undefined);
});
test('semantic contradiction blocks a fully generated core even when overall verdict says pass', async () => {
  const check = pass(); check.axes.power = { verdict: 'fail', reason_ko: '실제 평가 권한이 없다.' };
  const result = await invoke([plan, draft, check]);
  assert.equal(result.calls, 3);
  assert.equal(result.data.stop_code, 'CORE_SEMANTIC_HOLD');
  assert.equal(result.data.core_content, undefined);
  assert.equal(result.data.core_draft.source_text, source);
});

test('a feasible summary cannot override observed first-contact distance', async () => {
  const result = await invoke([{ ...plan, observed_pdr: { ...plan.observed_pdr, d: 'formal' } }]);
  assert.equal(result.calls, 1);
  assert.equal(result.data.stop_code, 'CORE_PREFLIGHT_HOLD');
  assert.equal(result.data.core_content, undefined);
  assert.match(result.data.error, /d=formal/);
});
test('only a complete semantic pass returns the frozen scene with content-bound review evidence', async () => {
  const result = await invoke([plan, draft, pass()]);
  assert.equal(result.status, 200);
  assert.equal(result.calls, 3);
  assert.equal(result.data.core_content.situation_ko, plan.scene_ko);
  assert.equal(result.data.core_content.relation_ko, plan.relation_ko);
  assert.match(result.data.core_content.generation.semantic_check.core_content_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.ledger.map(row => row.operation), ['core_critic', 'core_generate', 'core_critic']);
  assert.ok(result.ledger.every(row => /^[a-f0-9]{64}$/.test(row.prompt_snapshot_hash)));
});
test('an unavailable semantic review preserves the draft and never releases it', async () => {
  const result = await invoke([plan, draft, 'unavailable']);
  assert.equal(result.data.stop_code, 'CORE_SEMANTIC_UNAVAILABLE');
  assert.equal(result.data.core_content, undefined);
  assert.equal(result.data.core_draft.source_text, source);
});
test('standalone review cannot turn a missing reason into a pass through response normalization', async () => {
  const check = pass(); check.axes.power.reason_ko = '';
  const result = await invoke([check], { action: 'core_quality_check', core_quality: {
    ...core, core_content: draft,
  } });
  assert.equal(result.data.core_quality_check.axes.power.verdict, 'warning');
  assert.equal(result.data.core_quality_check.verdict, 'warning');
});
