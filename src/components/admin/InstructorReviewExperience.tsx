import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIENCE_SECTIONS, experienceComplete, findingAppliesToSection, viewModelFromReview } from "@/lib/pragma/instructorExperience";
import type { InstructorExperience, ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const ReviewStage = lazy(() => import("@/pages/learner/CanonicalMissionRun").then((module) => ({ default: module.CanonicalReviewStage })));
const statusLabel = { checked: "확인", revision_required: "수정 요청", defer: "보류" };
const empty = (): InstructorExperience => ({ version: "instructor_experience_v1", active_seconds: 0, decisions: [] });

export function InstructorReviewExperience({ inspection, onSave, onReady, disabled = false }: {
  inspection: ReviewInspection;
  onSave: (value: InstructorExperience) => Promise<void>;
  onReady: (ready: boolean) => void;
  disabled?: boolean;
}) {
  const saved = inspection.run?.instructor_experience ?? null;
  const [draft, setDraft] = useState<InstructorExperience>(() => saved ?? empty());
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useRef((saved?.active_seconds ?? 0) * 1000);
  const section = EXPERIENCE_SECTIONS[sectionIndex];
  const approved = Boolean(inspection.run?.approved_at);
  const dirty = JSON.stringify(draft.decisions) !== JSON.stringify(saved?.decisions ?? []);
  const model = useMemo(() => {
    try { return { value: viewModelFromReview(inspection), error: null }; }
    catch (cause) { return { value: null, error: cause instanceof Error ? cause.message : "학습 화면을 구성하지 못했습니다." }; }
  }, [inspection.snapshot]);
  useEffect(() => { onReady(Boolean(model.value && experienceComplete(saved) && !dirty && !saving)); }, [model.value, saved, dirty, saving, onReady]);
  useEffect(() => {
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && document.hasFocus()) elapsed.current += Math.min(now - last, 2000);
      last = now;
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const current = draft.decisions.find((entry) => entry.section === section.id);
  const findings = [
    ...(inspection.run?.rules.findings ?? []).map((finding) => ({ ...finding, provider: "규칙" })),
    ...(inspection.run?.openai_review?.result.findings ?? []).map((finding) => ({ ...finding, provider: "OpenAI" })),
    ...(inspection.run?.claude_review?.result.findings ?? []).map((finding) => ({ ...finding, provider: "Claude" })),
  ].filter((finding) => findingAppliesToSection(finding, section.id));
  const next = () => { setSectionIndex((index) => Math.min(index + 1, EXPERIENCE_SECTIONS.length - 1)); };
  const persist = async (value: InstructorExperience) => {
    setDraft(value); setSaving(true); setError(null);
    try { await onSave({ ...value, active_seconds: Math.floor(elapsed.current / 1000) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "감수 기록 저장 실패"); }
    finally { setSaving(false); }
  };
  const mark = (status: InstructorExperience["decisions"][number]["status"]) => {
    void persist({ ...draft, decisions: [...draft.decisions.filter((entry) => entry.section !== section.id), { section: section.id, status, note: current?.note ?? "" }] });
  };
  return <section aria-label="학습자 화면 체험 감수" className="rounded-2xl border border-[#D8D3C4] bg-[#F8F7F2] p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold">학생 화면으로 감수하기</h3>
        <p className="mt-1 text-xs text-muted-foreground">직접 풀거나 참고 판정·해설을 바로 볼 수 있습니다. 체크는 교수자의 확인 기록이며 최종 승인은 아래에서 별도로 합니다.</p></div>
      <Button size="sm" variant={answers ? "default" : "outline"} aria-pressed={answers} onClick={() => setAnswers(!answers)}>{answers ? "직접 풀기로 전환" : "참고 판정·해설 바로 보기"}</Button>
    </div>
    {model.error && <p role="alert" className="mb-4 text-red-800">{model.error}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,27%)]">
      <div className="min-w-0">
        {model.value && <Suspense fallback={<p role="status">학습 화면 준비 중…</p>}><ReviewStage mission={model.value} section={section.id} revealAnswers={answers} onNext={next} /></Suspense>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24">
        <nav aria-label="감수할 장면과 문항" className="grid grid-cols-2 gap-1 xl:grid-cols-1">{EXPERIENCE_SECTIONS.map((item, index) => {
          const decision = draft.decisions.find((entry) => entry.section === item.id);
          return <button key={item.id} type="button" aria-current={sectionIndex === index ? "step" : undefined} onClick={() => setSectionIndex(index)}
            className={`rounded-lg border px-3 py-2 text-left text-xs ${sectionIndex === index ? "border-[#CAB23D] bg-[#FFF5C2] font-bold" : "border-transparent bg-white"}`}>
            {item.label}<span className={`ml-2 ${decision?.status === "checked" ? "text-emerald-700" : "text-amber-800"}`}>{decision ? statusLabel[decision.status] : "미확인"}</span>
          </button>;
        })}</nav>
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <p className="text-sm font-semibold">{section.label}</p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" disabled={disabled || saving || approved || !model.value} onClick={() => mark("checked")}>✓ 확인</Button>
            <Button size="sm" variant="outline" disabled={disabled || saving || approved} onClick={() => mark("revision_required")}>✗ 수정 요청</Button>
            <Button size="sm" variant="ghost" disabled={disabled || saving || approved} onClick={() => mark("defer")}>보류</Button>
          </div>
          <Textarea aria-label="현재 문항 감수 메모" maxLength={2000} value={current?.note ?? ""} disabled={disabled || saving || approved}
            placeholder="문제 지점이나 수정 방향을 짧게 남기세요."
            onChange={(event) => setDraft({ ...draft, decisions: [...draft.decisions.filter((entry) => entry.section !== section.id), {
              section: section.id, status: current?.status ?? "defer", note: event.target.value,
            }] })} />
          {dirty && <Button size="sm" variant="outline" disabled={disabled || saving || approved} onClick={() => void persist(draft)}>감수 메모 저장</Button>}
          <p className="text-xs text-muted-foreground" role="status">{saving ? "감수 기록 저장 중…" : dirty ? "저장하지 않은 감수 기록이 있습니다." : saved ? "현재 버전에 감수 기록이 저장되었습니다." : "확인·수정 요청·보류를 누르면 현재 버전에 저장합니다."}</p>
          {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
          {(current?.status === "revision_required" || current?.status === "defer") && <p className="text-xs text-amber-800">현재 미션의 최종 승인을 보류합니다. 아래 원본 수정 도구에서 수정하거나, 판단을 재검토하고 확인으로 바꾸세요.</p>}
        </div>
        <details className="rounded-xl border bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">이 부분의 AI·규칙 문제 항목 {findings.length}건</summary>
          {!findings.length && <p className="mt-2 text-xs">현재 저장된 문제 항목이 없습니다. AI 검토 완료 여부는 단계별 결과에서 확인하세요.</p>}
          {findings.map((finding) => {
            const adjudication = finding.provider === "Claude" ? inspection.run?.adjudication?.result.decisions.find((entry) => entry.finding_id === finding.id) : null;
            return <div key={`${finding.provider}-${finding.id}`} className="mt-3 space-y-1 border-t pt-2 text-xs">
              <p className="font-bold">{finding.provider === "Claude" ? "AI 독립 검토" : finding.provider === "OpenAI" ? "AI 검토" : "규칙 검사"} · {finding.issue_ko}</p><p>{finding.reason_ko}</p>
              {finding.quote && <blockquote className="border-l-2 pl-2">{finding.quote}</blockquote>}<p>제안: {finding.suggestion_ko}</p>
              {adjudication && <p>재검토: {adjudication.rationale_ko}</p>}
            </div>;
          })}
        </details>
        <p className="text-xs leading-5 text-muted-foreground">통역의 재생·전사는 버튼을 누를 때 기존 음성 서비스를 사용합니다. 감수 중 응답은 학습 기록으로 저장하지 않습니다. 감수 시간은 화면이 활성화된 시간의 근사값입니다.</p>
      </aside>
    </div>
  </section>;
}
