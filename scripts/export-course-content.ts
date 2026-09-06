// Read-only database snapshot + private instructor review book. Never publishes learner answers.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {SPEECH_ACT_UI} from "../src/lib/pragma/enums";
import {weekCentralQuestion,CENTRAL_QUESTION_GUIDANCE} from "../src/lib/curriculum/weekGuidance";
import {nextReviewStage,professorReviewFindings} from "../supabase/functions/_shared/contentReview";
const dir=".tmp/course-content";
const load=(name:string)=>JSON.parse(readFileSync(dir+"/"+name,"utf8"));
const plan=load("plan.json"),generated=load("generation-state.json"),reviewed=load("state.json");
const replacements=existsSync(dir+"/replacement-state.json")?load("replacement-state.json"):{slots:{}};
const focused=existsSync(dir+"/focused-state.json")?load("focused-state.json"):{slots:{}};
const db=createClient(process.env.VITE_SUPABASE_URL!,process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await db.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL!,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD!});
if(login.error)throw login.error;
try {
  const admin=await db.rpc("is_admin");if(admin.error||admin.data!==true)throw new Error("Administrator required");
  const queries=await Promise.all([
    db.from("scenarios").select("*").eq("core_content->generation->>content_release_id",plan.release).order("scenario_id").range(0,199),
    db.from("content_review_runs").select("*").eq("kind","mission").order("created_at",{ascending:false}).range(0,199),
    db.from("curriculum_week_scenarios").select("id,outline_id,week_no,scenario_id,position").order("id"),
  ]);
  for(const q of queries)if(q.error)throw q.error;
  if(queries[0].data!.length===200||queries[1].data!.length===200)throw new Error("Snapshot page full; paginate before reporting totals");
  const rows=queries[0].data!,reviews=queries[1].data!;
  const initial=JSON.parse(readFileSync(".tmp/course-content-inventory.json","utf8"));
  const stableAssignments=(xs:any[])=>JSON.stringify([...xs].sort((a,b)=>a.id.localeCompare(b.id)));
  if(stableAssignments(initial.assignments)!==stableAssignments(queries[2].data!))throw new Error("Course assignments changed during preparation");
  const slots=plan.plan.map((slot:any)=>{
    const original=generated.slots[slot.ordinal]??{},alternate=replacements.slots[slot.ordinal];
    const id=alternate?.selected?alternate.scenarioId:original.scenarioId??slot.existingScenarioId;
    const row=rows.find(r=>r.scenario_id===id)??null;
    const connected=focused.slots[slot.ordinal];
    const review=connected?.ok ? reviews.find(r=>r.id===connected.reviewId)??null : reviews.find(r=>r.target_id===id)??null;
    const mission=row?.mission_content;
    const full=mission?.mpj_items?.length===5;
    const aiComplete=!!review&&nextReviewStage(review as any)==="professor"&&review.rules?.verdict!=="fail";
    const requiredFindings=professorReviewFindings(review as any);
    const hasFindings=requiredFindings.length>0;
    const status=!full?"미션 미완성":!aiComplete?"점검 연결 확인 필요":hasFindings?"쟁점 우선 확인":"기본 점검 완료";
    return {...slot,scenarioId:id??null,row,review,status,full,aiComplete,hasFindings,requiredFindings,
      generationError:original.error??null,replacement:alternate??null,reviewError:aiComplete?null:review?.last_error??reviewed.slots[slot.ordinal]?.reviewError??null,
      centralQuestion:weekCentralQuestion({week_no:slot.weekNo,type:"regular",speech_act:slot.speechAct})};
  });
  const at=new Date().toISOString();
  const summary={planned:slots.length,completeDrafts:slots.filter((s:any)=>s.full).length,missing:slots.filter((s:any)=>!s.full).length,
    qualityFail:slots.filter((s:any)=>s.row?.mission_content?.quality_check?.verdict==="fail").length,
    aiReviewComplete:slots.filter((s:any)=>s.aiComplete).length,professorApproved:slots.filter((s:any)=>s.row?.mission_status==="reviewed").length,
    priorityMissions:slots.filter((s:any)=>s.hasFindings).length,criticalMissions:slots.filter((s:any)=>s.requiredFindings.some((f:any)=>f.severity==="fail")).length,
    generationEvidenceReused:slots.filter((s:any)=>!!s.review?.generation_quality).length,
    assignmentsUnchanged:true,originalAssignmentCount:initial.assignments.length,
    byCourse:[...new Set(slots.map((s:any)=>s.courseId))].map(id=>{const ss=slots.filter((s:any)=>s.courseId===id);return {title:ss[0].courseTitle,planned:ss.length,drafts:ss.filter((s:any)=>s.full).length};})};
  const bundle={version:"course_content_review_book_v2_focused",at,lifecycle:"candidate_for_professor_review",release:plan.release,planHash:plan.planHash,
    scope:plan.scope,summary,slots};
  const json=JSON.stringify(bundle,null,2);
  writeFileSync(dir+"/bundle-data.json",json);
  writeFileSync(dir+"/bundle.sha256",createHash("sha256").update(json).digest("hex")+"  bundle-data.json\n");
  writeFileSync(dir+"/summary.json",JSON.stringify({...summary,at},null,2));
  const esc=(s:any)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
  const pdr=(p:any)=>p?Object.entries(p).map(([k,v])=>`${k.toUpperCase()}=${v}`).join(" · "):"";
  const titles:any={scale4:"첫인상 판단",judge3:"맥락 대비 판단",fix_choice:"판단하고 고쳐보기",reason:"이유 찾기",multi_judge:"여러 초안 비교"};
  const para=(label:string,value:any)=>value?`<p><b>${esc(label)}</b> ${esc(value)}</p>`:"";
  const findingList=(r:any)=>r?.result?`${para("판정",r.result.verdict)}<ul>${(r.result.findings??[]).map((f:any)=>`<li><b>${esc(f.severity)}</b> ${esc(f.issue_ko)}${para("제안",f.suggestion_ko)}</li>`).join("")}</ul>`:"<p>저장된 결과 없음</p>";
  const content=slots.map((s:any)=>{
    const m=s.row?.mission_content;
    const itemHtml=(m?.mpj_items??[]).map((it:any)=>`<details><summary>MJT${it.id} · ${esc(titles[it.type])}</summary>${para("상황",it.situation_ko)}${para("관계",it.relation_ko)}${para("조건",pdr(it.pdr))}${para("원문",it.source)}${para("판단 초안",it.target)}${para("기존 판정",(it.accepted_band_codes??it.accepted_scale_codes??[it.problem_band_code]).filter(Boolean).join(" / "))}${para("해설",it.explanation_ko)}${para("참고 표현",it.recommended_example)}<ol>${(it.corrections??it.candidates??it.reasons??[]).map((c:any)=>`<li>${esc(c.text??c.text_ko)}${para("기존 판정",c.accepted_band_codes?.join(" / ")??(typeof c.is_valid==="boolean"?(c.is_valid?"유효":"조정 필요"):c.kind))}${para("근거",c.note_ko)}</li>`).join("")}</ol></details>`).join("");
    return `<article data-course="${esc(s.courseId)}" data-state="${esc(s.status)}"><header><span>${esc(s.level==="advanced"?"고급":"중급")}</span><small>${esc(s.courseTitle)}</small><h2>${s.weekNo}주 · ${esc((SPEECH_ACT_UI as any)[s.speechAct])} · ${s.mode==="translation"?"번역":"통역"}</h2><mark>${esc(s.status)}</mark></header>${para("중심 질문",s.centralQuestion)}${para("장면",s.row?.core_content?.situation_ko??s.cell?.situation_seed_ko)}${para("원문",s.row?.core_content?.source_text)}${s.full?itemHtml:`<p class="issue">미션 생성 미완성: ${esc(s.replacement?.error??s.generationError)}</p>`}${m?`<details><summary>DCT · 산출 과제</summary>${para("역할·상황",m.production_task?.situation_ko)}${para("원문",m.production_task?.source_text)}${para("조건",pdr(m.production_task?.pdr))}<ul>${(m.production_task?.reference_alternatives??[]).map((a:any)=>`<li>${esc(a.text)}${para("해설",a.note_ko)}</li>`).join("")}</ul></details>`:""}${s.requiredFindings.length?`<details open><summary>교수자 판단 쟁점 (${s.requiredFindings.length}건)</summary><ul>${s.requiredFindings.map((f:any)=>`<li>${esc(f.id)} · ${esc(f.severity)}${para("지적",f.issue_ko)}${para("제안",f.suggestion_ko)}</li>`).join("")}</ul></details>`:""}<details><summary>저장된 검토 결과 · 추가 호출 없음</summary>${para("기존 생성 품질점검",m?.quality_check?.summary_ko)}<h3>OpenAI</h3>${findingList(s.review?.openai_review)}<h3>선택적 Claude 검토 · 기존 결과</h3>${findingList(s.review?.claude_review)}<h3>지적 재검토</h3>${para("요약",s.review?.adjudication?.result?.summary_ko)}<ul>${(s.review?.adjudication?.result?.decisions??[]).map((d:any)=>`<li>${esc(d.decision)} · ${esc(d.finding_id)}${para("근거",d.rationale_ko)}${para("수정 제안",d.proposed_change_ko)}</li>`).join("")}</ul>${para("미완료 사유",s.reviewError)}</details><footer>${esc(s.scenarioId)}${s.scenarioId?` · <a href="https://pragma.up.railway.app/admin/review?scenarioId=${encodeURIComponent(s.scenarioId)}" target="_blank" rel="noopener">앱에서 검토</a>`:""}</footer></article>`;
  }).join("");
  const options=summary.byCourse.map((c:any)=>`<option value="${esc(slots.find((s:any)=>s.courseTitle===c.title).courseId)}">${esc(c.title)}</option>`).join("");
  writeFileSync(dir+"/review-book.html",`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PRAGMA 교과목 콘텐츠 검토본</title><style>body{margin:0;background:#f7f6f1;color:#202731;font:16px/1.7 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:36px 22px}h1{font-size:30px;line-height:1.3}h2{font-size:21px;margin:8px 0}small{margin-left:12px;color:#596473}nav{position:sticky;top:0;background:#f7f6f1;padding:12px 0;z-index:2;display:flex;gap:12px;flex-wrap:wrap}select{padding:10px;border:1px solid #cbc9bd;border-radius:8px;background:white}article{background:white;border:1px solid #e0ded5;border-radius:14px;padding:24px;margin:22px 0}header span{background:#f0eddf;color:#766332;padding:3px 9px;border-radius:6px;font-weight:600}mark{background:#f3eaca;color:#6d5523;padding:3px 9px;border-radius:5px;font-size:13px}details{border-top:1px solid #eceae2;padding:12px 0}summary{cursor:pointer;font-weight:650}p{margin:9px 0;white-space:pre-wrap}b{color:#505d6b;margin-right:7px}footer{font-size:12px;overflow-wrap:anywhere;color:#6e7784;margin-top:20px}.issue{color:#a34d30}.intro{border-left:4px solid #c7b35b;padding:8px 18px}.counts{display:flex;gap:25px;margin:24px 0}.counts strong{font-size:28px;display:block}a{color:#3a6579}[hidden]{display:none}@media print{nav{display:none}article{break-before:page;border:0}details>*{display:block}main{padding:0}}</style><main><p>PRAGMA · 교수자용 비공개 검토본</p><h1>세 교과목의 주차별 콘텐츠</h1><div class="intro"><p>현재 미션의 생성 품질점검을 재사용했습니다. 추가 모델 전수 검토는 필요하지 않습니다. ‘쟁점 우선 확인’의 판정·해설을 먼저 보고, 사용할 미션은 앱에서 교수자가 승인합니다.</p><p>9개 화행 주차마다 번역·통역 각 1개. 13주는 수업 중 화행 선정 후 별도 구성합니다.</p><p>${esc(CENTRAL_QUESTION_GUIDANCE)}</p></div><div class="counts"><div><strong>${summary.aiReviewComplete}</strong>기본 점검 연결</div><div><strong>${summary.completeDrafts}</strong>완전 미션 초안</div><div><strong>${summary.priorityMissions}</strong>쟁점 우선 확인</div><div><strong>${summary.professorApproved}</strong>교수자 승인</div></div><p>DB 기준 ${esc(at)} · 초기 편성 ${initial.assignments.length}건 유지</p><nav><select id="course" aria-label="교과목"><option value="">전체 교과목</option>${options}</select><select id="status" aria-label="콘텐츠 상태"><option value="">전체 상태</option>${["쟁점 우선 확인","기본 점검 완료","점검 연결 확인 필요","미션 미완성"].map(s=>`<option>${s}</option>`).join("")}</select></nav>${content}</main><script>const controls=[document.getElementById('course'),document.getElementById('status')];controls.forEach(c=>c.addEventListener('change',()=>document.querySelectorAll('article').forEach(a=>a.hidden=!!((controls[0].value&&a.dataset.course!==controls[0].value)||(controls[1].value&&a.dataset.state!==controls[1].value)))));</script></html>`);
  const md=["# PRAGMA 교과목 콘텐츠 확보 현황", "",`기준: ${at} / ${plan.release}`,"",`54슬롯 중 완전 미션 초안 ${summary.completeDrafts}개, 미완성 ${summary.missing}개. 교수자 승인 ${summary.professorApproved}개. 초기 편성 ${initial.assignments.length}건 유지.` ,"", "| 교과목 | 주차 | 화행 | 모드 | 상태 | 시나리오 |","|---|---:|---|---|---|---|",...slots.map((s:any)=>`| ${s.courseTitle} | ${s.weekNo} | ${(SPEECH_ACT_UI as any)[s.speechAct]} | ${s.mode==="translation"?"번역":"통역"} | ${s.status} | ${s.scenarioId??"미저장"} |`),"","생성본·검토본이며 최종 동결 코퍼스나 학습효과 검증 자료로 간주하지 않는다. 원문·MJT5·DCT1·해설 및 검토 결과는 review-book.html, 재현용 원본은 bundle-data.json과 bundle.sha256에 보존한다."];
  writeFileSync(dir+"/content-matrix.md",md.join("\n"));
  console.log(JSON.stringify({...summary,at}));
}finally{await db.auth.signOut({scope:"local"});}
