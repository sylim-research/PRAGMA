// Connect current saved evidence; deliberately never invokes an AI review stage or professor approval.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const memory=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k),clear:()=>memory.clear()}});
const [{supabase},{contentReviewRequest},{nextReviewStage,professorReviewFindings}]=await Promise.all([import('../src/integrations/supabase/client'),import('../src/lib/pragma/contentReviewApi'),import('../supabase/functions/_shared/contentReview')]);
const bundle=JSON.parse(readFileSync('.tmp/course-content/bundle-data.json','utf8'));
const path='.tmp/course-content/focused-state.json',state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{planHash:bundle.planHash,slots:{}};
if(bundle.planHash!==state.planHash)throw Error('Plan changed');
const login=await supabase.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL!,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD!});if(login.error)throw login.error;
try {
 const admin=await supabase.rpc('is_admin');if(admin.error||admin.data!==true)throw Error('Admin required');
 let cursor=0;const worker=async()=>{while(cursor<bundle.slots.length){const slot=bundle.slots[cursor++];if(state.slots[slot.ordinal]?.ok)continue;
  try {
   const target={kind:'mission' as const,targetId:slot.scenarioId};let result=await contentReviewRequest(target,'inspect');
   if(result.reusableGenerationQuality===undefined)throw Error('Focused Edge deployment not available');
   if(result.run?.approved_at)throw Error('Unexpected professor approval');
   result=await contentReviewRequest(target,'rules',result);
   const ok=result.run?.approval_policy==='focused_v1'&&nextReviewStage(result.run)==='professor'&&result.run.rules.verdict!=='fail';
   state.slots[slot.ordinal]={ok,scenarioId:slot.scenarioId,reviewId:result.run?.id,sourceHash:result.sourceHash,contentHash:result.contentHash,generationReused:!!result.run?.generation_quality,critical:professorReviewFindings(result.run).filter(f=>f.severity==='fail').length,professorIssues:professorReviewFindings(result.run).length,error:ok?null:'Current evidence requires attention'};
  }catch(error){state.slots[slot.ordinal]={ok:false,error:error instanceof Error?error.message:String(error)};}
  writeFileSync(path,JSON.stringify(state,null,2));console.log(JSON.stringify({ordinal:slot.ordinal,...state.slots[slot.ordinal]}));
 }};await Promise.all([worker(),worker(),worker()]);
}finally{await supabase.auth.signOut({scope:'local'});}
