import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
const dir='tmp/model-pilot';
mkdirSync(`${dir}/edge/supabase/functions/model-pilot-20260907`,{recursive:true});
const token=randomBytes(32).toString('hex');
const expiresAt=Date.now()+4*60*60*1000;
writeFileSync(`${dir}/access.json`,JSON.stringify({token,expiresAt}));
const hash=createHash('sha256').update(token).digest('hex');
writeFileSync(`${dir}/edge/supabase/config.toml`,'project_id = "pragma-isolated-model-pilot"\n');
writeFileSync(`${dir}/edge/supabase/functions/model-pilot-20260907/index.ts`, `
// Temporary, admin-only 3-case evaluation. No scenario or settings writes.
// Automatically expires; deleted when the experiment ends.
import {createClient} from 'npm:@supabase/supabase-js@2';
const allowed = new Set(['gpt-4.1-mini','gpt-4o','gpt-4.1','gpt-6-astra','claude-opus-5','claude-fable-5-1']);
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 try {
  if(req.method!=='POST')return json({error:'POST required'},405);
  if(Date.now()>${expiresAt})return json({error:'Pilot expired'},410);
  const token=req.headers.get('x-pilot-token')??'';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!=='${hash}')return json({error:'Pilot access required'},403);
  const auth=req.headers.get('Authorization');
  if(!auth?.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const user=await db.auth.getUser();
  if(user.error||!user.data.user)return json({error:'Invalid session'},401);
  const role=await db.rpc('is_admin');
  if(role.error||role.data!==true)return json({error:'Admin only'},403);
  const raw=await req.text();
  if(raw.length>250000)return json({error:'Input too large'},413);
  const {request,probe}=JSON.parse(raw);
  if(!request||!allowed.has(request.model))return json({error:'Unsupported pilot model'},400);
  const anthropic=request.model.startsWith('claude-');
  const key=Deno.env.get(anthropic?'ANTHROPIC_API_KEY':'OPENAI_API_KEY');
  if(!key)return json({error:'Provider not configured'},503);
  const headers=anthropic?{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'}:{Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const endpoint=anthropic?'https://api.anthropic.com/v1/':'https://api.openai.com/v1/';
  if(probe){
    const r=await fetch(endpoint+'models/'+encodeURIComponent(request.model),{headers});
    return json({providerStatus:r.status,body:await r.text()});
  }
  const limit=request.max_completion_tokens??request.max_tokens;
  if(!Number.isInteger(limit)||limit<1||limit>16000)return json({error:'Output budget required'},400);
  if(request.tools||request.stream||request.n>1)return json({error:'Single JSON completion only'},400);
  const r=await fetch(endpoint+(anthropic?'messages':'chat/completions'),{method:'POST',headers,body:JSON.stringify(request),signal:AbortSignal.timeout(135000)});
  return json({providerStatus:r.status,body:await r.text()});
 }catch(e){return json({error:e instanceof Error?e.message:'Pilot request failed'},502);}
});
`);
const base={industry:null,business_function:null,count:1,pdr_power:'equal',pdr_distance:'acquaintance',pdr_burden:'mid',domain:'daily'};
const cases=[
 {id:'request',title:'병원 접수 직원에게 예약 변경 문의',cell:{...base,speech_act_ui:'request',level:'intermediate',mode:'stt_interpreting',direction:'ko_zh',pdr_distance:'formal',pdr_burden:'low',theme_code:'daily_living',topic_code:'hospital_pharmacy_visit',situation_seed_ko:'나는 병원 접수 창구에서 처음 만난 접수 직원에게 내 진료 예약을 다음 주 화요일로 변경할 수 있는지 문의한다. 개인 일정이 바뀌어 기존 시간에 방문하기 어려우며, 직원은 예약 시스템에서 빈 시간을 확인하고 통상적인 예약 변경을 처리할 수 있다.'}},
 {id:'refusal',title:'기존 일정 때문에 동료의 주말 모임 초대 거절',cell:{...base,speech_act_ui:'refusal',level:'advanced',mode:'translation',direction:'zh_ko',theme_code:'relationship_social',topic_code:'invitation_refusal',situation_seed_ko:'직장에서 몇 차례 함께 일한 동료가 위챗으로 토요일 저녁 모임에 초대했다. 나는 이미 가족과의 약속이 있어 참석하지 못한다고 답장을 보낸다. 초대를 고맙게 받아들이면서 이번에는 참석하지 못한다는 뜻을 분명히 전한다.'}},
 {id:'apology',title:'조용한 시간에 낸 소음에 이웃에게 사과',cell:{...base,speech_act_ui:'apology',level:'advanced',mode:'stt_interpreting',direction:'zh_ko',theme_code:'daily_living',topic_code:'neighbor_noise_apology',situation_seed_ko:'어젯밤 늦게 가구 위치를 옮기다가 아래층에 소음을 냈다. 다음 날 복도에서 얼굴을 몇 차례 본 아래층 이웃을 만나, 늦은 시간에 시끄럽게 한 일을 사과하고 앞으로 밤에는 가구를 옮기지 않겠다고 말한다. 소음의 책임은 나에게 있다.'}}
];
writeFileSync(`${dir}/manifest.json`,JSON.stringify({createdAt:new Date().toISOString(),scope:'3 fixed cases, 2 generation routes; local draft artifacts only',reasoningEffort:'medium',maxOutputTokens:16000,maxEstimatedUsd:30,cases},null,2));
console.log('Prepared isolated 3-case pilot; access values not printed.');
