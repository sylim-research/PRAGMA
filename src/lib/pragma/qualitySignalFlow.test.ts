import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildContentReviewDomain } from "./contentReviewDomain";
import { checkCore } from "./missionRules";
import { buildMissionLineageScope } from "./missionLineage";
import { expectedItemLineageTargetPaths, ITEM_LINEAGE_SCHEMA_VERSION } from "./itemLineage";
import { CURRENT_ITEM_LINEAGE_PROMPT_VERSION, CURRENT_MISSION_PROMPT_VERSIONS } from "../../../supabase/functions/_shared/contentRelease";
import { nextReviewStage, professorReviewFindings, professorDecisionsComplete, reviewHash, type ContentReviewRun } from "../../../supabase/functions/_shared/contentReview";
import { prepareReviewFinalization } from "../../../supabase/functions/_shared/contentReviewFinalization";
import { prepareContentReview } from "./reviewPreparation";

const ctx = { speech_act:"request", level:"intermediate", domain:"work", theme_code:"career_workplace",
  topic_code:"schedule_change", mode:"translation", source_modality:"written", direction:"ko_zh" } as const;
function fixture() {
  const mission: any = structuredClone(SAMPLE_MISSION_V5_NATIVE);
  mission.learning_goal={kind:"speech_act",speech_act:"request"};
  mission.contrast_plan={version:"contrast_plan_v1",speech_act:"request",mission_goal:"integrated_speech_act",
    item_slots:mission.mpj_items.map((it:any)=>({item_id:it.id,item_type:it.type,item_focus:it.axis_feature,intended_band_profile:"saved"}))};
  mission.provenance.prompt_version=CURRENT_MISSION_PROMPT_VERSIONS[0];
  mission.authoring={schema_version:"mission_authoring_v1",stage:"ai_draft",lineage_status:"pending",repair_attempts:0};
  const core={schema_version:"scenario_core_v2",direction:"ko_zh",situation_ko:"회사 동료에게 일정 변경 내용을 메신저로 보낸다. 오늘 안에 확인을 요청한다.",
    relation_ko:"회사 동료 관계",source_modality:"written",source_text:mission.production_task.source_text,preceding_turn:null,
    pdr:mission.production_task.pdr,channel:"messenger",usable_facts:mission.production_task.usable_facts??[]};
  return { speech_act:"request",learner_level:"intermediate",domain:"work",theme_code:"career_workplace",topic_code:"schedule_change",
    industry_sector:null,mode:"translation",source_modality:"written",core_content:core,mission_content:mission };
}
function finalized(mission: any) {
  const result=structuredClone(mission);
  result.authoring={...result.authoring,stage:"professor_finalized",lineage_status:"complete"};
  result.provenance.mission_content_hash="a".repeat(64);
  result.hsk_lexical_audit={status:"unavailable",policy_version:"fixture",source_id:"fixture",direction:"ko_zh",
    scope:"zh_target_mission",reference_ceiling:5,distinct_token_count:0,matched_token_count:0,coverage_ratio:null,
    out_of_reference_candidates:[],non_blocking:true,note:"합성 검증"};
  const scope=buildMissionLineageScope({direction:"ko_zh",speechAct:"request",targetFeature:mission.unit.target_feature});
  const paths=expectedItemLineageTargetPaths(result);
  result.item_lineage={schema_version:ITEM_LINEAGE_SCHEMA_VERSION,claim_status:"model_attribution_pending_review",
    realization_pack_id:scope.realization_pack_id,realization_pack_version:scope.realization_pack_version,
    attribution_provenance:{provider:"openai",model:"fixture",prompt_version:CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
      prompt_instance_hash:"a".repeat(64),attribution_attempts:Math.ceil(paths.length/5),batch_count:Math.ceil(paths.length/5),
      calls:Array.from({length:Math.ceil(paths.length/5)},(_,i)=>({batch_index:i+1,target_count:Math.min(5,paths.length-i*5),
        model:"fixture",prompt_instance_hash:"a".repeat(64),attempts:1})),attributed_at:"2026-09-09T00:00:00Z"},
    coverage_summary:{total_count:paths.length,claimed_count:0,unattributed_count:paths.length},
    claims:paths.map((target_path,i)=>({claim_id:`ILC-${String(i+1).padStart(3,"0")}`,target_path,attribution_status:"model_unattributed",
      rule_ids:[],risk_ids:[],evidence_ids:[],note_ko:"허용 근거에 귀속하지 못한 합성 검증 주장"}))};
  return result;
}
async function review(row=fixture()) {
  const domain=buildContentReviewDomain("mission",{scenario:row});
  const run={id:"review",kind:"mission",target_id:"fixture",week_no:0,snapshot:domain.snapshot,rules:domain.rules,
    content_hash:await reviewHash(domain.snapshot),source_hash:"b".repeat(64),approval_policy:"focused_v1",
    openai_review:{result:{verdict:"pass",summary_ko:"합성 통과",findings:[]}},claude_review:null,generation_quality:null,
    professor_decisions:[],approved_at:null,running_stage:null} as unknown as ContentReviewRun;
  return {row,run,inspectFinalized:(mission:any)=>buildContentReviewDomain("mission",{scenario:{...row,mission_content:mission}})};
}
beforeEach(()=>vi.stubGlobal("crypto",webcrypto));
afterEach(()=>vi.unstubAllGlobals());

describe("quality signals through professor review",()=>{
  it.each([
    ["R9","중국인은 모두 같다는 일반화는 피해야 한다. 동료에게 일정을 알리는 글을 보낸다."],
    ["R30","담당자는 촬영 현장에서 조명의 강도를 조절한다. 동료에게 일정표를 메일로 보낸다."],
    ["R16","발표를 마친 뒤 상대를 칭찬한다. 글로 남기지 않고 직접 말하는 상황이다."],
  ])("retains saved-core %s in the professor decision list",async(id,scene)=>{
    const row=fixture();row.core_content.situation_ko=scene;
    expect(checkCore(row.core_content,ctx).violations.some(v=>v.id===id&&v.level==="warning")).toBe(true);
    const {run}=await review(JSON.parse(JSON.stringify(row)));
    const findings=professorReviewFindings(run);
    expect(findings.some(f=>f.id.startsWith("rule-core-")&&f.issue_ko.startsWith(id+"/")&&f.needs_professor)).toBe(true);
    expect(new Set(run.rules.findings.map(f=>f.id)).size).toBe(run.rules.findings.length);
    expect(professorDecisionsComplete(findings,[],true)).toBe(false);
  });
  it("requires reasoned decisions for mission warnings, with defer still blocking approval",async()=>{
    const row=fixture();row.mission_content.mpj_items[0].explanation_ko="중국인들은 항상 간접 표현을 좋아한다.";
    const {run}=await review(row);const findings=professorReviewFindings(run);
    expect(findings.some(f=>f.issue_ko.startsWith("R9/"))).toBe(true);
    const decisions=findings.map(f=>({finding_id:f.id,decision:"no_change" as const,rationale_ko:"원문과 수업 맥락을 확인하여 그대로 사용합니다."}));
    expect(professorDecisionsComplete(findings,decisions,true)).toBe(true);
    expect(professorDecisionsComplete(findings,[{...decisions[0],decision:"defer"},...decisions.slice(1)],true)).toBe(false);
  });
  it("prepares 100% unattributed evidence once, checks it, and stops for the professor",async()=>{
    const {row,run,inspectFinalized}=await review();
    const generate=vi.fn(async()=>finalized(row.mission_content));
    const state:any={run,contentHash:run.content_hash,sourceHash:run.source_hash,snapshot:run.snapshot,history:[],dependencies:[],models:{openai:"fixture",claude:null}};
    const request=vi.fn(async(_target,action)=>{
      if(action==="finalization")Object.assign(run,await prepareReviewFinalization({run,currentMission:row.mission_content,finalize:generate,inspectFinalized}));
      return structuredClone(state);
    });
    expect(nextReviewStage(run)).toBe("finalization");
    const result=await prepareContentReview({kind:"mission",targetId:"fixture"},{request,stopped:()=>false});
    expect(result.status,JSON.stringify(run.rules)).toBe("ready");expect(generate).toHaveBeenCalledTimes(1);
    expect(run.rules.verdict).toBe("warning");
    expect(run.rules.findings.some(f=>f.issue_ko.startsWith("R31:")&&f.severity==="fail")).toBe(false);
    expect(professorReviewFindings(run).some(f=>f.issue_ko.startsWith("R32/unattributed_over_reference_ratio"))).toBe(true);
    expect(run.approved_at).toBeNull();
    await prepareContentReview({kind:"mission",targetId:"fixture"},{request,stopped:()=>false});
    expect(generate).toHaveBeenCalledTimes(1);
    expect(professorDecisionsComplete(professorReviewFindings(run),[],true)).toBe(false);
  });
  it("retains structural attribution failures as blocking evidence",async()=>{
    const {row,run,inspectFinalized}=await review();
    const broken=finalized(row.mission_content);broken.item_lineage.claims.pop();
    const prepared=await prepareReviewFinalization({run,currentMission:row.mission_content,finalize:async()=>broken,inspectFinalized});
    expect(prepared.rules.verdict).toBe("fail");
    expect(prepared.rules.findings.some(f=>f.issue_ko.startsWith("R31:"))).toBe(true);
  });
  it("rejects instructional changes during finalization",async()=>{
    const {row,run,inspectFinalized}=await review();const changed=finalized(row.mission_content);
    changed.mpj_items[0].explanation_ko+="변경";
    await expect(prepareReviewFinalization({run,currentMission:row.mission_content,finalize:async()=>changed,inspectFinalized})).rejects.toThrow("콘텐츠와 다릅니다");
  });
  it("reuses a historical finalized artifact without another model call",async()=>{
    const {row,run,inspectFinalized}=await review();const generate=vi.fn();
    const prepared=await prepareReviewFinalization({run,currentMission:finalized(row.mission_content),finalize:generate,inspectFinalized});
    expect(generate).not.toHaveBeenCalled();expect(prepared.prepared_finalization).toBeTruthy();
  });
});
