import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync,copyFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
const base='tmp/model-pilot';
const manifest=JSON.parse(readFileSync(`${base}/manifest.json`,'utf8'));
const calls=readFileSync(`${base}/calls.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const rows=[];
for(const item of manifest.cases)for(const route of ['baseline','astra']){
 const dir=`${base}/${item.id}-${route}`,p=`${dir}/result.json`;
 if(!existsSync(p))continue;
 const result=JSON.parse(readFileSync(p,'utf8'));
 const draft=existsSync(`${dir}/draft.json`)?JSON.parse(readFileSync(`${dir}/draft.json`,'utf8')):null;
 const matching=calls.filter(c=>c.case===item.id&&c.route===route);
 const generation=matching.filter(c=>!c.requestedModel.startsWith('claude-'));
 const uncertain=readdirSync(dir).filter(f=>f.endsWith('-uncertain.json')).map(file=>({file,...JSON.parse(readFileSync(join(dir,file),'utf8'))}));
 const genRequests=readdirSync(dir).filter(f=>/^call-\d+-request\.json$/.test(f)).sort().map(f=>JSON.parse(readFileSync(join(dir,f),'utf8')));
 rows.push({id:item.id,title:item.title,route,result,draft,calls:matching,uncertain,firstPromptHash:genRequests[0]?.promptHash,generationUsd:generation.reduce((s,c)=>s+c.estimatedUsd,0),generationProviderMs:generation.reduce((s,c)=>s+c.elapsedMs,0),generationCalls:generation.length});
}
const report={createdAt:new Date().toISOString(),manifest,rows,completedCallCount:calls.length,knownUsageEstimateUsd:calls.reduce((s,c)=>s+(c.estimatedUsd??0),0),uncertainCalls:rows.reduce((s,r)=>s+r.uncertain.length,0)};
writeFileSync(`${base}/summary.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rows:rows.map(r=>({case:r.id,route:r.route,core:r.result.core.ok,mission:r.result.promotion?.ok,quality:r.result.promotion?.quality?.verdict,genSeconds:Math.round(r.result.elapsedMs/1000),knownGenUsd:r.generationUsd,uncertain:r.uncertain.length,fable:r.result.fable?.result?.verdict,opus:r.result.opus?.result?.verdict,source:r.result.core.coreContent?.source_text,scene:r.result.core.coreContent?.situation_ko})),knownUsd:report.knownUsageEstimateUsd,completedCalls:calls.length,uncertainCalls:report.uncertainCalls},null,2));
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const modelLabel=r=>r.route==='astra'?'Astra':'기존 모델';
const status=r=>r.result.promotion?.ok?'문항 생성 완료':r.result.promotion?.terminal?.terminalStage==='topology'?'장면 구성 규칙에서 중단':'전체 문항 생성 시간 초과';
const money=n=>'$'+n.toFixed(3);
const section=(title,text)=>text?`<div class="field"><span>${escape(title)}</span><p>${escape(text)}</p></div>`:'';
function renderItem(m,i){
 const opts=m.candidates??m.corrections??m.reasons??[];
 return `<details><summary>MJT ${i+1} · ${escape(m.type)}</summary>${section('상황',m.situation_ko)}${section('관계',m.relation_ko)}${section('P / D / R',JSON.stringify(m.pdr))}${section('원문',m.source)}${section('판단할 표현',m.target)}${opts.map((o,n)=>`<article class="option"><strong>${n+1}. ${escape(o.text??o.text_ko)}</strong>${section('해설',o.note_ko)}${section('판정',o.accepted_band_codes?.join(', ')??(o.is_valid!==undefined?String(o.is_valid):o.reason_role??''))}</article>`).join('')}${section('해설',m.explanation_ko)}${section('추천 표현',m.recommended_example)}<details><summary>문항 원본 JSON</summary><pre>${escape(JSON.stringify(m,null,2))}</pre></details></details>`;
}
function reviewer(name,review,error){
 if(!review)return error?`<div class="review"><h4>${name}</h4><p>${escape(error)}</p></div>`:'';
 return `<div class="review"><h4>${name} · ${escape(review.result.verdict)}</h4><p>${escape(review.result.summary_ko)}</p>${review.result.findings.map(f=>`<details><summary>${escape(f.severity)} · ${escape(f.issue_ko)}</summary>${section('근거 위치',f.where)}${section('근거',f.reason_ko)}${section('제안',f.suggestion_ko)}${section('유보',f.uncertainty_ko)}</details>`).join('')}</div>`;
}
const panels=rows.map(r=>{
 const core=r.result.core.coreContent??{},mission=r.draft?.mission_content;
 return `<section class="panel" data-case="${r.id}" data-route="${r.route}"><div class="eyebrow">${modelLabel(r)}</div><h2>${escape(r.title)}</h2><p class="status">${status(r)}</p><div class="metrics"><div><b>${Math.round(r.result.elapsedMs/1000)}초</b><span>생성 흐름 소요 · 독립 검수 제외</span></div><div><b>${money(r.generationUsd)}${r.uncertain.length?' + 미확정':''}</b><span>생성 응답 사용량 추산</span></div></div>${section('장면',core.situation_ko)}${section('관계',core.relation_ko)}${section('원문',core.source_text)}${section('코어 규칙 결과',r.result.core.ruleResult)}${!mission?`<p class="notice">${escape(r.result.promotion?.error??'생성 중단')}</p><p>완성 미션의 품질을 비교할 수 없는 결과입니다. 실패도 실험 결과에 포함하며 자동 재생성하지 않았습니다.</p>`:`<h3>생성된 학습 미션</h3><p class="notice">교수자 채택 전 초안입니다. 아래 검수 지적을 함께 확인하세요.</p>${mission.mpj_items.map(renderItem).join('')}<details><summary>DCT · 직접 산출</summary>${section('상황',mission.production_task?.situation_ko)}${section('원문',mission.production_task?.source_text??core.source_text)}${(mission.production_task?.reference_alternatives??[]).map((x,i)=>section('참고 산출 '+(i+1),x.text)+section('해설',x.note_ko)).join('')}<pre>${escape(JSON.stringify(mission.production_task,null,2))}</pre></details>${reviewer('Fable 독립 검수',r.result.fable,r.result.fableError)}${reviewer('Opus 독립 검수',r.result.opus,r.result.opusError)}`}</section>`;
}).join('');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PRAGMA 모델 비교 · 미션 3개</title><style>body{margin:0;background:#f8f6ee;color:#1c2530;font:16px/1.75 system-ui,sans-serif}header{background:#1c2530;color:white;padding:28px max(24px,calc((100vw - 1140px)/2))}header small{color:#e4cd5b;letter-spacing:.15em}header h1{font-size:28px;margin:8px 0}main{max-width:1140px;margin:26px auto;padding:0 20px}h2{font-size:23px}h3{margin-top:32px}p{white-space:pre-wrap}nav{display:flex;gap:8px;margin:20px 0;flex-wrap:wrap}button{font:inherit;border:1px solid #cfcbbd;border-radius:24px;background:white;padding:9px 20px;cursor:pointer}button.active{background:#e4cd5b;border-color:#e4cd5b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.panel{background:white;border:1px solid #dedbd0;border-radius:18px;padding:25px;min-width:0}.panel[hidden]{display:none}.eyebrow{color:#756428;font-weight:700}.status{font-weight:700}.metrics{display:flex;gap:24px;border-block:1px solid #e8e4d8;padding:16px 0}.metrics b{display:block;font-size:24px}.metrics span,.field>span{font-size:13px;color:#6e7780}.field p{margin:4px 0 17px}.field{margin:14px 0}details{border-top:1px solid #ddd9ce;padding:12px 0}summary{cursor:pointer;font-weight:600}pre{font:12px/1.6 monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f6f2;padding:12px}.notice{padding:14px;border-left:4px solid #e4cd5b;background:#faf6df}.option{padding:12px;border:1px solid #e3dfd2;margin:10px 0;border-radius:8px}.review{margin-top:25px}.method{font-size:14px;color:#636b73}footer{margin:30px 0;color:#6e7780;font-size:13px}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style><header><small>PRAGMA / MODEL PILOT</small><h1>같은 조건, 미션 3개</h1><div>요청 · 거절 · 사과 — 2026. 09. 07</div></header><main><p class="notice"><b>파일럿 결과이며 운영 채택본이 아닙니다.</b> 장면·원문과 전체 미션 생성의 성공 여부를 구분해 비교합니다. AI 검수의 fail 개수는 정확도 점수가 아닙니다.</p><p class="method">기존 생성: GPT-4.1 mini / GPT-4o / GPT-4.1 · 비교 생성: GPT-6 Astra medium · 독립 검수: Fable 5.1 / Opus 5 medium. 같은 경우의 최초 코어 프롬프트를 고정했습니다. 이후 단계는 각 모델이 생성한 내용을 입력하므로 전체 흐름 비교입니다.</p><nav>${manifest.cases.map((c,i)=>`<button class="${i===0?'active':''}" data-select="${c.id}">${{request:'요청',refusal:'거절',apology:'사과'}[c.id]}</button>`).join('')}</nav><div class="grid">${panels}</div><footer>응답이 확보된 ${calls.length}회 호출의 일반 단가 추산 합계 ${money(report.knownUsageEstimateUsd)}. 응답을 확보하지 못한 ${report.uncertainCalls}회는 과금액 미확정으로 별도입니다. 캐시 할인·세금·실제 청구서를 반영한 확정 금액이 아닙니다. 운영 미션·편성·모델 설정은 변경하지 않았습니다.</footer></main><script>const pick=id=>{document.querySelectorAll('.panel').forEach(p=>p.hidden=p.dataset.case!==id);document.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.select===id))};document.querySelectorAll('button').forEach(b=>b.onclick=()=>pick(b.dataset.select));pick('request');</script></html>`;
writeFileSync(`${base}/comparison.html`,html);
if(process.argv.includes('--archive')){
 const dest='docs/evidence/2026-09-07-model-pilot';mkdirSync(dest,{recursive:true});
 for(const f of ['manifest.json','availability.json','calls.jsonl','summary.json','comparison.html','prepare.mjs','run.mjs','report.mjs'])copyFileSync(join(base,f),join(dest,f));
 for(const r of rows){
  const dir=join(base,`${r.id}-${r.route}`);
  function copy(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
   const from=join(dir,entry.name),to=join(dest,relative(base,from));
   if(entry.isDirectory()){mkdirSync(to,{recursive:true});copy(from);}else{mkdirSync(join(to,'..'),{recursive:true});copyFileSync(from,to);}
  }}
  copy(dir);
 }
 console.log('Archived local-only evidence. Access token and deployed gateway excluded.');
}
