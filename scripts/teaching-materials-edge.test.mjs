// Execute the actual Edge handler and shared domain with only Auth/DB/HTTP replaced.
// These are isolated contract tests, not paid generation or a deployed Edge smoke.
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { build } from 'esbuild';

let handler, releaseId, state, context, admin, fetches, saves, modelResult, saveError;
const originalFetch = globalThis.fetch;
const courseId = '10000000-0000-4000-8000-000000000001';
const missionId = '20000000-0000-4000-8000-000000000001';
const config = { missionIds: [missionId], extraText: '', extraRef: '' };
const content = { sections: ['review','comparison','discussion','reflection'].map(key => ({ key, title: key,
  paragraphs: ['관계와 부담을 살펴봅니다.'], items: ['판단 근거를 설명해 보세요.'], source_ids: ['M1'] })),
  instructor_notes: [{ title: '진행 안내', body: '서로 다른 해석의 근거를 확인합니다.', source_ids: ['M1'] }] };
const call = async (body, authorization = 'Bearer fixture') => {
  const response = await handler(new Request('https://fixture.invalid/teaching-materials', { method: 'POST',
    headers: authorization ? { Authorization: authorization } : {}, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
};
const input = action => ({ action, courseId, weekNo: 7, expectedRevision: state.draft?.revision ?? 0, config });

before(async () => {
  globalThis.Deno = { serve: fn => { handler = fn; }, env: { get: name => ({
    SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service', OPENAI_API_KEY: 'test-only-key',
  }[name]) } };
  globalThis.__teachingClient = (_url, key) => key === 'anon' ? {
    auth: { getUser: async () => ({ data: { user: { id: courseId } } }) },
    rpc: async name => { assert.equal(name, 'is_admin'); return { data: admin }; },
  } : { rpc: async (name, args) => {
    if (name === 'get_teaching_material_state') return { data: state };
    if (name === 'get_teaching_material_context') return { data: context };
    assert.equal(name, 'save_teaching_material'); saves.push(args);
    if (saveError) return { error: { message: saveError } };
    state = { current: true, draft: { revision: (state.draft?.revision ?? 0) + 1, source_config: args.p_config,
      content: args.p_content, provenance: args.p_provenance } };
    return { data: state.draft };
  } };
  const result = await build({ stdin: { contents: 'import "./supabase/functions/teaching-materials/index.ts"; export { CURRENT_CONTENT_RELEASE_ID } from "./supabase/functions/_shared/contentRelease.ts";',
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'test-services', setup(b) {
      b.onResolve({ filter: /^npm:@supabase\/supabase-js/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/cors')
        ? 'export const corsHeaders = {};' : 'export const createClient = (...args) => globalThis.__teachingClient(...args);' }));
    } }],
  });
  releaseId = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).CURRENT_CONTENT_RELEASE_ID;
});
beforeEach(() => {
  admin = true; state = { draft: null, current: true }; saves = []; fetches = []; saveError = null;
  context = { source_hash: 'a'.repeat(64), base: {
    outline: { id: courseId, title: '테스트 교과목', level: 'intermediate', language_direction: 'ko_zh', course_mode: 'mixed' },
    week: { week_no: 7, type: 'regular', title: '중간 메타화용 토론', can_do: ['판단 근거를 설명한다.'] }, assignments: [], scenarios: [],
  }, references: [{ scenario_id: missionId, week_no: 2, learner_level: 'intermediate', mission_status: 'reviewed', mode: 'translation',
    speech_act: 'request', content_release_id: releaseId, core_content: { direction: 'ko_zh', source_text: '파일을 보내 주세요.' },
    mission_content: { schema_version: 'mission_v5', mpj_items: [] } }] };
  modelResult = { id: 'response-fixture', model: 'model-fixture', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] };
  globalThis.fetch = async (url, request) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions'); fetches.push(JSON.parse(request.body));
    return Response.json(modelResult);
  };
});
after(() => { globalThis.fetch = originalFetch; delete globalThis.Deno; delete globalThis.__teachingClient; });

test('requires authenticated admin before reading or generating material', async () => {
  assert.equal((await call(input('preview'), null)).status, 401);
  admin = false; assert.equal((await call(input('preview'))).status, 403);
  assert.equal(fetches.length, 0); assert.equal(saves.length, 0);
});
test('preview is free; only the confirmed request is generated, saved and then editable', async () => {
  const preview = await call(input('preview')); assert.equal(preview.status, 200); assert.equal(fetches.length, 0);
  const generated = await call({ ...input('generate'), inputHash: preview.body.inputHash });
  assert.equal(generated.status, 200); assert.equal(generated.body.draft.revision, 1);
  assert.equal(fetches.length, 1); assert.deepEqual(saves[0].p_provenance.request, fetches[0]);
  assert.equal(fetches[0].response_format.json_schema.strict, true);
  const edited = structuredClone(content); edited.sections[0].paragraphs = ['교수자가 수정한 설명입니다.'];
  const saved = await call({ ...input('edit'), content: edited });
  assert.equal(saved.status, 200); assert.equal(saved.body.draft.revision, 2);
  assert.equal(saved.body.draft.provenance.edited, true); assert.equal(fetches.length, 1);
});
test('source or revision changes reject the request before paid generation', async () => {
  const preview = await call(input('preview')); context.source_hash = 'b'.repeat(64);
  assert.equal((await call({ ...input('generate'), inputHash: preview.body.inputHash })).status, 409);
  state.draft = { revision: 1 };
  assert.equal((await call({ ...input('preview'), expectedRevision: 0 })).status, 409);
  assert.equal(fetches.length, 0); assert.equal(saves.length, 0);
});
test('refusal, truncation or invalid content never saves or retries', async () => {
  const preview = await call(input('preview'));
  for (const choice of [
    { finish_reason: 'stop', message: { refusal: 'refused', content: '{}' } },
    { finish_reason: 'length', message: { content: '{}' } },
    { finish_reason: 'stop', message: { content: '{"sections":[]}' } },
  ]) {
    modelResult.choices = [choice];
    assert.ok((await call({ ...input('generate'), inputHash: preview.body.inputHash })).status >= 400);
  }
  assert.equal(saves.length, 0); assert.equal(fetches.length, 3); assert.equal(state.draft, null);
});
test('save-time conflict preserves existing state after a single model call', async () => {
  const preview = await call(input('preview')); saveError = 'Source changed; prepare again';
  const response = await call({ ...input('generate'), inputHash: preview.body.inputHash });
  assert.equal(response.status, 400); assert.match(response.body.error, /근거 자료가 변경/);
  assert.equal(fetches.length, 1); assert.equal(state.draft, null);
});
