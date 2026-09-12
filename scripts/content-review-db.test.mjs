// Targeted PostgreSQL approval tests. No network, production data or model calls.
// Dependency tables/auth are fixtures; lineage, authoring trigger and QA SQL are real migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { buildContentReviewDomain } from '../supabase/functions/content-review/domain.generated.mjs';

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
const model = (stage, result, version = 'content_review_v2') => ({ result, model: 'fixture-model', response_id: `fixture-${stage}`,
  prompt_version: `${version}:${stage}`, input_hash: hash });
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
async function review(targetId, kind = 'mission', openaiFail = false, weekNo = 5, version = 'content_review_v2') {
  const sourceHash = await scalar("select content_review_source_internal($1, $2, $3)->>'source_hash'", [kind, targetId, kind === 'mission' ? 0 : weekNo]);
  const snapshot = { content: { public_material: { title: 'approved public handout', sections: [], missions: [] }, instructor_only: 'PRIVATE NOTES' } };
  const id = await scalar(`INSERT INTO content_review_runs
    (kind, target_id, week_no, source_hash, content_hash, criteria_version, snapshot, rules, openai_review, claude_review, adjudication, professor_decisions, created_by)
    VALUES ($1, $2, $3, $4, $5, $13, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
  [kind, targetId, kind === 'mission' ? 0 : weekNo, sourceHash, hash, snapshot, pass,
    model('openai', openaiFail ? { verdict: 'fail', findings: [{ ...finding, id: 'openai-1', severity: 'fail' }] } : pass, version),
    model('claude', { verdict: 'warning', findings: [finding] }, version),
    model('adjudication', { decisions: [{ finding_id: finding.id, decision: 'reject', rationale_ko: rationale }] }, version),
    [{ finding_id: finding.id, decision: 'no_change', rationale_ko: rationale }], adminId, version]);
  return { id, snapshot };
}
const payload = (m, r, extra = {}) => ({ mission_content: finalized(m.content), review_id: r.id,
  review_content_hash: hash, professor_note: rationale, ...extra });
const finalize = (m, r, extra = {}) => admin(() => scalar('select finalize_reviewed_mission($1, $2)', [m.id, payload(m, r, extra)]));
const approve = (r, override = null) => admin(() => scalar('select approve_content_review($1, $2, $3, $4)', [r.id, hash, rationale, override]));
let legacy;
let preUpgradeTeaching;

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
    CREATE TABLE curriculum_weeks (outline_id uuid REFERENCES curriculum_outlines(id), week_no int, title text, type text DEFAULT 'regular', speech_act text, can_do jsonb, PRIMARY KEY (outline_id, week_no));
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
  await db.exec(await sqlFile('20260908210000_weekly_teaching_materials.sql'));
  const existing = await teachingFixture();
  const existingDraft = await existing.save(0);
  preUpgradeTeaching = { courseId:existing.courseId, weekNo:existing.weekNo, draft:existingDraft,
    reviewSource:await scalar("select content_review_source_internal('weekly_material',$1,$2)",[existing.courseId,existing.weekNo]) };
  await db.exec(await sqlFile('20260909010000_source_teaching_studio.sql'));
  await db.exec(await sqlFile('20260909230000_quality_signal_review_flow.sql'));
  // Every test below runs on the v3-compatible approval contract; the v2 tests above double as compatibility checks.
  await db.exec(await sqlFile('20260912090000_content_review_v3_approval.sql'));
  await db.exec(await sqlFile('20260912140000_content_review_gate_rebind.sql'));
});
after(async () => { await db.close(); });

test('v2 migration preserves the existing v1 draft, current state and review hash', async () => {
  const {courseId,weekNo,draft,reviewSource}=preUpgradeTeaching;
  const current=await admin(()=>scalar('select get_teaching_material_state($1,$2)',[courseId,weekNo]));
  assert.equal(current.current,true);assert.deepEqual(current.draft,draft);
  assert.deepEqual(await scalar("select content_review_source_internal('weekly_material',$1,$2)",[courseId,weekNo]),reviewSource);
});

test('source-only drafts persist without assigned missions; source and curriculum changes invalidate their revision', async () => {
  const id=randomUUID();
  await db.query("insert into curriculum_outlines values ($1,'source fixture','published')",[id]);
  await db.query("insert into curriculum_weeks(outline_id,week_no,title,speech_act,can_do) values ($1,2,'요청','request','[\"요청 근거\"]'),($1,7,'토론',null,'[\"근거 비교\"]')",[id]);
  const config={workflow:'source',missionIds:[],extraText:'',extraRef:'',outputKind:'discussion',focus:'선택권',activityMode:'pair',
    sources:[{id:'S1',label:'자료',ref:'검증 출처',kind:'text',text:'PRIVATE_SOURCE 본문',confirmed:true,
      extraction:{method:'manual_text',detail:'직접 입력',extractedCharacters:17,warnings:[]}}]};
  const context=await admin(()=>scalar('select get_teaching_material_context($1,2,$2)',[id,config]));
  assert.equal(context.references.length,0);assert.equal(context.base.scope_weeks[0].speech_act,'request');
  const content={sections:['review','comparison','discussion','reflection'].map(key=>({key,title:key,paragraphs:['public'],items:[],source_ids:['S1'],evidence:[{source_id:'S1',quote:'본문'}]})),
    instructor_notes:[{title:'teacher',body:'PRIVATE_NOTES',source_ids:['S1']}]};
  const save=(revision,sourceHash=context.source_hash)=>asRole('service_role',()=>scalar('select save_teaching_material($1,2,$2,$3,$4,$5,$6,$7,$8)',
    [id,revision,sourceHash,config,config.sources,content,{prompt_version:'source_teaching_v2',response_id:'fixture',model:'fixture',input_hash:hash},adminId]));
  const draft=await save(0);assert.equal(draft.kind,'discussion');assert.equal(draft.revision,1);
  assert.equal((await admin(()=>scalar('select get_teaching_material_state($1,2)',[id]))).current,true);
  const checked=buildContentReviewDomain('weekly_material',{...context.base,teaching_draft:draft,teaching_current:true,teaching_references:[]});
  assert.equal(checked.rules.verdict,'fail');
  assert.ok(checked.rules.findings.some(f=>f.issue_ko.includes('미션 2개')));
  const blockedReview=await review(id,'weekly_material',false,2);
  await db.query('update content_review_runs set rules=$2 where id=$1',[blockedReview.id,checked.rules]);
  await assert.rejects(approve(blockedReview),/required quality evidence/);
  assert.equal(await learner(()=>scalar('select get_approved_weekly_material($1,2)',[id])),null);
  await learner(async()=>{assert.equal(await scalar('select count(*) from weekly_teaching_materials where outline_id=$1',[id]),0);
    await assert.rejects(scalar('select get_teaching_material_state($1,2)',[id]),/Admin required/);});
  await assert.rejects(save(0),/Draft changed/);
  config.sources[0].text+=' 변경';await assert.rejects(save(1),/Source changed/);config.sources[0].text='PRIVATE_SOURCE 본문';
  const discussion=await admin(()=>scalar('select get_teaching_material_context($1,7,$2)',[id,config]));
  await db.query("update curriculum_weeks set can_do='[\"수정한 목표\"]' where outline_id=$1 and week_no=2",[id]);
  assert.equal((await admin(()=>scalar('select get_teaching_material_state($1,2)',[id]))).current,false);
  assert.notEqual((await admin(()=>scalar('select get_teaching_material_context($1,7,$2)',[id,config]))).source_hash,discussion.source_hash);
  config.sources[0].confirmed=false;await assert.rejects(admin(()=>scalar('select get_teaching_material_context($1,2,$2)',[id,config])),/Confirm source/);
});

async function teachingFixture(weekNo = 7, count = 1) {
  const m = await mission(); const r = await review(m.id); await finalize(m, r);
  const missions = [m];
  for (let i = 1; i < count; i++) { const next = await mission(); await finalize(next, await review(next.id)); missions.push(next); }
  const courseId = randomUUID();
  await db.query("insert into curriculum_outlines values ($1,'teaching fixture','published')", [courseId]);
  await db.query("insert into curriculum_weeks(outline_id,week_no,title) values ($1,2,'요청'),($1,$2,'메타화용 토론')", [courseId,weekNo]);
  for (const [index, item] of missions.entries()) await db.query("insert into curriculum_week_scenarios values ($1,$2,$3,$4,'required')",
    [courseId, [7,14].includes(weekNo) ? 2 : weekNo, item.id, index]);
  const config = { missionIds: missions.map(item => item.id), extraText: '', extraRef: '' };
  const context = () => admin(() => scalar('select get_teaching_material_context($1,$2,$3)',[courseId,weekNo,config]));
  const source = await context();
  const keys = [7,14].includes(weekNo) ? ['review','comparison','discussion','reflection'] : ['concept','comparison','practice','faq'];
  const content = { sections: keys.map((key) => ({ key,title:key,paragraphs:['public'],items:[],source_ids:['M1'] })),
    instructor_notes: [{ title:'teacher',body:'PRIVATE_TEACHING_NOTE',source_ids:['M1'] }] };
  const save = (expectedRevision, sourceHash = source.source_hash) => asRole('service_role', () => scalar(
    'select save_teaching_material($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [courseId,weekNo,expectedRevision,sourceHash,config,[{ id:'M1',label:'근거',text:'PRIVATE_SOURCE' }],content,
      { prompt_version:'weekly_teaching_v1',response_id:'fixture',model:'fixture',input_hash:hash },adminId]));
  return { m, courseId, weekNo, config, context, source, save };
}

test('teaching sources are course/week bounded and drafts are admin-only, append-only, revision checked', async () => {
  const f = await teachingFixture();
  const before = await scalar("select content_review_source_internal('weekly_material',$1,$2)",[f.courseId,f.weekNo]);
  const base = await scalar("select content_review_base_source_internal('weekly_material',$1,$2)",[f.courseId,f.weekNo]);
  assert.deepEqual(before,base);
  await learner(() => assert.rejects(scalar('select get_teaching_material_context($1,$2,$3)',[f.courseId,f.weekNo,f.config]),/Admin required/));
  await learner(() => assert.rejects(scalar('select get_teaching_material_state($1,$2)',[f.courseId,f.weekNo]),/Admin required/));
  const first = await f.save(0); assert.equal(first.revision,1);
  await assert.rejects(f.save(0),/Draft changed/);
  await asRole('service_role', () => assert.rejects(db.query('delete from weekly_teaching_materials where id=$1',[first.id]),/permission denied/));
  await learner(async () => {
    assert.equal(await scalar('select count(*) from weekly_teaching_materials'),0);
    await assert.rejects(db.query('insert into weekly_teaching_materials default values'),/permission denied/);
  });
  const unrelated = await mission();
  const other = await admin(() => scalar('select get_teaching_material_context($1,$2,$3)',[f.courseId,f.weekNo,{...f.config,missionIds:[unrelated.id]}]));
  assert.deepEqual(other.references,[]);
  await db.query("insert into curriculum_week_scenarios values ($1,9,$2,0,'required')",[f.courseId,unrelated.id]);
  const future = await admin(() => scalar('select get_teaching_material_context($1,$2,$3)',[f.courseId,7,{...f.config,missionIds:[unrelated.id]}]));
  assert.deepEqual(future.references,[]);
  await assert.rejects(admin(() => scalar('select get_teaching_material_context($1,15,$2)',[f.courseId,f.config])),/Course week not found|Only lesson/);
});

test('new teaching revisions invalidate approval; public RPC never returns teacher notes or sources', async () => {
  const f = await teachingFixture(); await f.save(0);
  const w = await review(f.courseId,'weekly_material',false,f.weekNo);
  const read = () => learner(() => scalar('select get_approved_weekly_material($1,$2)',[f.courseId,f.weekNo]));
  assert.equal(await read(),null);
  await approve(w);
  assert.deepEqual((await read()).material,w.snapshot.content.public_material);
  assert.ok(!JSON.stringify(await read()).includes('PRIVATE'));
  await f.save(1);
  assert.equal(await read(),null);
  assert.notEqual(await scalar('select approved_at from content_review_runs where id=$1',[w.id]),null);
});

test('changed prior-week source prevents saving and marks the existing discussion draft stale', async () => {
  const f = await teachingFixture(14); await f.save(0);
  await db.query('delete from curriculum_week_scenarios where outline_id=$1 and scenario_id=$2',[f.courseId,f.m.id]);
  await assert.rejects(f.save(1),/Source changed/);
  const state = await admin(() => scalar('select get_teaching_material_state($1,$2)',[f.courseId,f.weekNo]));
  assert.equal(state.current,false); assert.equal(state.draft.revision,1);
  const w = await review(f.courseId,'weekly_material',false,f.weekNo);
  await assert.rejects(approve(w),/Teaching source changed/);
});

test('lesson pair can be approved and edited revisions require a fresh approval', async () => {
  const f = await teachingFixture(5, 2);
  assert.equal(f.source.references.length, 2);
  assert.equal((await f.save(0)).kind, 'lesson');
  const read = () => learner(() => scalar('select get_approved_weekly_material($1,$2)', [f.courseId,f.weekNo]));
  const first = await review(f.courseId,'weekly_material',false,f.weekNo); await approve(first);
  assert.ok(await read()); assert.ok(!JSON.stringify(await read()).includes('PRIVATE'));
  await f.save(1); assert.equal(await read(), null);
  const second = await review(f.courseId,'weekly_material',false,f.weekNo); await approve(second);
  assert.equal((await read()).reviewId, second.id);
});

test('six discussion sources persist while duplicate IDs and oversized source fields are rejected', async () => {
  const f = await teachingFixture(7, 6);
  assert.equal(f.source.references.length, 6); await f.save(0);
  f.config.missionIds[5] = f.config.missionIds[0];
  const duplicate = await f.context();
  await assert.rejects(f.save(1, duplicate.source_hash), /Choose current assigned reviewed missions/);
  f.config.extraText = 'a'.repeat(12000); f.config.extraRef = 'b'.repeat(500);
  await f.context();
  f.config.extraText += 'a'; await assert.rejects(f.context(), /Invalid source selection/);
  f.config.extraText = 'a'; f.config.extraRef += 'b'; await assert.rejects(f.context(), /Invalid source selection/);
});

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
  await db.query("insert into curriculum_weeks(outline_id,week_no,title) values ($1, 5, 'fixture week')", [courseId]);
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

async function focusedReview(critical = false, version = 'content_review_v2') {
  const m = await mission();
  m.content.provenance.mission_content_hash = hash;
  m.content.quality_check = { verdict: critical ? 'fail' : 'pass', summary_ko: '생성 점검', model: 'gpt-4.1',
    prompt_version: 'quality_fixture', checked_at: '2026-09-06T00:00:00Z', mission_content_hash: hash,
    findings: critical ? [{code:'band_mismatch',where:'mpj_items[1].target',severity:'fail',note_ko:'판정 확인'}] : [] };
  await db.query('update scenarios set mission_content=$2 where scenario_id=$1',[m.id,m.content]);
  const r = await review(m.id, 'mission', false, 5, version);
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

test('signal flow requires prepared evidence and reasoned decisions, then approves that exact artifact', async () => {
  const {m,r}=await focusedReview();
  const signals=[
    {id:'rule-core-1',severity:'warning',needs_professor:true,issue_ko:'R9/nationalization_cue: 합성 신호'},
    {id:'rule-2',severity:'warning',needs_professor:true,issue_ko:'R32/unattributed_over_reference_ratio: 합성 100% 미귀속'},
  ];
  await db.query("update content_review_runs set snapshot=jsonb_set(snapshot,'{criteria}',$2),rules=$3 where id=$1",
    [r.id,{finalization:'mission_finalization_v1'},{verdict:'warning',findings:signals}]);
  await assert.rejects(finalize(m,r),/Prepare final review evidence/);
  await assert.rejects(approve(r),/Prepare final review evidence/);
  const prepared=finalized(m.content);
  prepared.item_lineage={coverage_summary:{total_count:5,claimed_count:0,unattributed_count:5}};
  await modelRoleSetPrepared(r.id,prepared);
  assert.deepEqual((await scalar('select content_review_required_findings(r) from content_review_runs r where id=$1',[r.id])).map(f=>f.id),signals.map(f=>f.id));
  const decisions=signals.map(f=>({finding_id:f.id,decision:'no_change',rationale_ko:rationale}));
  const save=items=>admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',[r.id,hash,items]));
  await assert.rejects(save(decisions.slice(1)),/Record every professor decision/);
  await save([{...decisions[0],decision:'defer'},decisions[1]]);
  await assert.rejects(finalize(m,r,{mission_content:prepared}),/Record every professor decision/);
  await save(decisions);
  await assert.rejects(finalize(m,r),/exact professor-reviewed artifact/);
  await assert.rejects(modelRoleSetPrepared(r.id,{...prepared,hsk_lexical_audit:{changed:true}}),/Prepared review evidence is immutable/);
  assert.equal(await finalize(m,r,{mission_content:prepared}),m.id);
  // The RPC appends the professor's disposition metadata, without regenerating content or attribution.
  assert.deepEqual(await scalar('select mission_content from scenarios where scenario_id=$1',[m.id]),
    {...prepared,authoring:{...prepared.authoring,professor_issue_overrides:[]}});
  assert.ok(await scalar('select approved_at from content_review_runs where id=$1',[r.id]));
  await assert.rejects(modelRoleSetPrepared(r.id,prepared),/Approved review evidence is immutable/);
});

const decideGeneration=(r,decision,reviewHash=hash)=>admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',
  [r.id,reviewHash,[{finding_id:'generation-1',decision,rationale_ko:rationale}]]));
const criticalOverride=(text=rationale)=>({issue_overrides:[{issue_index:0,code:'band_mismatch',where:'mpj_items[1].target',rationale_ko:text}]});

test('v3: a current-hash review saves professor decisions and finalizes under the unchanged approval rules', async () => {
  const {m,r}=await focusedReview(true,'content_review_v3');
  await assert.rejects(finalize(m,r),/Record every professor decision/);      // unresolved critical finding blocks
  await decideGeneration(r,'defer');                                           // decisions save on a v3 review
  await assert.rejects(finalize(m,r),/Record every professor decision/);      // defer is never approvable
  await decideGeneration(r,'no_change');
  await assert.rejects(finalize(m,r),/unresolved critical/);                   // missing override blocks
  await assert.rejects(finalize(m,r,criticalOverride('짧은 사유')),/unresolved critical/); // too-short override blocks
  assert.equal(await finalize(m,r,criticalOverride()),m.id);
  assert.equal(await scalar('select mission_status from scenarios where scenario_id=$1',[m.id]),'reviewed');
  assert.equal(await scalar('select criteria_version from content_review_runs where id=$1 and approved_at is not null',[r.id]),'content_review_v3');
  assert.equal(await scalar('select content_review_run_id from mission_lineage_versions where scenario_id=$1 order by version_no desc limit 1',[m.id]),r.id);
  const stored=await scalar("select mission_content#>'{authoring,professor_issue_overrides}' from scenarios where scenario_id=$1",[m.id]);
  assert.equal(stored[0].rationale_ko,rationale);
});

test('v3: review/content hash mismatch and a changed source stay blocked', async () => {
  const {m,r}=await focusedReview(false,'content_review_v3');
  await assert.rejects(finalize(m,r,{review_content_hash:'b'.repeat(64)}),/required quality evidence/);
  await assert.rejects(decideGeneration(r,'no_change','b'.repeat(64)),/required quality evidence/);
  await db.query(`update scenarios set core_content='{"situation_ko":"changed"}' where scenario_id=$1`,[m.id]);
  await assert.rejects(finalize(m,r),/Content changed/);
});

test('unsupported criteria versions are never decided, approved or accepted by the scenario guard', async () => {
  const {m,r}=await focusedReview(false,'content_review_v4');
  await assert.rejects(admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',[r.id,hash,[]])),/required quality evidence/);
  await assert.rejects(finalize(m,r),/required quality evidence/);
  // Even a directly written approval of an unsupported version cannot publish the mission.
  await db.query('update content_review_runs set approved_at=now(), approved_by=$2 where id=$1',[r.id,adminId]);
  await admin(()=>assert.rejects(db.query(`UPDATE scenarios SET mission_status='reviewed', mission_content=$2 WHERE scenario_id=$1`,
    [m.id,finalized(m.content)]),/five-stage professor approval/));
  // Control: the same direct write with a supported version is accepted, so the guard discriminates by version.
  const control=await focusedReview(false,'content_review_v3');
  await db.query('update content_review_runs set approved_at=now(), approved_by=$2 where id=$1',[control.r.id,adminId]);
  await admin(()=>db.query(`UPDATE scenarios SET mission_status='reviewed', mission_content=$2 WHERE scenario_id=$1`,
    [control.m.id,finalized(control.m.content)]));
  assert.equal(await scalar('select mission_status from scenarios where scenario_id=$1',[control.m.id]),'reviewed');
});

test('v3 weekly material: unapproved stays hidden; the approved current v3 snapshot wins over a later v2 approval', async () => {
  const m=await mission(); await finalize(m,await review(m.id,'mission',false,5,'content_review_v3'));
  const courseId=randomUUID();
  await db.query("insert into curriculum_outlines values ($1,'v3 course','published')",[courseId]);
  await db.query("insert into curriculum_weeks(outline_id,week_no,title) values ($1,5,'v3 week')",[courseId]);
  await db.query("insert into curriculum_week_scenarios values ($1,5,$2,1,'required')",[courseId,m.id]);
  const read=()=>learner(()=>scalar('select get_approved_weekly_material($1,5)',[courseId]));
  const older=await review(courseId,'weekly_material',false,5,'content_review_v2');
  const current=await review(courseId,'weekly_material',false,5,'content_review_v3');
  assert.equal(await read(),null);                            // nothing approved yet
  await approve(current);                                     // mission dependency was approved under v3
  assert.deepEqual(await read(),{reviewId:current.id,contentHash:hash,material:current.snapshot.content.public_material});
  await approve(older);                                       // a v2 approval of the same source, approved later
  assert.equal((await read()).reviewId,current.id);           // stale v2 never shadows the current v3 approval
  assert.ok(!JSON.stringify(await read()).includes('PRIVATE'));
});

async function modelRoleSetPrepared(id,prepared) {
  return asRole('service_role',()=>db.query('update content_review_runs set prepared_finalization=$2 where id=$1',[id,prepared]));
}

// ── Gate provenance rebind (2026-09-12) ──
// A gate re-run replaces only mission_content.quality_check. The instructional content, its mission_content_hash
// and the review source/content hashes are unchanged, so the stored review keeps the earlier gate and approval
// correctly refuses it. The rebind carries that review's semantic evidence onto a new row bound to the current gate.
const gateEvidence=(promptVersion,verdict)=>({verdict,summary_ko:`${promptVersion} 판정`,model:'gpt-4.1',
  prompt_version:promptVersion,checked_at:'2026-09-11T00:00:00Z',mission_content_hash:hash,
  findings:verdict==='pass'?[]
    :verdict==='warning'?[{code:'reason_scope',where:'mpj_items[3].reasons[0]',severity:'warning',note_ko:'부차적 이유인지 확인'}]
    :[{code:'band_mismatch',where:'mpj_items[1].target',severity:'fail',note_ko:'판정 확인'}]});

/** A production-shaped review: focused_v1, v3 criteria, independent review kept, prepared artifact stored. */
async function gateRebindFixture(fromVerdict='pass',toVerdict='fail') {
  const m=await mission();
  m.content.provenance.mission_content_hash=hash;
  m.content.quality_check=gateEvidence('quality_v22',fromVerdict);
  await db.query('update scenarios set mission_content=$2 where scenario_id=$1',[m.id,m.content]);
  const r=await review(m.id,'mission',false,5,'content_review_v3');
  await db.query(`update content_review_runs set approval_policy='focused_v1',openai_review=null,
    independent_review_requested=true,generation_quality=$2,professor_decisions='[]',
    snapshot=jsonb_set(snapshot,'{criteria}',$3) where id=$1`,
  [r.id,{mission_content_hash:hash,quality_check:m.content.quality_check},{finalization:'mission_finalization_v1'}]);
  const prepared=finalized(m.content);          // prepared carries the earlier gate verbatim
  await modelRoleSetPrepared(r.id,prepared);
  const current=gateEvidence('quality_v24',toVerdict);
  m.content.quality_check=current;              // the gate re-run: nothing else on the mission moves
  await db.query("update scenarios set mission_content=jsonb_set(mission_content,'{quality_check}',$2) where scenario_id=$1",[m.id,current]);
  return {m,r,prepared,current};
}
const rebind=(id,contentHash=hash)=>admin(()=>scalar('select rebind_content_review_gate($1,$2)',[id,contentHash]));
const rowOf=(id)=>scalar('select to_jsonb(r) from content_review_runs r where id=$1',[id]);

for (const [from,to] of [['pass','fail'],['pass','warning'],['pass','pass'],['fail','fail']]) {
  test(`rebind moves the review to the current gate (${from} → ${to}) and freezes the earlier evidence`,async()=>{
    const {m,r,prepared,current}=await gateRebindFixture(from,to);
    // The stored review is genuinely blocked before the rebind, and that check is not relaxed.
    await assert.rejects(finalize(m,r,{mission_content:prepared}),/does not match the stored mission/);
    const before=await rowOf(r.id);

    const id=await rebind(r.id);
    assert.notEqual(id,r.id);
    const old=await rowOf(r.id);
    const next=await rowOf(id);

    // Old row: byte-for-byte identical apart from the pointer to its replacement.
    assert.deepEqual({...old,superseded_by:null},before);
    assert.equal(old.superseded_by,id);
    assert.equal(old.generation_quality.quality_check.prompt_version,'quality_v22');
    assert.equal(old.prepared_finalization.quality_check.prompt_version,'quality_v22');
    assert.equal(old.approved_at,null);

    // New row: current gate, same semantic evidence, no professor work carried over, explicit provenance.
    assert.deepEqual(next.generation_quality,{mission_content_hash:hash,quality_check:current});
    assert.deepEqual(next.prepared_finalization,{...prepared,quality_check:current});
    assert.deepEqual(next.prepared_finalization.item_lineage,prepared.item_lineage);
    for (const key of ['kind','target_id','week_no','source_hash','content_hash','criteria_version','snapshot','rules',
      'openai_review','claude_review','adjudication','approval_policy','independent_review_requested']) {
      assert.deepEqual(next[key],before[key],`carried evidence differs: ${key}`);
    }
    assert.deepEqual(next.professor_decisions,[]);
    assert.equal(next.professor_decisions_at,null);
    assert.equal(next.approved_at,null);
    assert.equal(next.rebound_from,r.id);
    assert.equal(next.rebound_by,adminId);
    assert.ok(next.rebound_at);
    assert.equal(next.superseded_by,null);
    // The gate re-run left the mission's own content hash alone; the rebind did not touch it either.
    assert.equal(next.prepared_finalization.provenance.mission_content_hash,prepared.provenance.mission_content_hash);

    // The replaced row can no longer carry a decision or an approval; the new one is ready.
    const decide=(id2)=>admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',[id2,hash,[]]));
    await assert.rejects(decide(r.id),/was replaced/);
    await assert.rejects(finalize(m,{id:r.id},{mission_content:next.prepared_finalization}),/was replaced/);
    if (to!=='fail') assert.equal(await decide(id),id);
    assert.equal(await scalar(`select count(*) from content_review_runs where target_id=$1 and superseded_by is null`,[m.id]),1);
  });
}

test('a rebound review approves the current artifact; a critical current gate still needs decision and override',async()=>{
  // pass → warning: no finding requires the professor, so the current artifact approves directly.
  const ok=await gateRebindFixture('pass','warning');
  const okId=await rebind(ok.r.id);
  const okPrepared={...ok.prepared,quality_check:ok.current};
  assert.equal(await finalize(ok.m,{id:okId},{mission_content:okPrepared}),ok.m.id);
  assert.equal(await scalar('select mission_status from scenarios where scenario_id=$1',[ok.m.id]),'reviewed');
  assert.equal(await scalar('select content_review_run_id from mission_lineage_versions where scenario_id=$1 order by version_no desc limit 1',[ok.m.id]),okId);

  // pass → fail: the professor judgement that the rebind did not carry over is now demanded on the current gate.
  const critical=await gateRebindFixture('pass','fail');
  const criticalId=await rebind(critical.r.id);
  const criticalPrepared={...critical.prepared,quality_check:critical.current};
  await assert.rejects(finalize(critical.m,{id:criticalId},{mission_content:criticalPrepared}),/Record every professor decision/);
  await admin(()=>scalar('select save_content_review_decisions($1,$2,$3)',
    [criticalId,hash,[{finding_id:'generation-1',decision:'no_change',rationale_ko:rationale}]]));
  await assert.rejects(finalize(critical.m,{id:criticalId},{mission_content:criticalPrepared}),/unresolved critical/);
  assert.equal(await finalize(critical.m,{id:criticalId},{mission_content:criticalPrepared,...criticalOverride()}),critical.m.id);
});

test('rebind is idempotent from either id and never leaves two active rows',async()=>{
  const {m,r}=await gateRebindFixture('pass','fail');
  const id=await rebind(r.id);
  assert.equal(await rebind(r.id),id);            // following the pointer, not creating another row
  assert.equal(await rebind(id),id);              // already bound to the current gate
  assert.equal(await rebind(r.id),id);
  assert.equal(await scalar('select count(*) from content_review_runs where target_id=$1',[m.id]),2);
  assert.equal(await scalar('select count(*) from content_review_runs where target_id=$1 and superseded_by is null',[m.id]),1);
  // The identity is unique among active rows only, so the preserved history stays insertable-around.
  await assert.rejects(asRole('service_role',()=>db.query(
    `insert into content_review_runs (kind,target_id,week_no,source_hash,content_hash,criteria_version,snapshot,rules,created_by)
     select kind,target_id,week_no,source_hash,content_hash,criteria_version,snapshot,rules,created_by
     from content_review_runs where id=$1`,[id])),/content_review_runs_active_identity_idx/);
});

test('rebind refuses professor work, approvals, stale content and unsupported versions',async()=>{
  const decided=await gateRebindFixture('pass','fail');
  await db.query('update content_review_runs set professor_decisions=$2, professor_decisions_at=now(), professor_decisions_by=$3 where id=$1',
    [decided.r.id,[{finding_id:'generation-1',decision:'no_change',rationale_ko:rationale}],adminId]);
  await assert.rejects(rebind(decided.r.id),/Professor work is already recorded/);

  const overridden=await gateRebindFixture('pass','fail');
  await db.query('update content_review_runs set openai_fail_override=$2 where id=$1',[overridden.r.id,rationale]);
  await assert.rejects(rebind(overridden.r.id),/Professor work is already recorded/);

  const approved=await gateRebindFixture('pass','fail');
  await db.query('update content_review_runs set approved_at=now(), approved_by=$2, professor_note=$3 where id=$1',
    [approved.r.id,adminId,rationale]);
  await assert.rejects(rebind(approved.r.id),/Approved review evidence is immutable/);
  assert.equal(await scalar('select superseded_by from content_review_runs where id=$1',[approved.r.id]),null);

  const stale=await gateRebindFixture('pass','fail');
  await assert.rejects(rebind(stale.r.id,'b'.repeat(64)),/content version mismatch/);
  await db.query(`update scenarios set core_content='{"situation_ko":"changed"}' where scenario_id=$1`,[stale.m.id]);
  await assert.rejects(rebind(stale.r.id),/Content changed/);

  const unsupported=await gateRebindFixture('pass','fail');
  await db.query("update content_review_runs set criteria_version='content_review_v4' where id=$1",[unsupported.r.id]);
  await assert.rejects(rebind(unsupported.r.id),/Unsupported review criteria version/);

  const learnerAttempt=await gateRebindFixture('pass','fail');
  await assert.rejects(learner(()=>scalar('select rebind_content_review_gate($1,$2)',[learnerAttempt.r.id,hash])),/Admin required/);
});

test('a superseded review stays readable as history and can never be edited or deleted',async()=>{
  const {r}=await gateRebindFixture('pass','fail');
  const id=await rebind(r.id);
  assert.equal(await scalar('select count(*) from content_review_runs where id in ($1,$2)',[r.id,id]),2);
  const history=await db.query('select id,superseded_by,rebound_from from content_review_runs where id in ($1,$2) order by created_at',[r.id,id]);
  assert.deepEqual(history.rows.map(row=>row.id),[r.id,id]);
  await assert.rejects(asRole('service_role',()=>db.query('update content_review_runs set last_error=$2 where id=$1',[r.id,'edit'])),/Superseded review evidence is immutable/);
  await assert.rejects(asRole('service_role',()=>db.query('delete from content_review_runs where id=$1',[r.id])),/Superseded review evidence is immutable/);
});

test('a weekly handout stays hidden until the rebound mission review is actually approved',async()=>{
  const {m,r,prepared,current}=await gateRebindFixture('pass','warning');
  const missionReviewId=await rebind(r.id);
  const courseId=randomUUID();
  await db.query("insert into curriculum_outlines values ($1,'rebind course','published')",[courseId]);
  await db.query("insert into curriculum_weeks(outline_id,week_no,title) values ($1,5,'rebind week')",[courseId]);
  await db.query("insert into curriculum_week_scenarios values ($1,5,$2,1,'required')",[courseId,m.id]);
  const read=()=>learner(()=>scalar('select get_approved_weekly_material($1,5)',[courseId]));
  const beforeApproval=await review(courseId,'weekly_material',false,5,'content_review_v3');
  assert.equal(await read(),null);
  // A rebound mission review is ready, not approved: the dependency check still refuses the week.
  await assert.rejects(approve(beforeApproval),/each assigned mission first/);
  assert.equal(await finalize(m,{id:missionReviewId},{mission_content:{...prepared,quality_check:current}}),m.id);
  const week=await review(courseId,'weekly_material',false,5,'content_review_v3');  // mission status is part of the week source
  assert.equal(await read(),null);
  await approve(week);
  assert.deepEqual(await read(),{reviewId:week.id,contentHash:hash,material:week.snapshot.content.public_material});
});

test('prepared signal evidence is stale after a source edit and cannot be replaced by an admin client',async()=>{
  const {m,r}=await focusedReview();
  await db.query("update content_review_runs set snapshot=jsonb_set(snapshot,'{criteria}',$2) where id=$1",
    [r.id,{finalization:'mission_finalization_v1'}]);
  const prepared=finalized(m.content);
  await assert.rejects(admin(()=>db.query('update content_review_runs set prepared_finalization=$2 where id=$1',[r.id,prepared])),/permission denied/);
  await modelRoleSetPrepared(r.id,prepared);
  await db.query("update scenarios set core_content=core_content || '{\"situation_ko\":\"수정된 원본\"}'::jsonb where scenario_id=$1",[m.id]);
  await assert.rejects(finalize(m,r,{mission_content:prepared}),/Content changed/);
});
