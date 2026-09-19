import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIENCE_SECTIONS, experienceComplete, viewModelFromReview } from "@/lib/pragma/instructorExperience";
import type { InstructorExperience, ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const ReviewStage = lazy(() => import("@/pages/learner/CanonicalMissionRun").then((module) => ({ default: module.CanonicalReviewStage })));
// New reviews choose only 확인 or 수정 요청. Earlier 보류 records stay stored as they are and are shown read-only.
const statusLabel = { checked: "확인", revision_required: "수정 요청", defer: "보류(기존 기록)" };
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
  // Notes typed before a judgment (or on a legacy 보류 record) are saved together with the next 확인/수정 요청.
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
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
    else counts.open += 1; // No judgment yet, or a legacy 보류 record: not decided.
    return counts;
  }, { checked: 0, revision: 0, open: 0 });
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
  const editable = current && current.status !== "defer";
  const noteValue = editable ? current.note : pendingNotes[section.id] ?? current?.note ?? "";
  const next = () => { setSectionIndex((index) => Math.min(index + 1, EXPERIENCE_SECTIONS.length - 1)); };
  const persist = async (value: InstructorExperience) => {
    setDraft(value); setSaving(true); setError(null);
    try { await onSave({ ...value, active_seconds: Math.floor(elapsed.current / 1000) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "감수 기록 저장 실패"); }
    finally { setSaving(false); }
  };
  // 빠른 감수: 「확인」을 누르면 아직 판정하지 않은 다음 문항으로 넘어가고, 모두 확인되면 최종 승인 칸으로 내려간다.
  // 「수정 요청」은 메모를 적어야 하므로 그 자리에 머문다.
  const decided = (decisions: InstructorExperience["decisions"], id: string) =>
    decisions.some((entry) => entry.section === id && (entry.status === "checked" || entry.status === "revision_required"));
  const goToApproval = () => window.setTimeout(() => document.getElementById("professor-final-approval")?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  const mark = (status: "checked" | "revision_required") => {
    setPendingNotes(({ [section.id]: _used, ...rest }) => rest);
    const decisions = [...draft.decisions.filter((entry) => entry.section !== section.id), { section: section.id, status, note: noteValue }];
    void persist({ ...draft, decisions });
    if (status !== "checked") return;
    const order = EXPERIENCE_SECTIONS.map((item, index) => ({ item, index }));
    const nextOpen = [...order.slice(sectionIndex + 1), ...order.slice(0, sectionIndex)].find(({ item }) => !decided(decisions, item.id));
    if (nextOpen) setSectionIndex(nextOpen.index);
    else if (decisions.filter((entry) => entry.status === "checked").length === EXPERIENCE_SECTIONS.length) goToApproval();
  };
  // 남은 문항 일괄 확인. 이미 「수정 요청」한 문항은 건드리지 않고, 적어 둔 메모는 그대로 함께 저장한다.
  const openSections = EXPERIENCE_SECTIONS.filter((item) => !decided(draft.decisions, item.id));
  const markAllOpen = () => {
    const decisions = [
      ...draft.decisions.filter((entry) => decided(draft.decisions, entry.section)),
      ...openSections.map((item) => ({ section: item.id, status: "checked" as const,
        note: pendingNotes[item.id] ?? draft.decisions.find((entry) => entry.section === item.id)?.note ?? "" })),
    ];
    setPendingNotes({});
    void persist({ ...draft, decisions });
    if (decisions.every((entry) => entry.status === "checked")) goToApproval();
  };
  // 판정이 이미 있는 문항에 메모를 고치면 따로 저장을 누르지 않아도 잠시 뒤 저장한다.
  // 저장 버튼을 남겨 두면 메모만 고친 교수자가 최종 승인에서 막힌다(2026-09-17).
  // 저장은 입력을 멈추지 않는다 — 메모 칸을 저장 중에 잠그면 문장 사이 짧은 멈춤마다 커서를 잃고
  // 긴 메모를 쓸 수 없게 된다(2026-09-17 실사용에서 확인). 저장 중 이어 쓴 글은 다음 저장이 담는다.
  useEffect(() => {
    if (!dirty || saving || approved || disabled || error) return;
    const timer = window.setTimeout(() => { void persist(draft); }, 2500);
    return () => window.clearTimeout(timer);
  }, [dirty, saving, approved, disabled, error, draft]);
  return <section aria-label="학습자 화면 체험 감수" className="rounded-2xl border border-[#D8D3C4] bg-[#F8F7F2] p-4 sm:p-6">
    {model.error && <p role="alert" className="mb-4 text-red-800">{model.error}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20.5rem,22.5rem)]">
      <div className="min-w-0">
        {model.value && <Suspense fallback={<p role="status">학습 화면 준비 중…</p>}><ReviewStage mission={model.value} section={section.id} revealAnswers={answers} onNext={next} /></Suspense>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24">
        {openSections.length > 0 && <Button variant="outline" className="h-10 w-full border-[#CAB23D] text-sm font-bold" disabled={disabled || saving || approved || !model.value}
          onClick={markAllOpen}>남은 {openSections.length}개 모두 확인</Button>}
        <nav aria-label="감수할 장면과 문항" className="grid grid-cols-2 gap-1 xl:grid-cols-1">{EXPERIENCE_SECTIONS.map((item, index) => {
          const decision = draft.decisions.find((entry) => entry.section === item.id);
          return <button key={item.id} type="button" aria-current={sectionIndex === index ? "step" : undefined} onClick={() => setSectionIndex(index)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[15px] ${sectionIndex === index ? "border-[#CAB23D] bg-[#FFF5C2] font-bold" : "border-transparent bg-white"}`}>
            <span>{labelOf(item)}</span>
            <span className={`shrink-0 text-sm font-semibold ${decision?.status === "checked" ? "text-emerald-700" : decision?.status === "revision_required" ? "text-amber-800" : "text-[#8C969B]"}`}>{decision ? statusLabel[decision.status] : "미확인"}</span>
          </button>;
        })}</nav>
        <div className="space-y-3 rounded-xl bg-white p-4">
          <p className="text-lg font-bold">{labelOf(section)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11 text-base" disabled={disabled || saving || approved || !model.value} onClick={() => mark("checked")}>✓ 확인</Button>
            <Button className="h-11 text-base" variant="outline" disabled={disabled || saving || approved} onClick={() => mark("revision_required")}>✗ 수정 요청</Button>
          </div>
          <Textarea aria-label="현재 문항 감수 메모" maxLength={2000} rows={3} className="resize-y text-[15px] leading-7" value={noteValue} disabled={disabled || approved}
            placeholder="문제 지점이나 수정 방향을 남기세요."
            onChange={(event) => editable
              ? setDraft({ ...draft, decisions: [...draft.decisions.filter((entry) => entry.section !== section.id), { ...current, note: event.target.value }] })
              : setPendingNotes((notes) => ({ ...notes, [section.id]: event.target.value }))} />
          {error && dirty && <Button variant="outline" className="h-10 w-full text-sm" disabled={disabled || saving || approved} onClick={() => { setError(null); void persist(draft); }}>다시 저장</Button>}
          <p className="text-sm text-muted-foreground" role="status">{saving ? "감수 기록 저장 중…" : dirty && error ? "저장하지 않은 감수 기록이 있습니다." : dirty ? "메모를 곧 저장합니다…" : !editable && pendingNotes[section.id] ? "확인 또는 수정 요청을 누르면 메모가 자동 저장됩니다." : saved ? "현재 버전에 감수 기록이 저장되었습니다." : ""}</p>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          {current?.status === "revision_required" && <p className="text-sm text-amber-800">수정 요청이 남아 있어 최종 승인을 보류합니다. 다시 보고 문제가 없으면 확인으로 바꾸세요.</p>}
          {current?.status === "defer" && <p className="text-sm text-[#697386]">기존에 보류로 남긴 기록입니다. 확인 또는 수정 요청으로 다시 판정하세요.</p>}
        </div>
      </aside>
    </div>
  </section>;
}
