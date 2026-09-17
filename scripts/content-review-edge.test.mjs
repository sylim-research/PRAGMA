// Run the actual inspect handler; only Auth/DB and source-domain data are fixtures.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { build } from 'esbuild';

let handler;
let currentSource = 'unchanged-source';
const missionId = '20000000-0000-4000-8000-000000000001';
const courseId = '10000000-0000-4000-8000-000000000001';
const records = [{ id: 'historical', kind: 'mission', target_id: missionId, week_no: 0,
  source_hash: 'unchanged-source', content_hash: 'older-rule-catalog-hash',
  criteria_version: 'content_review_v3', approved_at: '2026-09-08T00:00:00Z' }];
function query() {
  let found = [...records];
  let patch = null;
  const q = {
    select: () => q, order: () => q, limit: () => q,
    insert: row => { records.push({ ...row }); return q; },
    update: values => { patch = values; return q; },
    eq: (key, value) => { found = found.filter(row => row[key] === value); return q; },
    is: (key, value) => { found = found.filter(row => (row[key] ?? null) === value); return q; },
    not: (key, _operator, value) => { found = found.filter(row => row[key] !== value); return q; },
    maybeSingle: async () => ({ data: found[0] ?? null }),
    then: resolve => {
      if (patch) for (const row of found) Object.assign(row, patch);
      return Promise.resolve({ data: found, error: null }).then(resolve);
    },
  };
  return q;
}
before(async () => {
  globalThis.Deno = { serve: fn => { handler = fn; }, env: { get: key => ({
    SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  }[key]) } };
  globalThis.__reviewClient = (_url, key) => key === 'anon' ? {
    auth: { getUser: async () => ({ data: { user: { id: courseId } } }) }, rpc: async () => ({ data: true }),
  } : { from: query, rpc: async (_name, args) => ({ data: { source: { scenario: { mission_content: {} } },
    source_hash: args.p_kind === 'mission' ? currentSource : 'weekly-source' } }) };
  const bundled = await build({ entryPoints: ['supabase/functions/content-review/index.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'review-services', setup(b) {
      b.onResolve({ filter: /^npm:@supabase\/supabase-js/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onResolve({ filter: /domain\.generated\.mjs$/ }, args => ({ path: args.path, namespace: 'domain' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/cors')
        ? 'export const corsHeaders = {};' : 'export const createClient = (...args) => globalThis.__reviewClient(...args);' }));
      b.onLoad({ filter: /.*/, namespace: 'domain' }, () => ({ contents: `
        export const missionFinalizationInput = () => ({});
        export const buildContentReviewDomain = kind => ({ snapshot: { criteria: { version: 'new-rules' } },
          rules: { verdict: 'pass', findings: [] }, dependencies: kind === 'weekly_material' ? ['${missionId}'] : [] });` }));
    } }],
  });
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
});
after(() => { delete globalThis.Deno; delete globalThis.__reviewClient; });
async function inspect() {
  const response = await handler(new Request('https://fixture.invalid/content-review', { method: 'POST',
    headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ action: 'inspect',
      target: { kind: 'weekly_material', targetId: courseId, weekNo: 2 } }) }));
  assert.equal(response.status, 200);
  return response.json();
}
test('unchanged approved mission remains a valid dependency after rule catalog changes', async () => {
  currentSource = 'unchanged-source';
  assert.deepEqual((await inspect()).dependencies, [{ id: missionId, approved: true }]);
});
test('changed mission source cannot reuse its historical approval', async () => {
  currentSource = 'changed-source';
  assert.deepEqual((await inspect()).dependencies, [{ id: missionId, approved: false }]);
});

async function missionCall(action) {
  const response = await handler(new Request('https://fixture.invalid/content-review', { method: 'POST',
    headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ action,
      target: { kind: 'mission', targetId: missionId } }) }));
  assert.equal(response.status, 200);
  return response.json();
}
/** A run started under an older rule engine, matching the current review version exactly. */
async function seedStaleRun(extra = {}) {
  currentSource = 'unchanged-source';
  const { contentHash, sourceHash } = await missionCall('inspect');
  const row = { id: 'stale', kind: 'mission', target_id: missionId, week_no: 0,
    source_hash: sourceHash, content_hash: contentHash, criteria_version: 'content_review_v3',
    rules: { verdict: 'fail', findings: [{ id: 'rule-1', severity: 'fail' }] }, ...extra };
  records.push(row);
  return row;
}
test('re-running the rules step records the current engine verdict, not the stored one', async () => {
  const row = await seedStaleRun();
  try {
    assert.equal((await missionCall('rules')).run.rules.verdict, 'pass');
    assert.equal(row.rules.verdict, 'pass');
  } finally { records.splice(records.indexOf(row), 1); }
});
test('a run whose finalization artifact is built keeps the verdict it was built on', async () => {
  const row = await seedStaleRun({ prepared_finalization: { mission: 'prepared' } });
  try {
    assert.equal((await missionCall('rules')).run.rules.verdict, 'fail');
  } finally { records.splice(records.indexOf(row), 1); }
});
