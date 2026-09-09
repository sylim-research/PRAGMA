import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessagesSquare, ArrowRight, Sparkles } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { TeachingSourceCollection } from "@/components/admin/TeachingSourceCollection";
import { listCurriculumOutlines, getCurriculumOutline } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { getTeachingState, teachingRequest, type TeachingState, type TeachingPreview } from "@/lib/curriculum/teachingGenerationApi";
import { SPEECH_ACT_UI, LEVEL, type SpeechActUI, type LearnerLevel } from "@/lib/pragma/enums";
import { teachingKind, validateTeachingSources, type TeachingConfig, type TeachingKind, type TeachingInputSource, type TeachingContent } from "../../../supabase/functions/_shared/teachingMaterial";

const field = "mt-1 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm leading-6";
export default function AdminTeachingStudio() {
  const [params, setParams] = useSearchParams(); const queryClient = useQueryClient();
  const courseId = params.get("courseId") ?? ""; const weekNo = Number(params.get("weekNo") ?? 2);
  const [sources, setSources] = useState<TeachingInputSource[]>([]); const [selected, setSelected] = useState<string[]>([]);
  const [missionIds, setMissionIds] = useState<string[]>([]); const [outputKind, setOutputKind] = useState<TeachingKind>(weekNo === 7 || weekNo === 14 ? "discussion" : "lesson");
  const [focus, setFocus] = useState(""); const [activityMode, setActivityMode] = useState<TeachingConfig["activityMode"]>("pair");
  const [preview, setPreview] = useState<TeachingPreview | null>(null); const [editing, setEditing] = useState<TeachingContent | null>(null);
  const [busy, setBusy] = useState(false); const [extracting, setExtracting] = useState(false); const [error, setError] = useState("");
  const restored = useRef(false); const resultRef = useRef<HTMLDivElement>(null);
  const outlines = useQuery({ queryKey: ["teaching-outlines"], queryFn: listCurriculumOutlines });
  const courseQuery = useQuery({ queryKey: ["teaching-course", courseId], enabled: Boolean(courseId), queryFn: async () => {
    const [curriculum, assignments, cores] = await Promise.all([getCurriculumOutline(courseId), listWeekAssignments(courseId), listCoreScenarios()]);
    return assembleLearnerCourse({ ...curriculum, assignments, cores });
  } });
  const course = courseQuery.data; const week = course?.weeks.find(w => w.week_no === weekNo);
  const generationKey = ["teaching-generated-material", courseId, weekNo];
  const stateQuery = useQuery({ queryKey: generationKey, enabled: Boolean(week && teachingKind(weekNo, week.type)),
    queryFn: () => getTeachingState(courseId, weekNo), retry: false });
  const state = stateQuery.data; const draft = state?.draft;
  const scopeWeeks = course?.weeks.filter(w => (weekNo === 7 || weekNo === 14) ? w.week_no >= 2 && w.week_no < weekNo : w.week_no === weekNo) ?? [];
  const choices = scopeWeeks.flatMap(w => w.scenarios.map(s => ({ id: s.scenario_id, label: `${w.week_no}주 · ${s.mode === "stt_interpreting" ? "통역" : "번역"}`, situation: s.situation_ko })));
  const acts = [...new Set(scopeWeeks.map(w => w.speech_act).filter(Boolean))].map(a => SPEECH_ACT_UI[a as SpeechActUI]);
  const invalid = () => { setPreview(null); setError(""); };
  const restore = (config: TeachingConfig) => {
    setSources(config.sources ?? []); setSelected((config.sources ?? []).map(s => s.id)); setMissionIds(config.missionIds.filter(id => choices.some(c => c.id === id)));
    setOutputKind(config.outputKind ?? (weekNo === 7 || weekNo === 14 ? "discussion" : "lesson")); setFocus(config.focus ?? ""); setActivityMode(config.activityMode ?? "pair"); invalid();
  };
  useEffect(() => { if (!courseId && outlines.data?.[0]) { const next = new URLSearchParams(params); next.set("courseId", outlines.data[0].id); setParams(next, { replace: true }); } }, [courseId, outlines.data, params, setParams]);
  useEffect(() => {
    if (!restored.current && draft?.source_config.workflow === "source") { restored.current = true; restore(draft.source_config); }
  }, [draft]); // Restore once; later course/week changes must not overwrite sources being composed.
  const config: TeachingConfig = { workflow: "source", missionIds, extraText: "", extraRef: "", sources: sources.filter(s => selected.includes(s.id)), outputKind, focus, activityMode };
  let validation = ""; try { validateTeachingSources(config); } catch (cause) { validation = (cause as Error).message; }
  const eligible = Boolean(week && teachingKind(weekNo, week.type) && acts.length);
  const locked = busy || extracting;
  const ready = !validation && eligible && Boolean(state) && !stateQuery.isError && !stateQuery.isFetching && !locked;
  const changeTarget = (key: string, value: string) => {
    const next = new URLSearchParams(params); next.set(key, value); setParams(next);
    setMissionIds([]); setEditing(null); invalid();
    if (key === "weekNo") setOutputKind([7,14].includes(Number(value)) ? "discussion" : "lesson");
  };
  const request = async (action: "preview" | "generate" | "edit") => {
    setBusy(true); setError("");
    try {
      const result = await teachingRequest({ action, courseId, weekNo, expectedRevision: draft?.revision ?? 0, config,
        inputHash: preview?.inputHash, ...(action === "edit" && editing ? { content: editing } : {}) });
      if (action === "preview") setPreview(result as TeachingPreview);
      else { queryClient.setQueryData(generationKey, result as TeachingState); setEditing(null); setPreview(null);
        resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const packagePath = `/admin/package?courseId=${encodeURIComponent(courseId)}&weekNo=${weekNo}#weekly-material-detail`;
  return <AdminShell title="수업자료·토론 생성" description="선택한 소스에서 근거를 확인하고, 이번 주차의 화행에 맞는 수업 콘텐츠를 만듭니다.">
    <Button className="mb-4" variant="ghost" asChild><Link to={courseId ? `/admin/package?courseId=${encodeURIComponent(courseId)}&weekNo=${weekNo}` : "/admin/package"}>주차 운영으로 돌아가기 →</Link></Button>
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-[#F4F0DF] px-4 py-3 text-sm font-medium">
      <span>소스 확인</span><ArrowRight size={14} /><span>화행·생성 조건</span><ArrowRight size={14} /><span>초안 생성·편집</span><ArrowRight size={14} /><span>주차 검토·수업 활용</span>
    </div>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.35fr)]">
      <TeachingSourceCollection sources={sources} selected={selected} disabled={busy || Boolean(editing)} onBusy={setExtracting}
        onChange={value => { restored.current = true; setSources(value); invalid(); }} onSelected={value => { setSelected(value); invalid(); }} />
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-white p-4 sm:p-5" aria-label="생성 조건">
          <h2 className="text-lg font-bold">2. 이번 수업의 조건</h2>
          <fieldset disabled={locked || Boolean(editing)} className="mt-4 min-w-0 space-y-4"><legend className="sr-only">교과목과 산출물 선택</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-semibold">교과목<select className={field} value={courseId} onChange={e => changeTarget("courseId", e.target.value)}><option value="">교과목 선택</option>{outlines.data?.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
              <label className="min-w-0 text-sm font-semibold">사용할 주차<select className={field} value={weekNo} onChange={e => changeTarget("weekNo", e.target.value)}>{course?.weeks.filter(w => teachingKind(w.week_no,w.type)).map(w => <option key={w.week_no} value={w.week_no}>{w.week_no}주 · {w.title}</option>)}</select></label>
            </div>
            {(outlines.isError || courseQuery.isError) && <p role="alert" className="text-sm text-destructive">교과목 계획을 불러오지 못했습니다.<button type="button" className="ml-2 underline" onClick={() => { void outlines.refetch(); void courseQuery.refetch(); }}>다시 불러오기</button></p>}
            <div className="rounded-xl border-l-4 border-[#E0C64F] bg-[#FFFCF0] px-4 py-3 text-sm leading-6">
              <p className="font-bold">학습 화행 · {acts.join(" · ") || "주차 편성에서 화행 선택 필요"}</p>
              {course && <p className="text-xs text-muted-foreground">{LEVEL[course.outline.level as LearnerLevel]} · {course.outline.language_direction === "ko_zh" ? "한국어 → 중국어" : "중국어 → 한국어"}</p>}
              {week?.can_do.map(goal => <p key={goal} className="mt-1">{goal}</p>)}
              <Link className="mt-1 inline-block text-xs underline" to={`/admin/composer?outline=${encodeURIComponent(courseId)}`}>주차 계획 확인</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">{([{ kind: "lesson", title: "수업자료", detail: "설명 · 비교 · 활동 · FAQ", Icon: BookOpen },
              { kind: "discussion", title: "토론자료", detail: "사례 · 질문 · 근거 · 성찰", Icon: MessagesSquare }] as const).map(({kind,title,detail,Icon}) =>
              <button key={kind} type="button" aria-pressed={outputKind === kind} onClick={() => { setOutputKind(kind); invalid(); }}
                className={`min-w-0 rounded-xl border p-3 text-left ${outputKind === kind ? "border-[#D3BC50] bg-[#FFF3BD]" : "bg-[#FAFBFC]"}`}><Icon size={20} className="mb-2" /><strong className="block text-base">{title}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></button>)}</div>
            <label className="block text-sm font-semibold">강조할 내용 · 선택<textarea rows={3} className={field} maxLength={2000} value={focus} onChange={e => { setFocus(e.target.value); invalid(); }} placeholder="예: 요청을 거절할 선택권과 이유 설명을 비교하고, 학생들이 판단 근거를 말하도록 구성" /></label>
            <label className="block text-sm font-semibold">활동 방식<select className={field} value={activityMode} onChange={e => { setActivityMode(e.target.value as TeachingConfig["activityMode"]); invalid(); }}>
              <option value="individual">개인 활동</option><option value="pair">짝 활동</option><option value="group">모둠 활동</option><option value="whole_class">전체 토론</option></select></label>
            <details><summary className="cursor-pointer text-sm font-medium">기존 편성 미션도 근거로 활용 · 선택</summary><div className="mt-2 space-y-2">
              {!choices.length && <p className="text-xs leading-5 text-muted-foreground">편성 미션이 없어도 확인한 소스로 초안을 만들 수 있습니다.</p>}
              {choices.map(c => <label key={c.id} className="flex items-start gap-2 rounded-lg bg-[#F6F7F8] p-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={missionIds.includes(c.id)} disabled={!missionIds.includes(c.id) && missionIds.length >= 6}
                onChange={e => { setMissionIds(e.target.checked ? [...missionIds,c.id] : missionIds.filter(id => id!==c.id)); invalid(); }} /><span><strong>{c.label}</strong> · {c.situation}</span></label>)}</div></details>
          </fieldset>
          {stateQuery.isError && <div role="alert" className="mt-3 text-sm text-destructive">저장 상태를 불러오지 못했습니다. <button className="underline" onClick={() => stateQuery.refetch()}>다시 확인</button></div>}
          {draft && <p className="mt-3 text-xs leading-5 text-muted-foreground">이 주차 저장본: {draft.kind === "lesson" ? "수업자료" : "토론자료"} · 버전 {draft.revision}. 새로 생성하면 다음 버전으로 저장되며 다시 검토합니다.</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!ready || Boolean(editing)} onClick={() => request("preview")}>생성 내용 확인</Button>
            {preview && <Button disabled={!ready || Boolean(editing)} onClick={() => request("generate")}><Sparkles size={16} className="mr-2" />초안 생성</Button>}</div>
          {!ready && validation && <p className="mt-2 text-xs text-muted-foreground">{validation}</p>}
          {busy && <p role="status" className="mt-3 text-sm">{preview ? "근거를 바탕으로 초안을 작성하고 있습니다…" : "자료를 확인하고 있습니다…"}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error} <button className="underline" onClick={() => stateQuery.refetch()}>저장 상태 확인</button></p>}
        </section>
        {preview && <section className="rounded-2xl border bg-[#F5F8F7] p-5" aria-label="생성 요청 확인"><h2 className="font-bold">생성에 사용할 근거</h2>
          <ul className="mt-3 space-y-2 text-sm [overflow-wrap:anywhere]">{preview.sources.map(s => <li key={s.id}><strong>{s.label}</strong><span className="block text-xs text-muted-foreground">{s.characters.toLocaleString()}자</span></li>)}</ul>
          <p className="mt-3 text-xs leading-5">입력 합계 {preview.characters.toLocaleString()}자. 위 소스와 주차 계획으로 작성합니다. 결과는 교수자가 확인할 초안입니다.</p>
          <details className="mt-3"><summary className="cursor-pointer text-xs">실제 프롬프트·입력 원문 확인</summary><p className="mt-2 text-xs">{preview.model} · {preview.promptVersion}</p><pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-xs">{preview.system}{"\n\n"}{preview.user}</pre></details>
        </section>}
        <section ref={resultRef} className="min-w-0 scroll-mt-24 rounded-2xl border bg-white p-4 sm:p-5" aria-label="생성 결과">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">3. 생성 결과</h2>{draft && <span className="text-xs text-muted-foreground">버전 {draft.revision} · 검토용 초안</span>}</div>
          {!draft ? <div className="py-10 text-center text-sm leading-7 text-muted-foreground"><BookOpen size={32} className="mx-auto mb-3 text-[#A3AAAD]" />소스와 수업 조건을 준비하면<br />여기에 수업자료·토론자료가 생성됩니다.</div> : <>
            {!state?.current && <p role="alert" className="mt-3 text-sm text-amber-900">주차 계획이나 근거가 바뀌었습니다. 이전 초안을 참고해 다시 생성해 주세요.</p>}
            <div className="my-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={locked || !state?.current || Boolean(editing)} onClick={() => { setEditing(structuredClone(draft.content)); invalid(); }}>초안 편집</Button>
              {draft.source_config.workflow === "source" && <Button size="sm" variant="outline" disabled={locked || Boolean(editing)} onClick={() => restore(draft.source_config)}>저장본 소스·조건 불러오기</Button>}
              <Button asChild size="sm" variant="outline"><Link to={packagePath}>주차에서 검토·활용 <ArrowRight size={14} className="ml-1" /></Link></Button></div>
            {(editing ?? draft.content).sections.map((section,index) => <article key={section.key} className="border-t py-4 text-sm leading-7 [overflow-wrap:anywhere]">
              {editing ? <fieldset disabled={busy} className="space-y-2"><label className="block text-xs">제목<input className={field} value={section.title} maxLength={100} onChange={e => setEditing({...editing, sections:editing.sections.map((s,i)=>i===index?{...s,title:e.target.value}:s)})}/></label>
                {(["paragraphs","items"] as const).map(key => <label key={key} className="block text-xs">{key === "paragraphs" ? "설명 · 한 줄에 한 문단" : "활동·질문 · 한 줄에 한 항목"}<textarea className={field} rows={5} value={section[key].join("\n")} onChange={e => setEditing({...editing,sections:editing.sections.map((s,i)=>i===index?{...s,[key]:e.target.value.split("\n").filter(t=>t.trim())}:s)})}/></label>)}</fieldset>
                : <><h3 className="mb-2 text-base font-bold">{section.title}</h3>{section.paragraphs.map((p,i)=><p key={i} className="mb-2 whitespace-pre-wrap">{p}</p>)}<ul className="list-disc space-y-1 pl-5">{section.items.map((p,i)=><li key={i}>{p}</li>)}</ul></>}
              <details className="mt-3 rounded-lg bg-[#F6F8F7] p-3"><summary className="cursor-pointer text-xs font-semibold">근거 확인 · {section.source_ids.length}개 소스</summary>
                {section.evidence?.map((e,i)=><blockquote key={i} className="mt-2 border-l-2 border-[#9DB7AA] pl-3 text-xs leading-6">“{e.quote}”<span className="block text-muted-foreground">{draft.sources.find(s=>s.id===e.source_id)?.label}</span></blockquote>)}
                {!section.evidence && section.source_ids.map(id=><p key={id} className="mt-2 text-xs">{draft.sources.find(s=>s.id===id)?.label}</p>)}
              </details>
            </article>)}
            <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-bold">교수자 진행 메모 · 학생 자료에 포함되지 않음</summary>{(editing ?? draft.content).instructor_notes.map((n,index)=><div key={index} className="mt-3 text-sm leading-6"><h3 className="font-semibold">{n.title}</h3>{editing ? <textarea disabled={busy} className={field} rows={4} maxLength={2200} value={n.body} onChange={e=>setEditing({...editing,instructor_notes:editing.instructor_notes.map((note,i)=>i===index?{...note,body:e.target.value}:note)})}/> : <p className="whitespace-pre-wrap">{n.body}</p>}</div>)}</details>
            {editing && <div className="mt-4 flex gap-2"><Button disabled={busy} onClick={()=>request("edit")}>수정본 저장</Button><Button variant="outline" disabled={busy} onClick={()=>setEditing(null)}>취소</Button></div>}
          </>}
        </section>
      </div>
    </div>
  </AdminShell>;
}
