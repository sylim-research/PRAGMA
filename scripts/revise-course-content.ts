// Apply explicitly authored AI editorial proposals once. Never impersonates professor approval.
import {readFileSync,writeFileSync,existsSync,appendFileSync} from 'node:fs';
const memory=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k),clear:()=>memory.clear()}});
const [{supabase},{reviseMissionDraft}]=await Promise.all([import('../src/integrations/supabase/client'),import('../src/lib/pragma/promoteMission')]);
const path='.tmp/course-content/editorial-state.json';
const proposals=JSON.parse(readFileSync('.tmp/course-content/editorial-proposals.json','utf8'));
const state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{planHash:proposals.planHash,slots:{}};
if(state.planHash!==proposals.planHash)throw Error('Proposal plan changed');
const selected=process.argv[2]?new Set(process.argv[2].split(',').map(Number)):null;
const list=proposals.edits.filter((p:any)=>!selected||selected.has(p.ordinal));
const db=supabase as any;
const login=await supabase.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL!,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD!});if(login.error)throw login.error;
try {
 const admin=await supabase.rpc('is_admin');if(admin.error||admin.data!==true)throw Error('Admin required');
 let cursor=0;
 const worker=async()=>{while(cursor<list.length){const p=list[cursor++];const prior=state.slots[p.ordinal];
  if(prior?.attempted && !(process.argv.includes('--resume-rule-fail') && prior.ruleResult==='fail' && prior.quality===null && !prior.ok))continue;
  if(prior)appendFileSync('.tmp/course-content/editorial-rule-holds.jsonl',JSON.stringify({ordinal:p.ordinal,...prior})+'\n');
  const {data:row,error}=await db.from('scenarios').select('*').eq('scenario_id',p.scenarioId).single();if(error)throw error;
  if(row.mission_status!=='generated'||row.mission_content?.provenance?.mission_content_hash!==p.expectedHash)throw Error('Source changed: '+p.ordinal);
  state.slots[p.ordinal]={attempted:true,scenarioId:p.scenarioId,beforeHash:p.expectedHash};writeFileSync(path,JSON.stringify(state,null,2));
  console.log(JSON.stringify({ordinal:p.ordinal,status:'started'}));
  const result=await reviseMissionDraft(row,p.edits,'ai');
  writeFileSync(`.tmp/course-content/editorial-result-${p.ordinal}.json`,JSON.stringify(result,null,2));
  state.slots[p.ordinal]={...state.slots[p.ordinal],ok:result.ok,error:result.error??null,quality:result.quality?.verdict??null,ruleResult:result.ruleResult??null};writeFileSync(path,JSON.stringify(state,null,2));
  appendFileSync('.tmp/course-content/execution.jsonl',JSON.stringify({at:new Date().toISOString(),phase:'ai_editorial_revision',ordinal:p.ordinal,reason:p.reason,...state.slots[p.ordinal]})+'\n');
  console.log(JSON.stringify({ordinal:p.ordinal,...state.slots[p.ordinal],violations:result.violations?.filter(v=>v.level==='fail')}));
 }};
 await Promise.all([worker(),worker()]);
}finally{await supabase.auth.signOut({scope:'local'});}
