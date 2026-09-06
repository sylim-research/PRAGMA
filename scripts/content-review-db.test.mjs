// Targeted PostgreSQL approval tests. No network, production data or model calls.
// Dependency tables/auth are fixtures; lineage, authoring trigger and QA SQL are real migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const adminId = '10000000-0000-4000-8000-000000000001';
const learnerId = '10000000-0000-4000-8000-000000000002';
const hash = 'a'.repeat(64);
const rationale = '원본과 지적을 확인하여 현재 내용의 수업 사용을 판단했습니다.';
const db = new PGlite({ extensions: { pgcrypto } });
const sqlFile = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

async function asRole(role, action, user = adminId) {
  assert.ok(['authenticated', 'service_role'].includes(role));
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [user, role]);
  await db.exec(`SET ROLE ${role}`);
  try { return await action(); } finally { await db.exec('RESET ROLE'); }
}
const admin = (action) => asRole('authenticated', action);
const learner = (action) => asRole('authenticated', action, learnerId);
const model = (stage, result) => ({ result, model: 'fixture-model', response_id: `fixture-${stage}`,
  prompt_version: `content_review_v2:${stage}`, input_hash: hash });
const finding = { id: 'claude-1', severity: 'warning', issue_ko: '교수자 확인 필요' };
const pass = { verdict: 'pass', findings: [] };

function draftContent() {
  const types = ['scale4', 'judge3', 'fix_choice', 'reason', 'multi_judge'];
  return { schema_version: 'mission_v5', direction: 'ko_zh',
    learning_goal: { kind: 'speech_act', speech_act: 'request' },
    contrast_plan: { version: 'contrast_plan_v1', mission_goal: 'integrated_speech_act', speech_act: 'request',
      item_slots: types.map((type, i) => ({ item_id: i + 1, item_type: type, item_focus: 'fixture-focus' })) },
    mpj_items: types.map((type, i) => ({ id: i + 1, type, axis_feature: 'fixture-focus', item_focus: 'fixture-focus',
      ...(i === 4 ? { candidates: ['within_band', 'within_band', 'too_direct', 'too_vague'].map((band) => ({ accepted_band_codes: [band] })) } : {}) })),
    authoring: { schema_version: 'mission_authoring_v1', stage: 'ai_draft', lineage_status: 'pending', repair_attempts: 0 },
    quality_check: pass,
    provenance: { prompt_version: 'mission_v5_mpj5_minidiscourse_v6_authoring', content_release_id: 'pragma_content_candidate_20260825_02_authoring' } };
}
function finalized(content) {
  return { ...content, authoring: { ...content.authoring, stage: 'professor_finalized', lineage_status: 'complete' },
    provenance: { ...content.provenance, mission_content_hash: hash }, hsk_lexical_audit: {}, item_lineage: {} };
}
async function mission(status = 'generated') {
  const id = randomUUID();
  const content = status === 'generated' ? draftContent() : finalized(draftContent());
  await db.query(`INSERT INTO scenarios (scenario_id, speech_act, mission_content, core_content, mission_status, mission_reviewed_by, mission_reviewed_at)
    VALUES ($1, 'request', $2, '{"situation_ko":"fixture"}', $3, $4, now())`, [id, content, status, adminId]);
  await db.query(`INSERT INTO mission_lineage_versions (scenario_id, version_no, stage, mission_content, actor_id)
    VALUES ($1, 1, 'generated', $2, $3)`, [id, content, adminId]);
  return { id, content };
}
async function review(targetId, kind = 'mission', openaiFail = false) {
  const sourceHash = await scalar("select content_review_source_internal($1, $2, $3)->>'source_hash'", [kind, targetId, kind === 'mission' ? 0 : 5]);
  const snapshot = { content: { public_material: { title: 'approved public handout', sections: [], missions: [] }, instructor_only: 'PRIVATE NOTES' } };
  const id = await scalar(`INSERT INTO content_review_runs
    (kind, target_id, week_no, source_hash, content_hash, criteria_version, snapshot, rules, openai_review, claude_review, adjudication, professor_decisions, created_by)
    VALUES ($1, $2, $3, $4, $5, 'content_review_v2', $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
  [kind, targetId, kind === 'mission' ? 0 : 5, sourceHash, hash, snapshot, pass,
    model('openai', openaiFail ? { verdict: 'fail', findings: [{ ...finding, id: 'openai-1', severity: 'fail' }] } : pass),
    model('claude', { verdict: 'warning', findings: [finding] }),
    model('adjudication', { decisions: [{ finding_id: finding.id, decision: 'reject', rationale_ko: rationale }] }),
    [{ finding_id: finding.id, decision: 'no_change', rationale_ko: rationale }], adminId]);
  return { id, snapshot };
}
const payload = (m, r, extra = {}) => ({ mission_content: finalized(m.content), review_id: r.id,
  review_content_hash: hash, professor_note: rationale, ...extra });
const finalize = (m, r, extra = {}) => admin(() => scalar('select finalize_reviewed_mission($1, $2)', [m.id, payload(m, r, extra)]));
const approve = (r, override = null) => admin(() => scalar('select approve_content_review($1, $2, $3, $4)', [r.id, hash, rationale, override]));
let legacy;

before(async () => {
  await db.exec(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${adminId}'), ('${learnerId}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() = '${adminId}'::uuid $$;
    CREATE FUNCTION public.has_completed_learner_profile() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() = '${learnerId}'::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE scenarios (scenario_id uuid PRIMARY KEY, speech_act text, learner_level text, domain text,
      industry_sector text, mode text, source_modality text, theme_code text, topic_code text, core_content jsonb,
      mission_content jsonb, mission_status text, mission_reviewed_by uuid, mission_reviewed_at timestamptz, updated_at timestamptz,
      CHECK (mission_status <> 'reviewed' OR (mission_reviewed_by IS NOT NULL AND mission_reviewed_at IS NOT NULL)));
    ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
    CREATE POLICY admin_scenarios ON scenarios TO authenticated USING (is_admin()) WITH CHECK (is_admin());
    GRANT ALL ON scenarios TO authenticated, service_role;
    CREATE TABLE curriculum_outlines (id uuid PRIMARY KEY, title text, status text);
    CREATE TABLE curriculum_weeks (outline_id uuid REFERENCES curriculum_outlines(id), week_no int, title text, PRIMARY KEY (outline_id, week_no));
    CREATE TABLE curriculum_week_scenarios (outline_id uuid REFERENCES curriculum_outlines(id), week_no int,
      scenario_id uuid REFERENCES scenarios(scenario_id), position int, slot_role text);
    GRANT SELECT ON curriculum_outlines, curriculum_weeks, curriculum_week_scenarios TO authenticated;`);
  await db.exec(await sqlFile('20260814205000_mission_lineage_versions.sql'));
  const authoring = await sqlFile('20260825033000_mission_authoring_pipeline.sql');
  await db.exec(authoring.slice(authoring.indexOf('CREATE OR REPLACE FUNCTION public.validate_mission_authoring_v1'),
    authoring.indexOf('CREATE OR REPLACE FUNCTION public.save_generated_mission')));
  legacy = await mission('reviewed');
  const migration = await sqlFile('20260827190000_content_review_workflow.sql');
  try { await db.exec(migration); }
  catch (error) {
    const line = migration.slice(0, Number(error.position)).split('\n').length;
    throw new Error(`QA migration line ${line}: ${error.message}`);
  }
  await db.exec(await sqlFile('20260905150000_instructor_review_experience.sql'));
  await db.exec(await sqlFile('20260906100000_focused_content_review.sql'));
});
after(async () => { await db.close(); });

const experience = (status = 'checked') => ({ version: 'instructor_experience_v1', active_seconds: 45,
  decisions: ['scene','mjt-0','mjt-1','mjt-2','mjt-3','mjt-4','recap','dct'].map((section, index) => ({ section, status: index === 0 ? status : 'checked', note: '' })) });
const saveExperience = (r, value) => scalar('select save_instructor_experience($1,$2,$3)', [r.id, hash, value]);

test('instructor experience is version-bound, admin-only, and blocks approval until holds are resolved', async () => {
  const m = await mission(); const r = await review(m.id);
  await learner(() => assert.rejects(saveExperience(r, experience()), /Only admins/));
  await admin(() => assert.rejects(saveExperience(r, { ...experience(), decisions: [experience().decisions[0], experience().decisions[0]] }), /Invalid/));
  await admin(() => saveExperience(r, experience('revision_required')));
  await assert.rejects(finalize(m, r), /revision or defer/);
  assert.equal(await scalar('select mission_status from scenarios where scenario_id = $1', [m.id]), 'generated');
  await assert.rejects(db.query('update content_review_runs set instructor_experience = null where id = $1', [r.id]), /Keep instructor experience/);
  await admin(() => saveExperience(r, { ...experience(), decisions: experience().decisions.slice(1) }));
  await assert.rejects(finalize(m, r), /Complete instructor experience/);
  await admin(() => saveExperience(r, experience()));
  assert.equal(await finalize(m, r), m.id);
  assert.equal(await scalar('select instructor_experience_by from content_review_runs where id = $1', [r.id]), adminId);
  await admin(() => assert.rejects(saveExperience(r, experience()), /immutable/));
});

test('changed source cannot reuse instructor observations and legacy approved evidence is unchanged', async () => {
  const m = await mission(); const r = await review(m.id);
  await db.query(`update scenarios set core_content = '{"situation_ko":"new source"}' where scenario_id = $1`, [m.id]);
  await admin(() => assert.rejects(saveExperience(r, experience()), /Content changed/));
  assert.equal(await scalar('select mission_status from scenarios where scenario_id = $1', [legacy.id]), 'reviewed');
});

test('admin writes and the old RPC cannot bypass QA; historical approved content is preserved', async () => {
  const m = await mission();
  await admin(async () => {
    await assert.rejects(db.query('select review_mission($1)', [m.id]), /permission denied/);
    await db.exec("select set_config('pragma.content_review_approved', 'true', false)");
    await assert.rejects(db.query(`UPDATE scenarios SET mission_status = 'reviewed', mission_content = $2 WHERE scenario_id = $1`,
      [m.id, finalized(m.content)]), /five-stage professor approval/);
    await assert.rejects(db.query(`INSERT INTO scenarios (scenario_id, speech_act, mission_status, mission_content, mission_reviewed_by, mission_reviewed_at)
      VALUES ($1, 'request', 'reviewed', $2, $3, now())`, [randomUUID(), finalized(m.content), adminId]), /five-stage professor approval/);
    assert.equal(await scalar('select mission_status from scenarios where scenario_id = $1', [legacy.id]), 'reviewed');
    await assert.rejects(db.query(`UPDATE scenarios SET core_content = '{}' WHERE scenario_id = $1`, [legacy.id]), /immutable/);
    await assert.rejects(db.query('DELETE FROM scenarios WHERE scenario_id = $1', [legacy.id]), /Keep approved mission history/);
  });
  // A privileged older wrapper/RPC must still hit the row trigger.
  await asRole('service_role', () => assert.rejects(db.query('select review_mission($1)', [m.id]), /five-stage professor approval/));
});

test('OpenAI fail needs explicit rationale; finalization links and freezes the approved evidence', async () => {
  const m = await mission(); const r = await review(m.id, 'mission', true);
  await assert.rejects(finalize(m, r), /explicit rationale for OpenAI/);
  assert.equal(await finalize(m, r, { openai_fail_override: rationale }), m.id);
  assert.equal(await scalar('select content_review_run_id from mission_lineage_versions where scenario_id = $1 order by version_no desc limit 1', [m.id]), r.id);
  assert.equal(await scalar('select openai_fail_override from content_review_runs where id = $1', [r.id]), rationale);
  await asRole('service_role', async () => {
    await assert.rejects(db.query("UPDATE content_review_runs SET openai_review = '{}' WHERE id = $1", [r.id]), /immutable/);
    await assert.rejects(db.query('DELETE FROM content_review_runs WHERE id = $1', [r.id]), /immutable/);
    await assert.rejects(db.query("UPDATE scenarios SET mission_content = '{}' WHERE scenario_id = $1", [m.id]), /immutable/);
  });
});

test('a failed lineage write rolls back both approval and scenario publication', async () => {
  const m = await mission(); const r = await review(m.id);
  await db.exec(`ALTER TABLE mission_lineage_versions ADD CONSTRAINT fixture_lineage_failure CHECK (content_review_run_id IS DISTINCT FROM '${r.id}'::uuid) NOT VALID`);
  try { await assert.rejects(finalize(m, r), /fixture_lineage_failure/); }
  finally { await db.exec('ALTER TABLE mission_lineage_versions DROP CONSTRAINT fixture_lineage_failure'); }
  assert.equal(await scalar('select approved_at from content_review_runs where id = $1', [r.id]), null);
  assert.equal(await scalar('select mission_status from scenarios where scenario_id = $1', [m.id]), 'generated');
});

test('missing/duplicate model output, unsettled professor decisions and stale content cannot be approved', async () => {
  const m = await mission(); const r = await review(m.id);
  const original = await scalar('select to_jsonb(r) from content_review_runs r where id = $1', [r.id]);
  for (const bad of [null, {}, model('adjudication', { decisions: [] }),
    model('adjudication', { decisions: [...original.adjudication.result.decisions, ...original.adjudication.result.decisions] })]) {
    await db.query('update content_review_runs set adjudication = $2 where id = $1', [r.id, bad]);
    await assert.rejects(finalize(m, r), /required quality evidence|four QA stages|Incomplete model review|Adjudicate every Claude/);
  }
  await db.query('update content_review_runs set adjudication = $2 where id = $1', [r.id, original.adjudication]);
  for (const decision of ['defer', 'revision_required']) {
    await admin(() => scalar('select save_content_review_decisions($1, $2, $3)', [r.id, hash, [{ finding_id: finding.id, decision, rationale_ko: rationale }]]));
    await assert.rejects(finalize(m, r), /revision or defer/);
  }
  await db.query('update content_review_runs set professor_decisions = $2 where id = $1', [r.id, original.professor_decisions]);
  await admin(() => db.query("update scenarios set core_content = '{\"situation_ko\":\"changed\"}' where scenario_id = $1", [m.id]));
  await assert.rejects(finalize(m, r), /Content changed/);
});

test('weekly approval requires current mission QA and exposes only the public approved snapshot', async () => {
  const m = await mission(); const r = await review(m.id); const courseId = randomUUID();
  await db.query("insert into curriculum_outlines values ($1, 'fixture course', 'published')", [courseId]);
  await db.query("insert into curriculum_weeks values ($1, 5, 'fixture week')", [courseId]);
  await db.query("insert into curriculum_week_scenarios values ($1, 5, $2, 1, 'required')", [courseId, m.id]);
  const beforeMissionApproval = await review(courseId, 'weekly_material');
  await assert.rejects(approve(beforeMissionApproval), /each assigned mission first/);
  await finalize(m, r);
  await assert.rejects(approve(beforeMissionApproval), /Content changed/);
  const w = await review(courseId, 'weekly_material', true);
  await assert.rejects(approve(w), /explicit rationale for OpenAI/);
  const publicRead = () => learner(() => scalar('select get_approved_weekly_material($1, 5)', [courseId]));
  assert.equal(await publicRead(), null);
  await approve(w, rationale);
  assert.deepEqual(await publicRead(), { reviewId: w.id, contentHash: hash, material: w.snapshot.content.public_material });
  await learner(async () => {
    assert.equal(await scalar('select count(*) from content_review_runs'), 0);
    await assert.rejects(db.query("select content_review_source_internal('weekly_material', $1, 5)", [courseId]), /permission denied/);
    await assert.rejects(db.query("select get_content_review_source('weekly_material', $1, 5)", [courseId]), /Admin required/);
  });
  await db.query("update curriculum_weeks set title = 'changed' where outline_id = $1", [courseId]);
  assert.equal(await publicRead(), null);
});

async function focusedReview(critical = false) {
  const m = await mission();
  m.content.provenance.mission_content_hash = hash;
  m.content.quality_check = { verdict: critical ? 'fail' : 'pass', summary_ko: '생성 점검', model: 'gpt-4.1',
    prompt_version: 'quality_fixture', checked_at: '2026-09-06T00:00:00Z', mission_content_hash: hash,
    findings: critical ? [{code:'band_mismatch',where:'mpj_items[1].target',severity:'fail',note_ko:'판정 확인'}] : [] };
  await db.query('update scenarios set mission_content=$2 where scenario_id=$1',[m.id,m.content]);
  const r = await review(m.id);
  const evidence = {mission_content_hash: hash, quality_check:m.content.quality_check};
  await db.query(`update content_review_runs set approval_policy='focused_v1', generation_quality=$2,
    openai_review=null,claude_review=null,adjudication=null,professor_decisions='[]' where id=$1`,[r.id,evidence]);
  return {m,r,evidence};
}

test('focused review reuses exact current generation evidence without inventing model outputs', async () => {
  const {m,r,evidence}=await focusedReview();
  await db.query('update content_review_runs set generation_quality=$2 where id=$1',[r.id,{...evidence,mission_content_hash:'b'.repeat(64)}]);
  await assert.rejects(finalize(m,r),/does not match/);
  await db.query('update content_review_runs set generation_quality=$2 where id=$1',[r.id,evidence]);
  assert.equal(await finalize(m,r),m.id);
  assert.equal(await scalar('select claude_review from content_review_runs where id=$1',[r.id]),null);
});

test('focused review retains human decisions and existing critical issue override', async () => {
  const {m,r}=await focusedReview(true);
  await assert.rejects(finalize(m,r),/Record every professor decision/);
  const decide=decision=>admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',[r.id,hash,[{finding_id:'generation-1',decision,rationale_ko:rationale}]]));
  await decide('defer');
  await assert.rejects(finalize(m,r),/Record every professor decision/);
  await decide('no_change');
  await assert.rejects(finalize(m,r),/unresolved critical/);
  assert.equal(await finalize(m,r,{issue_overrides:[{issue_index:0,code:'band_mismatch',where:'mpj_items[1].target',rationale_ko:rationale}]}),m.id);
});

test('requesting independent review makes that evidence required, while stale source remains blocked', async () => {
  const {m,r}=await focusedReview();
  await db.query('update content_review_runs set independent_review_requested=true where id=$1',[r.id]);
  await assert.rejects(finalize(m,r),/required quality evidence/);
  await db.query('update content_review_runs set claude_review=$2 where id=$1',[r.id,model('claude',pass)]);
  await db.query(`update scenarios set core_content='{"situation_ko":"changed"}' where scenario_id=$1`,[m.id]);
  await assert.rejects(finalize(m,r),/Content changed/);
});
