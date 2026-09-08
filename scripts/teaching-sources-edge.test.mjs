import assert from 'node:assert/strict';
import {before,beforeEach,after,test} from 'node:test';
import {build} from 'esbuild';
let handler,admin,fetches,env,answer;
const originalFetch=globalThis.fetch;
const call=async(body,auth='Bearer fixture')=>{const headers={};if(auth)headers.Authorization=auth;
  if(!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await handler(new Request('https://fixture.invalid/teaching-sources',{method:'POST',headers,body}));
  return {status:response.status,body:await response.json()};};
const file=(kind,name,type)=>{const form=new FormData();form.append('kind',kind);form.append('file',new File(['fixture'],name,{type}));return form;};
before(async()=>{
  globalThis.Deno={serve:fn=>{handler=fn;},env:{get:name=>env[name]}};
  globalThis.__sourceClient=()=>({auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},rpc:async()=>({data:admin})});
  const out=await build({entryPoints:['supabase/functions/teaching-sources/index.ts'],bundle:true,platform:'node',format:'esm',write:false,
    plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^npm:@supabase\/supabase-js/},a=>({path:a.path,namespace:'fixture'}));
      b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('/cors')?'export const corsHeaders={};':'export const createClient=()=>globalThis.__sourceClient();'}));}}]});
  await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
});
beforeEach(()=>{admin=true;fetches=[];env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture',OPENAI_API_KEY:'fixture'};
  answer={content:'자막 본문'};globalThis.fetch=async(url,request)=>{fetches.push({url,request});return Response.json(answer);};});
after(()=>{globalThis.fetch=originalFetch;delete globalThis.Deno;delete globalThis.__sourceClient;});
test('auth/admin checks precede every provider call',async()=>{assert.equal((await call({kind:'youtube',url:'https://youtu.be/abcdefghijk'},null)).status,401);
  admin=false;assert.equal((await call(file('image','a.png','image/png'))).status,403);assert.equal(fetches.length,0);});
test('URL ingestion is not supported and never fetches a caller URL',async()=>{
  for (const url of ['http://127.0.0.1/', 'https://youtu.be/abcdefghijk']) assert.equal((await call({kind:'youtube',url})).status,400);
  assert.equal(fetches.length,0);
});
test('audio is transcribed verbatim and unsupported/oversized input is rejected',async()=>{
  answer={text:'원음 전사'};const result=await call(file('audio','a.mp3','audio/mpeg'));assert.equal(result.status,200);
  assert.equal(result.body.extraction.method,'audio_transcription');assert.equal(fetches[0].request.body.get('model'),'gpt-4o-transcribe');
  assert.equal((await call(file('audio','a.exe','audio/mpeg'))).status,400);
  const form=file('audio','a.mp3','audio/mpeg');form.set('file',new File([new Uint8Array(10*1024*1024+1)],'a.mp3'));
  assert.equal((await call(form)).status,400);assert.equal(fetches.length,1);
});
test('image extraction rejects refusal/truncation instead of accepting partial text',async()=>{
  answer={choices:[{finish_reason:'length',message:{content:'partial'}}]};assert.equal((await call(file('image','a.png','image/png'))).status,502);
  answer={choices:[{finish_reason:'stop',message:{content:'이미지 원문'}}]};const result=await call(file('image','a.png','image/png'));assert.equal(result.status,200);assert.equal(result.body.text,'이미지 원문');
  assert.equal(fetches[1].request.method,'POST');assert.ok(JSON.parse(fetches[1].request.body).messages[1].content[0].image_url.url.startsWith('data:image/png;base64,'));
});
