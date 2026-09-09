// Review-only local reproduction for commit 62206a5b. No remote requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root=process.cwd();
const result=await build({stdin:{contents:`
export { checkCore, checkMission } from './src/lib/pragma/missionRules.ts';
export { SAMPLE_MISSION_V5_NATIVE } from './src/lib/mission/missionV4Sample.ts';
export { CURRENT_MISSION_PROMPT_VERSIONS } from './supabase/functions/_shared/contentRelease.ts';
export { buildContentReviewDomain } from './src/lib/pragma/contentReviewDomain.ts';
export { professorReviewFindings, professorDecisionsComplete } from './supabase/functions/_shared/contentReview.ts';
`,resolveDir:root,sourcefile:'review-entry.ts'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,alias:{'@':path.resolve('src')}});
const mod=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const {checkCore,checkMission,SAMPLE_MISSION_V5_NATIVE:sample,CURRENT_MISSION_PROMPT_VERSIONS:versions,buildContentReviewDomain,professorReviewFindings,professorDecisionsComplete}=mod;
const context={speech_act:'request',level:'intermediate',domain:'work',theme_code:'career_workplace',topic_code:'schedule_change',mode:'translation',source_modality:'written',direction:'ko_zh'};
const mission=structuredClone(sample);
mission.learning_goal={kind:'speech_act',speech_act:'request'};
mission.contrast_plan={version:'contrast_plan_v1',speech_act:'request',mission_goal:'integrated_speech_act',item_slots:mission.mpj_items.map(it=>({item_id:it.id,item_type:it.type,item_focus:it.axis_feature,intended_band_profile:'saved'}))};
mission.provenance.prompt_version=versions[0];
mission.authoring={schema_version:'mission_authoring_v1',stage:'ai_draft',lineage_status:'pending',repair_attempts:0};
const core={schema_version:'scenario_core_v2',direction:'ko_zh',situation_ko:'회사 동료에게 일정 변경 내용을 메신저로 보낸다. 오늘 안에 확인을 요청한다.',relation_ko:'회사 동료 관계',source_modality:'written',source_text:mission.production_task.source_text,preceding_turn:null,pdr:mission.production_task.pdr,channel:'messenger',usable_facts:mission.production_task.usable_facts??[]};
const row={speech_act:'request',learner_level:'intermediate',domain:'work',theme_code:'career_workplace',topic_code:'schedule_change',industry_sector:null,mode:'translation',source_modality:'written',core_content:core,mission_content:mission};
assert.equal(checkCore(core,context).result,'pass');
assert.equal(checkMission(mission,context,core).violations.filter(v=>v.level==='fail').length,0);

const coreSignalLoss=[];
for(const [id,text] of [
 ['R9','중국인은 모두 같다는 일반화는 피해야 한다. 동료에게 일정을 알리는 글을 보낸다.'],
 ['R30','담당자는 촬영 현장에서 조명의 강도를 조절한다. 동료에게 일정표를 메일로 보낸다.'],
 ['R16','발표를 마친 뒤 상대를 칭찬한다. 글로 남기지 않고 직접 말하는 상황이다.'],
]){
 const source=structuredClone(row);
 source.core_content.situation_ko=text;
 const direct=checkCore(source.core_content,context).violations.filter(v=>v.id===id);
 const domain=buildContentReviewDomain('mission',{scenario:source});
 const arrived=domain.rules.findings.filter(f=>f.issue_ko.startsWith(id+':')||f.issue_ko.startsWith(id+'/'));
 assert.ok(direct.some(v=>v.level==='warning'),id+' must produce a core warning');
 assert.equal(arrived.length,0,id+' core warning disappears before the adapter');
 coreSignalLoss.push({id,scene:text,coreWarnings:direct,reviewFindings:arrived,reviewVerdict:domain.rules.verdict});
}

const source=structuredClone(row);
source.mission_content.mpj_items[0].explanation_ko='중국인들은 항상 간접 표현을 좋아한다.';
const domain=buildContentReviewDomain('mission',{scenario:source});
const emitted=domain.rules.findings.filter(f=>f.issue_ko.startsWith('R9/'));
assert.equal(emitted.length,1);
assert.equal(emitted[0].needs_professor,true);
const run={approval_policy:'focused_v1',rules:domain.rules,openai_review:{result:{verdict:'pass',summary_ko:'synthetic pass',findings:[]}},claude_review:null,generation_quality:null,professor_decisions:[]};
const required=professorReviewFindings(run);
assert.equal(required.length,0);
assert.equal(professorDecisionsComplete(required,[],true),true);

// Execute the real SQL helper in an isolated database with only its composite input type.
const sql=fs.readFileSync('supabase/migrations/20260906100000_focused_content_review.sql','utf8');
const start=sql.indexOf('CREATE FUNCTION public.content_review_required_findings(');
assert.ok(start>=0);
const helper=sql.slice(start,sql.indexOf('$$;',start)+3);
const db=new PGlite();
await db.exec('CREATE TYPE public.content_review_runs AS (approval_policy text, claude_review jsonb, generation_quality jsonb, openai_review jsonb, professor_decisions jsonb, rules jsonb)');
await db.exec(helper);
const sqlResult=await db.query('SELECT public.content_review_required_findings(jsonb_populate_record(NULL::public.content_review_runs, $1::jsonb)) AS findings',[JSON.stringify(run)]);
assert.deepEqual(sqlResult.rows[0].findings,[]);
await db.close();

// Execute the unchanged Edge attribution coordinator with model/network dependencies stubbed.
// The real function body and ratio constants are parsed from the reviewed source; this is not an HTTP/production test.
const edgeSource=fs.readFileSync('supabase/functions/generate-scenario/index.ts','utf8');
const tree=ts.createSourceFile('edge.ts',edgeSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='attributeMissionItemLineage');
assert.ok(fn);
const constant=(name)=>{
 for(const stmt of tree.statements) if(ts.isVariableStatement(stmt)) for(const decl of stmt.declarationList.declarations)
  if(ts.isIdentifier(decl.name)&&decl.name.text===name) return Number(decl.initializer.getText(tree));
 throw new Error('Missing constant '+name);
};
const maxRatio=constant('ITEM_LINEAGE_MAX_UNATTRIBUTED_RATIO');
const maxBatch=constant('ITEM_LINEAGE_MAX_BATCH_SIZE');
let unattributed=1;
const stubs={
 collectMissionLineageTargets:()=>Array.from({length:5},(_,i)=>({target_path:'fixture['+i+']',text:'目标语'})),
 ITEM_LINEAGE_MAX_BATCH_SIZE:maxBatch,ITEM_LINEAGE_MAX_UNATTRIBUTED_RATIO:maxRatio,
 attributeItemLineageBatch:async(batch)=>({ok:true,claims:batch.map(x=>({target_path:x.target_path})),model:'synthetic',promptInstanceHash:'a'.repeat(64),attempts:1}),
 sha256Hex:async()=> 'a'.repeat(64),canonicalJson:JSON.stringify,
 CURRENT_ITEM_LINEAGE_PROMPT_VERSION:'fixture',PROVIDER:'fixture',
 buildPendingItemLineage:()=>({coverage_summary:{total_count:5,claimed_count:5-unattributed,unattributed_count:unattributed}})
};
const transpiled=ts.transpileModule(fn.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const attribute=new Function(...Object.keys(stubs),transpiled+'\nreturn attributeMissionItemLineage;')(...Object.values(stubs));
const edgeRatioResults=[];
for(const count of [1,2,5]){
 unattributed=count;
 const output=await attribute({}, {}, '', ()=>({}));
 assert.equal(output.ok,count===1);
 edgeRatioResults.push({unattributed:count,total:5,output});
}
const output={commit:'62206a5b2f7de8f5b75907b8e2301b71a6b24c0b',generatedAt:new Date().toISOString(),node:process.version,
 coreSignalLoss,ruleWarningNotRequired:{emitted,professorFindings:required,emptyDecisionsAccepted:professorDecisionsComplete(required,[],true),sqlRequiredFindings:sqlResult.rows[0].findings},
 edgeRatioResults,limitations:'Local pure-function and isolated SQL helper reproduction; external attribution dependencies stubbed; no paid APIs, production DB or browser used.'};
fs.writeFileSync('docs/research-trail/evidence/2026-09-09-62206a5b-review-probes.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({coreSignalLoss:coreSignalLoss.map(x=>({id:x.id,coreWarnings:x.coreWarnings.length,reviewFindings:x.reviewFindings.length})),
 adapterNeedsProfessor:emitted[0].needs_professor,professorFindings:required.length,sqlRequiredFindings:sqlResult.rows[0].findings,edgeRatioResults},null,2));
