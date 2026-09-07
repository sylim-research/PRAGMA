import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.env');
const root=process.cwd(), out=resolve('tmp/model-pilot');
const manifest=JSON.parse(readFileSync(`${out}/manifest.json`,'utf8'));
const access=JSON.parse(readFileSync(`${out}/access.json`,'utf8'));
const realFetch=globalThis.fetch;
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const url=process.env.VITE_SUPABASE_URL;
let session, ctx;
const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const log=(type,extra={})=>console.log(JSON.stringify({time:new Date().toISOString(),case:ctx?.id,route:ctx?.route,type,...extra}));
const prices={'gpt-4.1-mini':[.4,1.6],'gpt-4o':[2.5,10],'gpt-4.1':[2,8],'gpt-6-astra':[10,50],'claude-opus-5':[5,25],'claude-fable-5-1':[10,50]};
let callCount=0,totalCost=0;
if(existsSync(`${out}/calls.jsonl`))for(const line of readFileSync(`${out}/calls.jsonl`,'utf8').trim().split('\n').filter(Boolean)){const c=JSON.parse(line);totalCost+=c.estimatedUsd??0;callCount++;}
async function gateway(request,probe=false){
 const r=await realFetch(`${url}/functions/v1/model-pilot-20260907`,{method:'POST',headers:{apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json','x-pilot-token':access.token},body:JSON.stringify({request,probe}),signal:AbortSignal.timeout(145000)});
 const data=await r.json();
 if(!r.ok)throw new Error(`Pilot transport ${r.status}: ${data.error??data.message??''}`);
 return data;
}
async function providerFetch(endpoint,init){
 const request=JSON.parse(init.body);
 const anthropic=endpoint.includes('anthropic.com');
 if(request.model==='gpt-6-astra'){
  delete request.temperature;delete request.top_p;delete request.max_tokens;
  request.reasoning_effort='medium';request.max_completion_tokens=16000;
 }else if(anthropic){request.max_tokens=16000;request.output_config={...request.output_config,effort:'medium'};}
 else {delete request.max_tokens;request.max_completion_tokens=Math.min(request.max_completion_tokens??16000,16000);}
 if(totalCost>=manifest.maxEstimatedUsd||callCount>=100)throw new Error('Pilot spending/call guard reached');
 const n=++callCount, prefix=`${ctx.dir}/call-${String(n).padStart(3,'0')}`;
 const started=Date.now();
 save(prefix+'-request.json',{endpoint,request,promptHash:hash({messages:request.messages,system:request.system,responseFormat:request.response_format??request.output_config?.format}),startedAt:new Date().toISOString()});
 log('provider_start',{call:n,model:request.model});
 let result;
 try {result=await gateway(request);}catch(error){
  save(prefix+'-uncertain.json',{message:error.message,elapsedMs:Date.now()-started});
  throw error;
 }
 let body;try{body=JSON.parse(result.body);}catch{body={unparsed:result.body};}
 save(prefix+'-response.json',{status:result.providerStatus,body});
 const usage=body.usage??{},input=usage.prompt_tokens??usage.input_tokens??0,output=usage.completion_tokens??usage.output_tokens??0;
 const [pi,po]=prices[request.model];
 const cost=(input*pi+output*po)/1e6;
 totalCost+=cost;
 const event={case:ctx.id,route:ctx.route,call:n,requestedModel:request.model,returnedModel:body.model,status:result.providerStatus,responseId:body.id,usage,elapsedMs:Date.now()-started,estimatedUsd:cost,promptHash:hash({messages:request.messages,system:request.system,responseFormat:request.response_format??request.output_config?.format}),requestFile:prefix+'-request.json'};
 appendFileSync(`${out}/calls.jsonl`,JSON.stringify(event)+'\n');
 log('provider_end',{call:n,model:request.model,status:result.providerStatus,elapsedSec:Math.round(event.elapsedMs/1000),estimatedUsd:cost,totalCost});
 return new Response(result.body,{status:result.providerStatus,headers:{'Content-Type':'application/json'}});
}
const fakeDb={
 functions:{invoke:async(name,{body})=>{
  if(name!=='generate-scenario')throw new Error('Unexpected edge '+name);
  const i=++ctx.actionCount;save(`${ctx.dir}/action-${i}-request.json`,body);
  const r=await globalThis.__pilotHandler(new Request('http://isolated.local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const data=await r.json();save(`${ctx.dir}/action-${i}-response.json`,{status:r.status,data});
  if(!r.ok)return {data:null,error:{message:data.error??`HTTP ${r.status}`,context:{status:r.status}}};
  return {data,error:null};
 }},
 rpc:async(name,args)=>{
  save(`${ctx.dir}/local-rpc-${name}.json`,args);
  if(name==='save_generated_core'){ctx.row={scenario_id:ctx.scenarioId,...args.p_payload};return {data:ctx.scenarioId,error:null};}
  if(name==='save_generated_mission'||name==='save_generated_mission_revision'){
   ctx.row={...ctx.row,...args.p_payload,mission_status:'generated'};save(`${ctx.dir}/draft.json`,ctx.row);return {data:ctx.scenarioId,error:null};
  }
  throw new Error('Database mutation blocked: '+name);
 },
 from:()=>{throw new Error('Unexpected database access blocked');}
};
globalThis.__pilotDb=fakeDb;
globalThis.Deno={serve:handler=>{globalThis.__pilotHandler=handler;},env:{get:key=>({OPENAI_API_KEY:'LOCAL_PILOT_PLACEHOLDER',SUPABASE_URL:'http://pilot-db.local',SUPABASE_SERVICE_ROLE_KEY:'LOCAL_PILOT_PLACEHOLDER'}[key])}};
globalThis.fetch=async(input,init)=>{
 const endpoint=String(input);
 if(endpoint.startsWith('https://api.openai.com/'))return providerFetch(endpoint,init);
 if(endpoint==='http://pilot-db.local/rest/v1/llm_invocation_events'){
  appendFileSync(`${ctx.dir}/telemetry.jsonl`,init.body+'\n');return new Response(null,{status:201});
 }
 if(endpoint==='http://pilot-db.local/rest/v1/rpc/hsk3_match_tokens'){
  const {data,error}=await db.rpc('hsk3_match_tokens',JSON.parse(init.body));
  if(error)throw new Error('HSK read failed: '+error.message);
  return new Response(JSON.stringify(data),{status:200});
 }
 // Supabase client authentication and the HSK read RPC use the real endpoint.
 if(endpoint.startsWith(url+'/auth/')||endpoint===url+'/rest/v1/rpc/hsk3_match_tokens')return realFetch(input,init);
 throw new Error('Network action blocked: '+endpoint);
};
async function bundle(contents,route){
 const built=await build({stdin:{contents,resolveDir:root,sourcefile:'pilot-entry.ts',loader:'ts'},bundle:true,write:false,platform:'neutral',format:'iife',target:'es2022',tsconfig:resolve('tsconfig.app.json'),plugins:[{
  name:'isolated-pilot-adapters',setup(b){
   b.onResolve({filter:/^@\/integrations\/supabase\/client$/},()=>({path:'pilot-client',namespace:'pilot'}));
   b.onLoad({filter:/.*/,namespace:'pilot'},()=>({contents:'export const supabase=globalThis.__pilotDb;',loader:'js'}));
   if(route==='astra')b.onLoad({filter:/openaiRequestContract\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replaceAll("'gpt-4.1-mini'","'gpt-6-astra'").replaceAll("'gpt-4o'","'gpt-6-astra'").replaceAll("'gpt-4.1'","'gpt-6-astra'"),loader:'ts'}));
  }
 }]});
 (0,eval)(built.outputFiles[0].text);
}
try{
 const auth=await db.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD});
 if(auth.error||!auth.data.session)throw new Error('Admin authentication failed');session=auth.data.session;
 if(process.argv.includes('--probe')){
  const results=[];
  for(const model of ['gpt-6-astra','claude-fable-5-1']){
   const r=await gateway({model},true);let body;try{body=JSON.parse(r.body);}catch{body={unparsed:r.body};}
   results.push({model,status:r.providerStatus,body});
  }
  save(`${out}/availability.json`,results);console.log(JSON.stringify(results,null,2));
 }else{
  const selected=process.argv.find(a=>a.startsWith('--case='))?.split('=')[1];
  const chosenRoute=process.argv.find(a=>a.startsWith('--route='))?.split('=')[1];
  for(const route of chosenRoute?[chosenRoute]:['baseline','astra']){
   await bundle(`import './supabase/functions/generate-scenario/index.ts';import {runCoreCell} from './src/lib/pragma/coreBatchRun.ts';import {promoteCore} from './src/lib/pragma/promoteMission.ts';import {buildContentReviewDomain} from './src/lib/pragma/contentReviewDomain.ts';import {callContentReviewer} from './supabase/functions/_shared/contentReviewProvider.ts';globalThis.__pilotApp={runCoreCell,promoteCore,buildContentReviewDomain,callContentReviewer};`,route);
   for(const item of manifest.cases.filter(c=>!selected||c.id===selected)){
    const dir=`${out}/${item.id}-${route}`;mkdirSync(dir,{recursive:true});
    if(process.argv.includes('--compare-opus')){
     if(!existsSync(`${dir}/draft.json`)){log('no_draft_for_review',{id:item.id});continue;}
     const result=JSON.parse(readFileSync(`${dir}/result.json`,'utf8'));
     if(result.opus||result.opusError){log('skip_opus_completed');continue;}
     const reviewDir=`${dir}/opus-review`;mkdirSync(reviewDir,{recursive:true});
     if(existsSync(`${reviewDir}/started.json`))throw new Error('Opus review already attempted; inspect before retrying');
     ctx={...item,route,dir:reviewDir,row:JSON.parse(readFileSync(`${dir}/draft.json`,'utf8'))};
     const reviewRow=Object.fromEntries(['speech_act','learner_level','domain','industry_sector','business_function','mode','source_modality','theme_code','topic_code','language_direction','core_content','mission_content'].map(key=>[key,ctx.row[key]]));
     const {snapshot,rules}=__pilotApp.buildContentReviewDomain('mission',{scenario:reviewRow});
     save(`${reviewDir}/started.json`,{startedAt:new Date().toISOString()});save(`${reviewDir}/snapshot.json`,snapshot);
     try{result.opus=await __pilotApp.callContentReviewer({stage:'claude',run:{snapshot,rules},apiKey:'LOCAL_PILOT_PLACEHOLDER',model:'claude-opus-5',fetcher:providerFetch});result.opus.request_parameters={max_tokens:16000,effort:'medium',timeout_ms:135000};}
     catch(error){result.opusError=error.message;}
     save(`${dir}/result.json`,result);log('opus_complete',{verdict:result.opus?.result?.verdict,error:result.opusError});continue;
    }
    if(process.argv.includes('--review-only')){
     const result=JSON.parse(readFileSync(`${dir}/result.json`,'utf8'));
     if(result.fableBlindReview){log('skip_review_complete');continue;}
     const reviewDir=`${dir}/blind-review`;mkdirSync(reviewDir,{recursive:true});
     if(existsSync(`${reviewDir}/started.json`))throw new Error('Review already attempted; inspect before retrying');
     ctx={...item,route,dir:reviewDir,row:JSON.parse(readFileSync(`${dir}/draft.json`,'utf8'))};
     const reviewRow=Object.fromEntries(['speech_act','learner_level','domain','industry_sector','business_function','mode','source_modality','theme_code','topic_code','language_direction','core_content','mission_content'].map(key=>[key,ctx.row[key]]));
     const {snapshot,rules}=__pilotApp.buildContentReviewDomain('mission',{scenario:reviewRow});
     save(`${reviewDir}/started.json`,{startedAt:new Date().toISOString()});save(`${reviewDir}/snapshot.json`,snapshot);
     result.fableInitialUnblinded=result.fable;
     delete result.fable;
     try{result.fable=await __pilotApp.callContentReviewer({stage:'claude',run:{snapshot,rules},apiKey:'LOCAL_PILOT_PLACEHOLDER',model:'claude-fable-5-1',fetcher:providerFetch});result.fable.request_parameters={max_tokens:16000,effort:'medium',timeout_ms:135000};result.fableBlindReview=true;}
     catch(error){result.fableError=error.message;}
     save(`${dir}/result.json`,result);log('review_complete',{verdict:result.fable?.result?.verdict,error:result.fableError});continue;
    }
    if(existsSync(`${dir}/result.json`)){log('skip_completed',{id:item.id,route});continue;}
    if(existsSync(`${dir}/started.json`))throw new Error(`Unfinished paid run requires inspection: ${dir}`);
    ctx={...item,route,dir,scenarioId:randomUUID(),actionCount:0};save(`${dir}/started.json`,{startedAt:new Date().toISOString(),route,cell:item.cell});
    const start=Date.now();
    const core=await __pilotApp.runCoreCell(item.cell,0,{runId:`model-pilot-20260907-${item.id}-${route}`});save(`${dir}/core-result.json`,core);
    log('core_complete',{ok:core.ok,stage:core.terminalStage,error:core.error});
    let promotion;
    if(core.ok){
     promotion=await __pilotApp.promoteCore(ctx.row,{onProgress:p=>log('promotion',p)});
     save(`${dir}/promotion-result.json`,promotion);
    }
    const result={case:item.id,title:item.title,route,core,promotion,elapsedMs:Date.now()-start};
    if(ctx.row?.mission_content){
     const reviewRow=Object.fromEntries(['speech_act','learner_level','domain','industry_sector','business_function','mode','source_modality','theme_code','topic_code','language_direction','core_content','mission_content'].map(key=>[key,ctx.row[key]]));
     const {snapshot,rules}=__pilotApp.buildContentReviewDomain('mission',{scenario:reviewRow});
     save(`${dir}/snapshot.json`,snapshot);result.rules=rules;
     // Independent Fable sees content and criteria only; no other model's verdict.
     try{
      result.fable=await __pilotApp.callContentReviewer({stage:'claude',run:{snapshot,rules},apiKey:'LOCAL_PILOT_PLACEHOLDER',model:'claude-fable-5-1',fetcher:providerFetch});
      result.fable.request_parameters={max_tokens:16000,effort:'medium',timeout_ms:135000};
     }catch(error){result.fableError=error.message;}
    }
    save(`${dir}/result.json`,result);log('case_complete',{ok:promotion?.ok??false,quality:promotion?.quality?.verdict,error:promotion?.error,fable:result.fable?.result?.verdict,fableError:result.fableError});
   }
  }
 }
}catch(error){console.error(error.stack??error.message);process.exitCode=1;}
finally{globalThis.fetch=realFetch;await db.auth.signOut({scope:'local'});}
