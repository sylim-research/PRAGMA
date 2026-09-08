import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { LearnerCourse, LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { teachingRequest, type TeachingPreview, type TeachingState } from "@/lib/curriculum/teachingGenerationApi";
import { teachingKind, type TeachingContent } from "../../../supabase/functions/_shared/teachingMaterial";

export function TeachingGeneratorPanel({ course, week, state, loading, loadError, onSaved, onReload, onReview }: {
  course: LearnerCourse; week: LearnerCourseWeek; state?: TeachingState; loading: boolean; loadError: boolean;
  onSaved: (state: TeachingState) => void; onReload: () => void; onReview: () => void;
}) {
  const kind = teachingKind(week.week_no, week.type);
  const choices = useMemo(() => (kind === "discussion" ? course.weeks.filter((item) => item.week_no >= 2 && item.week_no < week.week_no) : [week])
    .flatMap((item) => item.scenarios.map((scenario, index) => ({ id: scenario.scenario_id,
      label: `${item.week_no}주차 · ${scenario.mode === "stt_interpreting" ? "통역" : "번역"} · 미션 ${index + 1}`,
      situation: scenario.situation_ko }))), [kind, course.weeks, week]);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [extraText, setExtraText] = useState("");
  const [extraRef, setExtraRef] = useState("");
  const [preview, setPreview] = useState<TeachingPreview | null>(null);
  const [editing, setEditing] = useState<TeachingContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ids = selected ?? (kind === "lesson" ? choices.map((item) => item.id) : choices.slice(0, 2).map((item) => item.id));
  const ready = Boolean(state) && !loading && !loadError && ids.length > 0 && ids.length <= 6
    && (kind === "discussion" || (week.scenarios.length === 2 && Boolean(week.speech_act)))
    && Boolean(extraText.trim()) === Boolean(extraRef.trim());
  useEffect(() => {
    setPreview(null); setEditing(null);
    if (state?.draft) {
      const config = state.draft.source_config;
      setSelected(config.missionIds.filter((id) => choices.some((choice) => choice.id === id)));
      setExtraText(config.extraText); setExtraRef(config.extraRef);
    }
  }, [state?.draft, state?.current, choices]);
  if (!kind) return null;
  if (state?.draft?.source_config.workflow === "source") return <section className="rounded-xl border bg-[#FFFCF2] p-4 text-sm leading-6">
    <h2 className="font-bold">소스 기반 수업자료 · 버전 {state.draft.revision}</h2>
    <p>원자료·생성 조건·초안 편집은 수업자료·토론 생성 화면에서 확인합니다.</p>
    <Link className="font-semibold underline" to={`/admin/teaching-generator?courseId=${encodeURIComponent(course.outline.id)}&weekNo=${week.week_no}`}>생성 화면 열기 →</Link>
  </section>;
  const invalidate = () => { setPreview(null); setError(""); };
  const request = async (action: "preview" | "generate" | "edit") => {
    setBusy(true); setError("");
    try {
      const result = await teachingRequest({ action, courseId: course.outline.id, weekNo: week.week_no,
        expectedRevision: state?.draft?.revision ?? 0,
        config: { missionIds: ids, extraText, extraRef }, inputHash: preview?.inputHash,
        ...(action === "edit" && editing ? { content: editing } : {}),
      });
      if (action === "preview") setPreview(result as TeachingPreview);
      else { onSaved(result as TeachingState); setPreview(null); setEditing(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "자료를 준비하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const changeSection = (index: number, field: "title" | "paragraphs" | "items", value: string) => {
    if (!editing) return;
    setEditing({ ...editing, sections: editing.sections.map((section, i) => i === index
      ? { ...section, [field]: field === "title" ? value : value.split("\n").filter((line) => line.trim()) } : section) });
  };
  const fieldClass = "mt-1 w-full min-w-0 rounded-md border bg-white p-2 text-sm font-normal leading-6 [overflow-wrap:anywhere]";
  return <section aria-label="수업자료 생성" className="min-w-0 space-y-4 rounded-xl border border-[#DBD3BD] bg-[#FFFCF2] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link className="mb-2 inline-block text-sm font-semibold underline" to={`/admin/teaching-generator?courseId=${encodeURIComponent(course.outline.id)}&weekNo=${week.week_no}`}>PDF·영상·이미지 등 소스로 자료 만들기 →</Link>
        <h2 className="text-lg font-bold">{kind === "discussion" ? `${week.week_no}주차 메타화용 토론 준비` : "이 주차 수업자료 보강"}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{kind === "discussion"
          ? `2~${week.week_no - 1}주차에서 다룬 미션을 골라 비교 사례·토론 질문·성찰 활동을 준비합니다.`
          : "편성 미션과 학습목표를 바탕으로 핵심 설명·표현 비교·적용 활동·예상 질문을 준비합니다."}</p>
      </div>
      {state?.draft && <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">생성 자료 · 버전 {state.draft.revision}</span>}
    </div>
    {loading && <p role="status" className="text-sm">저장된 생성 자료를 확인하는 중…</p>}
    {loadError && <div role="alert" className="text-sm">저장된 생성 자료를 확인하지 못했습니다. 서비스 연결을 확인해 주세요.
      <Button variant="outline" size="sm" className="ml-2" onClick={onReload}>다시 확인</Button></div>}
    {state?.draft && !state.current && <p role="alert" className="text-sm text-amber-900">편성이나 근거가 바뀌었습니다. 이전 생성 자료를 다시 준비한 뒤 승인해 주세요.</p>}
    {kind === "lesson" && (week.scenarios.length !== 2 || !week.speech_act) && <p className="text-sm">이 주차의 화행을 선택하고 승인된 미션 2개를 편성하면 자료를 생성할 수 있습니다.</p>}
    {kind === "discussion" && !choices.length && <p className="text-sm">먼저 이전 주차에 승인된 미션을 편성해 주세요.</p>}
    <details>
      <summary className="cursor-pointer text-sm font-semibold">근거 자료 선택 · {ids.length}개 미션</summary>
      <fieldset disabled={busy} className="mt-3 min-w-0 space-y-3">
        <legend className="sr-only">생성에 사용할 근거</legend>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {choices.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={ids.includes(item.id)} disabled={kind === "lesson" || (!ids.includes(item.id) && ids.length >= 6)}
              onChange={(event) => { setSelected(event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)); invalidate(); }} />
            <span className="min-w-0"><strong>{item.label}</strong><span className="mt-1 block leading-6 [overflow-wrap:anywhere]">{item.situation}</span></span>
          </label>)}
        </div>
        {!choices.length && <p className="text-sm">이 범위에 사용할 승인된 편성 미션이 없습니다. 미션 편성과 승인 상태를 확인해 주세요.</p>}
        {kind === "discussion" && <p className="text-xs text-muted-foreground">미션은 최대 6개를 선택합니다. 학생의 개인 응답은 생성기에 전달하지 않습니다. 학생은 토론 중 자신의 기존 기록을 참고할 수 있습니다.</p>}
        <label className="block text-sm font-semibold">추가 원자료 출처 · 선택
          <input value={extraRef} maxLength={500} onChange={(event) => { setExtraRef(event.target.value); invalidate(); }} className={fieldClass} placeholder="자료 제목, 페이지 또는 원문 주소" />
        </label>
        <label className="block text-sm font-semibold">추가 원자료 본문 · 선택
          <textarea value={extraText} maxLength={12000} rows={4} onChange={(event) => { setExtraText(event.target.value); invalidate(); }} className={fieldClass} placeholder="확인한 원자료의 관련 부분을 붙여넣으세요." />
        </label>
        <p className="text-xs text-muted-foreground">{extraText.length.toLocaleString()} / 12,000자 · 출처와 본문을 함께 입력합니다.</p>
      </fieldset>
    </details>
    {preview && <div className="space-y-3 rounded-lg border bg-white p-4">
      <p className="text-sm font-semibold">생성할 내용 확인 · {preview.characters.toLocaleString()}자 입력</p>
      <ul className="space-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{preview.sources.map((source) => <li key={source.id}>{source.id} · {source.label} · {source.characters.toLocaleString()}자</li>)}</ul>
      <p className="text-xs">선택한 범위를 모두 전달합니다. 생성 결과는 초안으로 저장되며 기존 승인은 새 버전에 적용되지 않습니다.</p>
      <details><summary className="cursor-pointer text-xs">프롬프트와 입력 원문 확인</summary>
        <p className="mt-2 text-xs">{preview.model} · {preview.promptVersion}</p>
        <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-xs">{preview.system}{"\n\n"}{preview.user}</pre>
      </details>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!ready || busy || Boolean(editing)} variant={preview ? "outline" : "default"} onClick={() => request("preview")}>생성 내용 확인</Button>
      {preview && <Button disabled={!ready || busy} onClick={() => request("generate")}>초안 생성</Button>}
      {state?.draft && state.current && !editing && <>
        <Button variant="outline" disabled={busy} onClick={() => { setEditing(structuredClone(state.draft!.content)); invalidate(); }}>생성 자료 수정</Button>
        <Button variant="outline" disabled={busy} onClick={onReview}>이 자료 검토·승인</Button>
      </>}
    </div>
    {busy && <p role="status" className="text-sm">자료를 처리하고 있습니다. 완료될 때까지 기다려 주세요.</p>}
    {error && <div role="alert" className="text-sm text-destructive">{error}<Button variant="outline" size="sm" className="ml-2" onClick={onReload}>저장 상태 확인</Button></div>}
    {editing && <fieldset disabled={busy} className="space-y-4 border-t pt-4">
      <legend className="font-semibold">생성 자료 수정</legend>
      <p className="text-xs text-muted-foreground">문단·항목은 한 줄에 하나씩 입력합니다. 수정본은 새 버전으로 저장한 뒤 다시 승인합니다.</p>
      {editing.sections.map((section, index) => <div key={section.key} className="space-y-2 rounded-lg border bg-white p-3">
        <label className="block text-sm font-semibold">{index + 1}. 제목<input className={fieldClass} value={section.title} maxLength={100} onChange={(event) => changeSection(index, "title", event.target.value)} /></label>
        <label className="block text-sm">설명<textarea className={fieldClass} rows={4} value={section.paragraphs.join("\n")} onChange={(event) => changeSection(index, "paragraphs", event.target.value)} /></label>
        <label className="block text-sm">항목·질문<textarea className={fieldClass} rows={4} value={section.items.join("\n")} onChange={(event) => changeSection(index, "items", event.target.value)} /></label>
      </div>)}
      <h3 className="font-semibold">교수자 진행 메모 · 학생 자료에 포함되지 않음</h3>
      {editing.instructor_notes.map((note, index) => <label key={index} className="block text-sm font-semibold">{note.title}
        <textarea className={fieldClass} rows={4} value={note.body} maxLength={2200} onChange={(event) => setEditing({ ...editing,
          instructor_notes: editing.instructor_notes.map((item, i) => i === index ? { ...item, body: event.target.value } : item) })} />
      </label>)}
      <div className="flex flex-wrap gap-2"><Button onClick={() => request("edit")}>수정본 저장</Button><Button variant="outline" onClick={() => setEditing(null)}>수정 취소</Button></div>
    </fieldset>}
  </section>;
}
