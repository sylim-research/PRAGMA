import type { InstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import type { InstructorGuideTimingPlan } from "@/lib/pragma/instructorGuideTiming";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeeklyMaterialDocument } from "@/components/curriculum/WeeklyMaterialDocument";
import type { WeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";

type ExportMission = {
  scenarioId: string;
  labelKo?: string;
  guide: InstructorMissionGuide;
};

export type InstructorGuideHtmlExport = {
  primary: ExportMission;
  secondary?: ExportMission;
  timingPlan: InstructorGuideTimingPlan;
  generatedAt?: Date;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const paragraphs = (items: Array<[string, string | undefined]>) => items
  .filter(([, value]) => value)
  .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
  .join("");

function slide(title: string, missionLabel: string, body: string, revealable = false) {
  return `<section class="slide" data-title="${escapeHtml(`${missionLabel} · ${title}`)}" data-reveal="${revealable}">
    <p class="eyebrow">${escapeHtml(missionLabel)}</p>
    <h2>${escapeHtml(title)}</h2>
    <div class="slide-body">${body}</div>
  </section>`;
}

function missionSlides(mission: ExportMission) {
  const { guide } = mission;
  const missionLabel = mission.labelKo ?? "학습 미션";
  const missionHeading = `${missionLabel} · ${guide.speechActKo} · MJT5+DCT1`;
  const pdr = guide.pdrKo.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  const mpjItems = guide.mpjItems.map((item) => `
    <article class="item">
      <h3>MJT${item.id} · ${escapeHtml(item.titleKo)}</h3>
      <p class="muted">${escapeHtml(item.situationKo)}</p>
      <p class="answer"><strong>설계 의도:</strong> ${escapeHtml(item.designIntentKo)}</p>
      <ul>${item.candidates.map((candidate) => `<li><span lang="zh">${escapeHtml(candidate.text)}</span>${candidate.judgmentKo ? ` <small>${escapeHtml(candidate.judgmentKo)}</small>` : ""}<p class="answer muted">${escapeHtml(candidate.noteKo)}</p></li>`).join("")}</ul>
    </article>`).join("");
  const alternatives = guide.dct.alternatives.map((alternative, index) => `
    <li><strong>${index + 1}.</strong> <span lang="zh">${escapeHtml(alternative.text)}</span><p class="muted">${escapeHtml(alternative.noteKo)}</p></li>`).join("");
  const contrastAnswer = guide.contrast.verified
    ? paragraphs([
        ["유지", `화행·핵심 명제·${guide.contrast.preservedKo.join(" · ")}`],
        ["핵심 변화", guide.contrast.changedKo],
      ])
    : `<p>두 상황을 특정 P·D·R 한 축의 효과로 단정하지 않고 복합 차이로 다룹니다.</p>`;

  return [
    slide("상황과 핵심 화행 확인", missionHeading, `
      <p class="lead">${escapeHtml(guide.situationKo)}</p>
      <p class="muted">문항 판정 초점: ${escapeHtml(guide.itemFocusKo)}</p>
      <p class="muted">관계: ${escapeHtml(guide.relationKo)}</p>
      <div class="chips">${pdr}</div>
      ${guide.burdenMeaningKo ? `<p class="note"><strong>이 화행의 R:</strong> ${escapeHtml(guide.burdenMeaningKo)}</p>` : ""}`),
    slide("대표 오개념과 첫 판단", missionHeading, `
      <div class="answer">${paragraphs([
        ["대표 오개념", guide.misconceptionKo ?? "구조화된 대표 오개념 없음"],
        ["판단의 핵심", guide.coreReasonKo],
      ])}</div>
      <p class="prompt">정답을 먼저 발표하기보다 첫 판단의 상황 단서와 표현 근거를 각각 말하게 합니다.</p>`, true),
    slide("P·D·R 최소대조", missionHeading, `
      <div class="columns"><div class="card"><strong>상황 A</strong><p>${escapeHtml(guide.contrast.firstSituationKo)}</p></div><div class="card"><strong>상황 B</strong><p>${escapeHtml(guide.contrast.secondSituationKo)}</p></div></div>
      <div class="answer note">${contrastAnswer}</div>`, true),
    slide("중국어 화용 현미경", missionHeading, `
      ${paragraphs([
        ["분석 표현", guide.microscope.expression],
        ["원문의 의도", guide.microscope.source],
      ])}
      <div class="answer">${paragraphs([
        ["기능과 관계적 효과", guide.microscope.functionAndEffectKo],
        ["조정 예시", guide.microscope.adjustmentExample],
        [guide.microscope.boundaryPromptLabelKo ?? "화행 경계 확인", guide.microscope.boundaryPromptKo],
      ])}</div>`, true),
    slide("MJT·DCT 수행자료 토론", missionHeading, `
      <div class="items">${mpjItems}</div>
      <article class="item dct"><h3>DCT 직접 산출</h3><p><strong>산출 원문:</strong> ${escapeHtml(guide.dct.sourceText)}</p><div class="answer"><h3>수정 후 참고안 비교</h3><ol>${alternatives}</ol></div></article>`, true),
    slide("다른 맥락으로 재맥락화", missionHeading, `
      <p class="lead">${escapeHtml(guide.recontextualization.situationKo)}</p>
      <p class="muted">관계: ${escapeHtml(guide.recontextualization.relationKo)}</p>
      <p class="prompt">${escapeHtml(guide.recontextualization.promptKo)}</p>
      <p class="note">2–4주 뒤 5분 회수: 화행 「${escapeHtml(guide.speechActKo)}」를 다른 관계·부담·매체에 놓고 표현을 하나만 조정하게 합니다.</p>`),
  ];
}

function pairComparison(first: ExportMission, second: ExportMission) {
  return slide("미션 1·2 판단 근거 비교", "90분 통합 활동", `
    <p class="lead">같은 화행을 서로 다른 두 상황에서 독립적으로 수행한 결과를 나란히 봅니다.</p>
    <p class="muted">두 미션을 통제된 실험쌍이나 특정 변화축의 효과로 해석하지 않습니다.</p>
    <div class="columns"><div class="card"><strong>미션 1</strong><p>${escapeHtml(first.guide.situationKo)}</p></div><div class="card"><strong>미션 2</strong><p>${escapeHtml(second.guide.situationKo)}</p></div></div>
    <ol class="questions"><li>두 미션에서 선택한 판단 근거의 공통점과 차이는 무엇인가?</li><li>두 DCT 수정안에서 유지한 원리와 상황에 맞게 달리 조정한 점은 무엇인가?</li><li>새 상황에 같은 화행을 적용한다면 표현을 어떻게 조정할 것인가?</li></ol>`);
}

/** 주차 공용 본문만 내보낸다. 기존 교수자용 export의 숨겨진 해설은 이 경로에 섞지 않는다. */
export function buildWeeklyMaterialsHtml(material: WeeklyCourseMaterial): string {
  const body = renderToStaticMarkup(createElement(WeeklyMaterialDocument, { material }));
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(material.courseTitle)} · ${material.weekNo}주차 수업자료</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f6ee;color:#15202b;font-family:system-ui,sans-serif;line-height:1.65}
main{max-width:1100px;margin:auto;padding:28px}.material-heading{background:#fad338;padding:22px 30px;border-radius:14px}
h1{margin:8px 0;font-size:30px}h2{font-size:30px;margin-top:0}.material-section{margin-top:20px;background:white;border:1px solid #e5dfd0;border-radius:14px;padding:32px;font-size:23px;min-height:42vh}
.weekly-material{overflow-wrap:anywhere}.material-section p,.material-section li{font-size:23px;line-height:1.8}.material-section li{margin:12px 0}[hidden]{display:none!important}
nav{position:sticky;top:0;z-index:1;background:#f8f6ee;display:flex;align-items:center;justify-content:flex-end;gap:12px;margin:0 0 16px;padding:8px 0}button{font:inherit;padding:8px 18px;border:1px solid #bbb;border-radius:8px;background:white}button:disabled{opacity:.4}footer{font-size:12px;color:#657178}
@media print{body{background:white}main{padding:0}nav,footer{display:none}.material-section,.material-section[hidden]{display:block!important;min-height:0;break-inside:avoid;padding:18px}.material-section p,.material-section li{font-size:12px}h2{font-size:18px}}
</style></head><body><main>
<nav aria-label="수업자료 페이지"><span id="page"></span><button id="previous">이전</button><button id="next">다음</button><button id="print">인쇄</button></nav>
${body}
<footer>주차 수업자료의 공용 사본입니다. 교수자 전용 메모와 개인 수행 기록은 포함하지 않습니다. 원본 수정 후에는 HTML을 다시 내려받으세요.</footer>
</main><script>(()=>{const sections=[...document.querySelectorAll('[data-material-section]')],page=document.getElementById('page'),previous=document.getElementById('previous'),next=document.getElementById('next');let index=0;const show=(value)=>{index=Math.max(0,Math.min(sections.length-1,value));sections.forEach((section,i)=>{section.hidden=i!==index});page.textContent=(index+1)+' / '+sections.length;previous.disabled=index===0;next.disabled=index===sections.length-1};previous.onclick=()=>show(index-1);next.onclick=()=>show(index+1);document.getElementById('print').onclick=()=>window.print();document.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();show(index+1)}if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();show(index-1)}});show(0)})();</script></body></html>`;
}

export function weeklyMaterialsHtmlFilename(material: WeeklyCourseMaterial): string {
  const course = material.courseId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `PRAGMA_${course}_${material.weekNo}주차_수업자료.html`;
}

export function instructorGuideHtmlFilename(input: InstructorGuideHtmlExport) {
  const ids = [input.primary.scenarioId, input.secondary?.scenarioId].filter(Boolean).join("_");
  const safeIds = ids.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 90) || "mission";
  return `PRAGMA_오프라인_수업본_${input.timingPlan.preset}분_${safeIds}.html`;
}

export function buildInstructorGuideStandaloneHtml(input: InstructorGuideHtmlExport) {
  const generatedAt = input.generatedAt ?? new Date();
  const missions = [
    { ...input.primary, labelKo: input.secondary ? "미션 1" : "학습 미션" },
    ...(input.secondary ? [{ ...input.secondary, labelKo: "미션 2" }] : []),
  ];
  const slides = missions.flatMap(missionSlides);
  if (input.secondary) slides.push(pairComparison(missions[0], missions[1]));
  const missionIds = missions.map((mission) => mission.scenarioId).join(" · ");
  const timingRows = input.timingPlan.activities.map((activity) => `<tr><td>${escapeHtml(activity.labelKo)}</td><td>${activity.minutes}분</td><td>${escapeHtml(activity.howKo)}</td><td>${escapeHtml(activity.outputKo)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>PRAGMA 오프라인 수업본 · ${input.timingPlan.preset}분</title>
  <style>
    :root{font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#15202b;background:#f7f4ec;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.topbar{background:#15202b;color:white;padding:18px clamp(18px,4vw,56px);display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{letter-spacing:.18em;font-weight:800}.brand i{display:inline-block;width:6px;height:22px;margin-right:10px;border-radius:3px;background:#fad338;vertical-align:-5px}.meta{font-size:12px;color:#cbd5db;text-align:right}.layout{max-width:1180px;margin:auto;padding:24px clamp(16px,3vw,36px) 96px}.timing{background:white;border:1px solid #ddd8cb;border-radius:16px;padding:20px;margin-bottom:22px}.timing-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.eyebrow{margin:0 0 6px;color:#806914;font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase}.timing h1,.slide h2{margin:0}.timing p{margin:7px 0 0;color:#657178}.badge{white-space:nowrap;background:#fad338;border-radius:999px;padding:7px 12px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #eeeae0;vertical-align:top}th{color:#53656f}.viewer{min-height:560px;background:white;border:1px solid #ddd8cb;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(21,32,43,.06)}.viewer-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 18px;border-bottom:1px solid #e7e2d7}.counter{font-size:13px;color:#657178}.actions{display:flex;gap:8px;flex-wrap:wrap}button{border:1px solid #15202b;border-radius:9px;background:white;color:#15202b;padding:9px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}button.primary{background:#15202b;color:white}button:disabled{opacity:.35;cursor:not-allowed}.slide{display:none;padding:clamp(24px,5vw,58px);min-height:490px}.slide.active{display:block}.slide h2{font-size:clamp(24px,3vw,38px);margin-bottom:26px}.slide-body{font-size:clamp(15px,1.5vw,19px);line-height:1.7}.slide-body p{margin:9px 0}.lead{font-size:1.08em;font-weight:650}.muted{color:#657178}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.chip{border:1px solid #d8d0bc;border-radius:999px;background:#faf8f2;padding:6px 11px;font-size:.82em}.note,.prompt{margin-top:18px!important;border-radius:11px;background:#f4f1e8;padding:13px 15px}.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.card,.item{border:1px solid #ddd8cb;border-radius:12px;background:#faf8f2;padding:15px}.answer{display:none}.revealed .answer{display:block}.items{display:grid;gap:12px}.item h3{margin:0 0 8px;font-size:1em}.item ul,.item ol{padding-left:22px}.item li{margin:8px 0}.item small{display:inline-block;background:white;border-radius:4px;padding:1px 5px;color:#53656f}.dct{margin-top:16px}.questions{margin-top:24px}.questions li{margin:12px 0}.footer-note{margin:18px 4px 0;color:#657178;font-size:12px;line-height:1.6}.shortcut{color:#53656f;font-size:12px}.reveal[hidden]{display:none}
    @media(max-width:700px){.topbar,.timing-head,.viewer-head{align-items:flex-start;flex-direction:column}.meta{text-align:left}.columns{grid-template-columns:1fr}.timing{overflow-x:auto}.shortcut{display:none}}
    @media print{body{background:white}.topbar,.viewer-head,.footer-note{display:none}.layout{max-width:none;padding:0}.timing,.viewer{border:0;border-radius:0;box-shadow:none}.timing{break-after:page}.slide,.slide.active{display:block;min-height:auto;padding:18mm 12mm;break-after:page}.slide .answer{display:block}.slide h2{font-size:24px}.slide-body{font-size:12px}.items{display:block}.item{break-inside:avoid;margin-bottom:10px}}
  </style>
</head>
<body>
  <header class="topbar"><div class="brand"><i></i>PRAGMA</div><div class="meta">교수자용 오프라인 수업본<br>${escapeHtml(missionIds)}</div></header>
  <main class="layout">
    <section class="timing">
      <div class="timing-head"><div><p class="eyebrow">수업 시간 프리셋</p><h1>${input.timingPlan.preset}분 · ${escapeHtml(input.timingPlan.labelKo)}</h1><p>${escapeHtml(input.timingPlan.descriptionKo)}</p></div><span class="badge">총 ${input.timingPlan.preset}분</span></div>
      <table><thead><tr><th>활동</th><th>시간</th><th>진행 방법</th><th>학습 산출물</th></tr></thead><tbody>${timingRows}</tbody></table>
    </section>
    <section class="viewer" aria-label="수업 단계">
      <div class="viewer-head"><div><strong id="current-title"></strong><div class="counter"><span id="current">1</span> / ${slides.length}</div></div><div class="actions"><span class="shortcut">← → 이동 · Enter 해설</span><button type="button" id="reveal" class="reveal">해설 공개</button><button type="button" id="print">인쇄·PDF</button><button type="button" id="prev">이전</button><button type="button" id="next" class="primary">다음</button></div></div>
      ${slides.join("\n")}
    </section>
    <p class="footer-note">${escapeHtml(generatedAt.toLocaleString("ko-KR"))} 생성 · 이 파일은 PRAGMA에서 분리된 읽기 전용 수업 사본이며 학습 수행을 저장하거나 원본과 자동 동기화하지 않습니다.</p>
  </main>
  <script>
    (()=>{const slides=[...document.querySelectorAll('.slide')],current=document.getElementById('current'),title=document.getElementById('current-title'),prev=document.getElementById('prev'),next=document.getElementById('next'),reveal=document.getElementById('reveal');let index=0;const show=(value)=>{index=Math.max(0,Math.min(slides.length-1,value));slides.forEach((item,i)=>item.classList.toggle('active',i===index));current.textContent=String(index+1);title.textContent=slides[index].dataset.title;prev.disabled=index===0;next.disabled=index===slides.length-1;reveal.hidden=slides[index].dataset.reveal!=='true';reveal.textContent=slides[index].classList.contains('revealed')?'해설 숨기기':'해설 공개';};const toggle=()=>{if(reveal.hidden)return;slides[index].classList.toggle('revealed');show(index)};prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));reveal.addEventListener('click',toggle);document.getElementById('print').addEventListener('click',()=>window.print());document.addEventListener('keydown',(event)=>{if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();show(index+1)}if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();show(index-1)}if(event.key==='Enter'){event.preventDefault();toggle()}if(event.key==='Home')show(0);if(event.key==='End')show(slides.length-1)});show(0)})();
  </script>
</body>
</html>`;
}
