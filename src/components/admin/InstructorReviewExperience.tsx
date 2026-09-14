import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIENCE_SECTIONS, experienceComplete, viewModelFromReview } from "@/lib/pragma/instructorExperience";
import type { InstructorExperience, ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const ReviewStage = lazy(() => import("@/pages/learner/CanonicalMissionRun").then((module) => ({ default: module.CanonicalReviewStage })));
const statusLabel = { checked: "확인", revision_required: "수정 요청", defer: "보류" };
const empty = (): InstructorExperience => ({ version: "instructor_experience_v1", active_seconds: 0, decisions: [] });
// mission_v6 roles for the same section ids; v5 keeps the fixed labels in EXPERIENCE_SECTIONS.
const V6_SECTION_LABELS: Record<(typeof EXPERIENCE_SECTIONS)[number]["id"], string> = {
  scene: "미션 안내",
  "mjt-0": "1. 적절성 판단",
  "mjt-1": "2. 새 장면 판단 · 이유",
  "mjt-2": "3. 선택교정",
  "mjt-3": "4. 자유교정 · 대조",
  "mjt-4": "5. 후보별 적절성 판단",
  recap: "핵심 정리",
  dct: "직접 통번역 · DCT",
};

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
  const labelOf = (item: (typeof EXPERIENCE_SECTIONS)[number]) => model.value?.missionFormat === "mission_v6" ? V6_SECTION_LABELS[item.id] : item.label;
  const tally = EXPERIENCE_SECTIONS.reduce((counts, item) => {
    const status = draft.decisions.find((entry) => entry.section === item.id)?.status;
    if (status === "checked") counts.checked += 1;
    else if (status === "revision_required") counts.revision += 1;
    else if (status === "defer") counts.defer += 1;
    else counts.open += 1;
    return counts;
  }, { checked: 0, revision: 0, defer: 0, open: 0 });
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20.5rem,22.5rem)]">
      <div className="min-w-0">
        {model.value && <Suspense fallback={<p role="status">학습 화면 준비 중…</p>}><ReviewStage mission={model.value} section={section.id} revealAnswers={answers} onNext={next} /></Suspense>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24">
        <p className="text-sm text-muted-foreground" aria-label="감수 진행">
          확인 {tally.checked} · 수정 요청 {tally.revision}{tally.defer ? ` · 보류 ${tally.defer}` : ""} · 미확인 {tally.open}
        </p>
        <nav aria-label="감수할 장면과 문항" className="grid grid-cols-2 gap-1 xl:grid-cols-1">{EXPERIENCE_SECTIONS.map((item, index) => {
          const decision = draft.decisions.find((entry) => entry.section === item.id);
          return <button key={item.id} type="button" aria-current={sectionIndex === index ? "step" : undefined} onClick={() => setSectionIndex(index)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[15px] ${sectionIndex === index ? "border-[#CAB23D] bg-[#FFF5C2] font-bold" : "border-transparent bg-white"}`}>
            <span>{labelOf(item)}</span>
            <span className={`shrink-0 text-sm font-semibold ${decision?.status === "checked" ? "text-emerald-700" : decision ? "text-amber-800" : "text-[#8C969B]"}`}>{decision ? statusLabel[decision.status] : "미확인"}</span>
          </button>;
        })}</nav>
        <div className="space-y-3 rounded-xl bg-white p-4">
          <p className="text-lg font-bold">{labelOf(section)}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button className="h-11 text-base" disabled={disabled || saving || approved || !model.value} onClick={() => mark("checked")}>✓ 확인</Button>
            <Button className="h-11 text-base" variant="outline" disabled={disabled || saving || approved} onClick={() => mark("revision_required")}>✗ 수정 요청</Button>
            <Button className="h-11 text-base" variant="ghost" disabled={disabled || saving || approved} onClick={() => mark("defer")}>보류</Button>
          </div>
          <Textarea aria-label="현재 문항 감수 메모" maxLength={2000} rows={7} className="min-h-[10rem] resize-y text-[15px] leading-7" value={current?.note ?? ""} disabled={disabled || saving || approved}
            placeholder="문제 지점이나 수정 방향을 남기세요."
            onChange={(event) => setDraft({ ...draft, decisions: [...draft.decisions.filter((entry) => entry.section !== section.id), {
              section: section.id, status: current?.status ?? "defer", note: event.target.value,
            }] })} />
          {dirty && <Button variant="outline" className="h-10 w-full text-sm" disabled={disabled || saving || approved} onClick={() => void persist(draft)}>감수 메모 저장</Button>}
          <p className="text-sm text-muted-foreground" role="status">{saving ? "감수 기록 저장 중…" : dirty ? "저장하지 않은 감수 기록이 있습니다." : saved ? "현재 버전에 감수 기록이 저장되었습니다." : "확인·수정 요청·보류를 누르면 현재 버전에 저장합니다."}</p>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          {(current?.status === "revision_required" || current?.status === "defer") && <p className="text-sm text-amber-800">현재 미션의 최종 승인을 보류합니다. 아래 원본 수정 도구에서 수정하거나, 판단을 재검토하고 확인으로 바꾸세요.</p>}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">통역의 재생·전사는 버튼을 누를 때 기존 음성 서비스를 사용합니다. 감수 중 응답은 학습 기록으로 저장하지 않습니다. 감수 시간은 화면이 활성화된 시간의 근사값입니다.</p>
      </aside>
    </div>
  </section>;
}
