// One alternate situation per empty slot. Does not change failed candidates or their budgets.
import {readFileSync,writeFileSync,appendFileSync,existsSync} from "node:fs";
const memory = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{value:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
const [{supabase},{runCoreCell,loadExistingCoreRunItems,coreGenerationItemKey},{promoteCore},{SCENARIO_TOPICS,COURSE_PRESETS,topicSupportsContext}] = await Promise.all([
  import("../src/integrations/supabase/client"),import("../src/lib/pragma/coreBatchRun"),import("../src/lib/pragma/promoteMission"),import("../src/lib/pragma/scenarioTopics")]);
const dir=".tmp/course-content";
const plan=JSON.parse(readFileSync(dir+"/plan.json","utf8"));
const original=JSON.parse(readFileSync(dir+"/generation-state.json","utf8"));
const file=dir+"/replacement-state.json";
const state=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{planHash:plan.planHash,slots:{}};
if(state.planHash!==plan.planHash||original.planHash!==plan.planHash)throw new Error("Plan mismatch");
const save=()=>writeFileSync(file,JSON.stringify(state,null,2));
const log=(entry:object)=>appendFileSync(dir+"/execution.jsonl",JSON.stringify({at:new Date().toISOString(),phase:"alternate_situation",...entry})+"\n");
const login=await supabase.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL!,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD!});
if(login.error)throw login.error;
try {
  const admin=await supabase.rpc("is_admin"); if(admin.error||admin.data!==true)throw new Error("Administrator required");
  const recovered=await loadExistingCoreRunItems(original.runId+"-alternate1");
  for(const [ordinal,entry] of Object.entries(state.slots)){
    const checkpoint=entry as any;
    if(!checkpoint.attempted||checkpoint.generated!==undefined||checkpoint.missionAttempted||!checkpoint.cell)continue;
    let saved=recovered.get(coreGenerationItemKey(checkpoint.cell,Number(ordinal)));
    if(!saved?.scenarioId&&!checkpoint.coreRecoveryAttempted){
      checkpoint.coreRecoveryAttempted=true;save();
      log({slot:Number(ordinal),status:"resume_interrupted_core_once",reason:"No saved core for the same idempotency key; no mission was attempted"});
      const result=await runCoreCell(checkpoint.cell,Number(ordinal),{runId:original.runId+"-alternate1"});
      writeFileSync(dir+"/alternate-core-"+ordinal+".json",JSON.stringify(result));
      if(result.ok&&result.scenarioId)saved={scenarioId:result.scenarioId,coreContent:result.coreContent};
      else checkpoint.error=result.error??"Core recovery failed";
    }
    if(!saved?.scenarioId){checkpoint.error="Interrupted core call: no stored result; no automatic repeat";save();continue;}
    checkpoint.scenarioId=saved.scenarioId;checkpoint.missionAttempted=true;save();
    const row=await (supabase as any).from("scenarios").select("*").eq("scenario_id",saved.scenarioId).single();
    if(row.error)throw row.error;
    const result=await promoteCore(row.data);
    writeFileSync(dir+"/alternate-mission-"+ordinal+".json",JSON.stringify(result));
    checkpoint.generated=result.ok;checkpoint.selected=result.ok;checkpoint.qualityVerdict=result.quality?.verdict??null;checkpoint.error=result.error??null;save();
    log({slot:Number(ordinal),status:"resumed_saved_core",scenarioId:saved.scenarioId,ok:result.ok,quality:result.quality?.verdict});
  }
  const slots=plan.plan.filter((s:any)=>original.slots[s.ordinal]?.error&&!original.slots[s.ordinal]?.generated);
  let cursor=0;
  await Promise.all(Array.from({length:2},async()=>{
    while(cursor<slots.length){
      const slot=slots[cursor++]; if(state.slots[slot.ordinal]?.attempted)continue;
      const previous=original.slots[slot.ordinal];
      let cell=slot.cell;
      if(!cell){
        const row=await (supabase as any).from("scenarios").select("*").eq("scenario_id",previous.scenarioId).single();
        if(row.error)throw row.error;
        if(row.data.mission_content)throw new Error("Slot is no longer empty");
        const r=row.data,p=r.core_content.pdr;
        cell={speech_act_ui:slot.speechAct,level:slot.level,direction:slot.direction,mode:slot.mode,domain:r.domain,
          pdr_power:({speaker_lower:"lower",speaker_higher:"higher",equal:"equal"} as any)[p.p],
          pdr_distance:p.d==="distant"?"formal":p.d,pdr_burden:p.r,
          theme_code:r.theme_code,topic_code:r.topic_code,industry:r.industry_sector,business_function:r.business_function,count:1};
      }
      const preset=COURSE_PRESETS.find(p=>p.outline_id===slot.courseId)!;
      const themeCodes=preset.included_themes;
      const candidates=SCENARIO_TOPICS.flatMap(topic=>{
        if(!themeCodes.includes(topic.themeCode)||topic.code===cell.topic_code)return [];
        return topic.allowedDomains.flatMap(domain=>{
          if(preset.primary_domain==="work"&&domain!=="work")return [];
          return (["equal","lower","higher"] as const).flatMap(power=>(["acquaintance","formal","close"] as const).flatMap(distance=>
            topicSupportsContext(topic,{speechAct:slot.speechAct,domain,power,distance,mode:slot.mode})?[{topic,domain,power,distance}]:[]));
        });
      });
      const specificSeeds:Record<number,string>={
        34:"무역회사에서 동등한 직급의 친한 협업 담당자에게 계약서 변경 사항이 납기표에 반복해서 누락되어 선적 준비가 지연되는 문제에 대한 불만을 업무 메시지로 전달하는 상황",
        35:"무역회사 프로젝트 조율 회의에서 출고 지시서의 수정 버전이 제때 공유되지 않아 창고 작업이 중복되는 문제에 대한 불만을 상대 담당자에게 말하는 상황",
      };
      const choice=candidates[slot.ordinal%candidates.length]??(specificSeeds[slot.ordinal]?{
        topic:SCENARIO_TOPICS.find(t=>t.code===cell.topic_code)!,domain:cell.domain,power:cell.pdr_power,distance:cell.pdr_distance}:null);
      if(!choice){state.slots[slot.ordinal]={error:"No alternate catalog context",attempted:false};save();continue;}
      const {topic,domain,power,distance}=choice;
      const alternate={...cell,domain,pdr_power:power,pdr_distance:distance,
        industry:domain==="work"?(cell.industry??"trade_distribution"):null,
        business_function:domain==="work"?(cell.business_function??"project_coordination"):null,
        theme_code:topic.themeCode,topic_code:topic.code,situation_seed_ko:specificSeeds[slot.ordinal]??topic.situationSeedKo};
      const checkpoint=state.slots[slot.ordinal]={previousScenarioId:previous.scenarioId??null,previousError:previous.error,
        disposition:"one_new_situation_for_empty_slot",cell:alternate,attempted:true};
      save();log({slot:slot.ordinal,status:"started",...checkpoint});
      try {
        const core=await runCoreCell(alternate,slot.ordinal,{runId:original.runId+"-alternate1"});
        writeFileSync(dir+"/alternate-core-"+slot.ordinal+".json",JSON.stringify(core));
        if(!core.ok||!core.scenarioId){checkpoint.error=core.error;save();continue;}
        checkpoint.scenarioId=core.scenarioId;save();
        const row=await (supabase as any).from("scenarios").select("*").eq("scenario_id",core.scenarioId).single();
        if(row.error)throw row.error;
        checkpoint.missionAttempted=true;save();
        const result=await promoteCore(row.data);
        writeFileSync(dir+"/alternate-mission-"+slot.ordinal+".json",JSON.stringify(result));
        checkpoint.generated=result.ok;checkpoint.qualityVerdict=result.quality?.verdict??null;checkpoint.error=result.error??null;
        checkpoint.selected=result.ok;save();
        log({slot:slot.ordinal,status:"finished",scenarioId:core.scenarioId,ok:result.ok,quality:result.quality?.verdict,error:result.error});
        console.log(JSON.stringify({slot:slot.ordinal,ok:result.ok,quality:result.quality?.verdict,error:result.error}));
      }catch(cause){checkpoint.error=cause instanceof Error?cause.message:String(cause);save();log({slot:slot.ordinal,error:checkpoint.error});}
    }
  }));
}finally{await supabase.auth.signOut({scope:"local"});}
