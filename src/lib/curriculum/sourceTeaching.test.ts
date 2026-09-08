import { describe, expect, it } from "vitest";
import { prepareTeachingMaterial, applyTeachingDraft } from "./teachingGeneration";
import { validateTeachingSources, validateTeachingEvidence, validateTeachingContent, TEACHING_SECTION_KEYS,
  type TeachingConfig, type TeachingDraft, type TeachingContent } from "../../../supabase/functions/_shared/teachingMaterial";

const config: TeachingConfig = { workflow:"source",missionIds:[],extraText:"",extraRef:"",outputKind:"lesson",focus:"선택권을 비교",activityMode:"pair",
  sources:[{id:"S1",label:"요청 자료",ref:"수업용 검증 텍스트",text:"요청은 상대방의 선택권을 남길 수 있습니다.",kind:"text",confirmed:true,
    extraction:{method:"manual_text",detail:"직접 입력",extractedCharacters:27,warnings:[]}}] };
const context = {base:{outline:{id:"course",title:"화용 수업",level:"intermediate",language_direction:"ko_zh",course_mode:"mixed"},
  week:{week_no:2,title:"요청",type:"regular",speech_act:"request",can_do:["요청의 근거를 설명한다."]}, assignments:[],scenarios:[],scope_weeks:[]},references:[]};
const content:TeachingContent = {sections:TEACHING_SECTION_KEYS.lesson.map(key=>({key,title:key,paragraphs:["상대방의 선택권을 비교합니다."],items:[],source_ids:["S1"],
  evidence:[{source_id:"S1",quote:"상대방의 선택권"}]})),instructor_notes:[{title:"교수자 메모",body:"PRIVATE_TEACHER",source_ids:["S1"]}]};

describe("소스 기반 교수자 저작",()=>{
  it("generates before mission assignment and anchors scope in saved week, not caller focus",()=>{
    const prepared=prepareTeachingMaterial(context,config);
    expect(prepared.material.missions).toHaveLength(0);
    const input=JSON.parse(prepared.prompt.user);
    expect(input.context.speech_acts).toEqual(["request"]);
    expect(input.context.planned_goals).toEqual(context.base.week.can_do);
    expect(input.sources[0].text).toBe(config.sources![0].text);
    expect(prepared.prompt.system).toContain("제공된 소스에서 확인되지 않음");
    expect(()=>prepareTeachingMaterial({...context,base:{...context.base,week:{...context.base.week,speech_act:null}}},config)).toThrow("화행");
  });
  it("can author either output in a speech-act week; cumulative weeks use the saved prior acts",()=>{
    const sourceDiscussion=prepareTeachingMaterial(context,{...config,outputKind:"discussion"});
    expect(sourceDiscussion.kind).toBe("discussion");
    expect(sourceDiscussion.prompt.system).toContain("comparison: 선택한 소스의 표현·상황 비교");
    expect(sourceDiscussion.prompt.system).not.toContain("comparison: 선택한 이전 미션");
    expect(sourceDiscussion.prompt.system).toContain("주차 계획은 실제 수업·수행 기록이 아니다");
    const discussion={...context,base:{...context.base,week:{...context.base.week,week_no:7,speech_act:null},scope_weeks:[{week_no:2,speech_act:"request",can_do:["요청 근거"]},{week_no:3,speech_act:"refusal",can_do:["거절 근거"]}]}};
    expect(JSON.parse(prepareTeachingMaterial(discussion,{...config,outputKind:"discussion"}).prompt.user).context.speech_acts).toEqual(["request","refusal"]);
  });
  it("rejects unconfirmed, duplicate, unattributed or oversized source text",()=>{
    for(const sources of [[],[...config.sources!,...config.sources!],[{...config.sources![0],confirmed:false}],[{...config.sources![0],ref:""}],[{...config.sources![0],text:"x".repeat(60001)}]])
      expect(()=>validateTeachingSources({...config,sources})).toThrow();
    expect(validateTeachingSources(config)[0].text).toBe(config.sources![0].text);
  });
  it("checks quotations against actual source text, and keeps raw sources/teacher notes out of public materials",()=>{
    validateTeachingContent(content,"lesson",["S1"]); validateTeachingEvidence(content,config.sources!);
    const bad=structuredClone(content);bad.sections[0].evidence![0].quote="원문에 없는 거짓 인용";
    expect(()=>validateTeachingEvidence(bad,config.sources!)).toThrow("원문에 없어");
    bad.sections[0].evidence=[]; expect(()=>validateTeachingEvidence(bad,config.sources!)).toThrow();
    const draft: TeachingDraft={id:"draft",outline_id:"course",week_no:2,revision:1,source_hash:"fixture",created_at:"2026-09-09T00:00:00Z",
      kind:"lesson",source_config:config,sources:config.sources!,content,provenance:{model:"fixture",prompt_version:"source_teaching_v2",response_id:"fixture",input_hash:"fixture"}};
    const output=JSON.stringify(applyTeachingDraft(prepareTeachingMaterial(context,config).material,draft));
    expect(output).not.toContain("PRIVATE_TEACHER");expect(output).not.toContain('"extraction"');
    expect(output).toContain("활용 근거: 요청 자료");
  });
});
