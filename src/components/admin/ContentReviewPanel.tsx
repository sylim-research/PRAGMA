import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveContentReview, contentReviewRequest, saveProfessorDecisions, saveInstructorExperience, type ContentReviewApproval } from "@/lib/pragma/contentReviewApi";
import { InstructorReviewExperience } from "./InstructorReviewExperience";
import { experienceComplete } from "@/lib/pragma/instructorExperience";
import { reviewTargetKey, startReviewPreparation, useReviewPreparationQueue } from "@/lib/pragma/reviewPreparationQueue";
import { CONTENT_APPROVAL_POLICY, BULK_SIGNAL_RATIONALE, effectiveReviewSteps, isBulkEligibleSignal, primaryReviewResult, generationQualityResult, professorReviewFindings, PROFESSOR_DECISION_LABELS, nextReviewStage, professorDecisionsComplete,
  type InstructorExperience, type ReviewFinding, type ModelReview, type ProfessorFindingDecision, type ReviewResult, type ReviewTarget } from "../../../supabase/functions/_shared/contentReview";

const verdictLabel = { pass: "보고된 문제 항목 없음", warning: "확인 필요", fail: "수정 검토 필요" };
const decisionLabel = { accept: "수용", refine: "보완", reject: "기각" };
type ProfessorDecisionDraft = { decision: ProfessorFindingDecision["decision"] | ""; rationale_ko: string; mode?: ProfessorFindingDecision["mode"] };
/** 초안 → 저장 형식. 묶음 확인으로 채운 항목만 mode를 실어 보낸다. */
function toDecisions(findings: ReviewFinding[], drafts: Record<string, ProfessorDecisionDraft>): ProfessorFindingDecision[] {
  return findings.flatMap((finding) => {
    const draft = drafts[finding.id];
    return draft?.decision ? [{ finding_id: finding.id, decision: draft.decision, rationale_ko: draft.rationale_ko.trim(), ...(draft.mode ? { mode: draft.mode } : {}) }] : [];
  });
}
/** 신호 요약 — issue_ko 앞머리(R30/… 또는 R32:)에서 규칙 번호만 세어 「R30 ×2 · R32 ×1」로 만든다. */
function signalSummary(findings: ReviewFinding[]): string {
  const counts = new Map<string, number>();
  findings.forEach((finding) => { const id = finding.issue_ko.split(/[/:]/)[0].trim() || finding.id; counts.set(id, (counts.get(id) ?? 0) + 1); });
  return [...counts].map(([id, n]) => `${id} ×${n}`).join(" · ");
}

/**
 * 승인 근거 칸은 이 문구로 미리 채워 둔다. 교수자가 지우고 비워 두어도 이 문구로 기록한다 — 승인 시점의 근거가
 * 비어 있지 않게 하려는 것이고, 저장 계약이 요구하는 최소 길이도 이 문구가 충족한다.
 */
const DEFAULT_APPROVAL_NOTE = "이 학습 미션을 수업에 사용합니다.";
const approvalNote = (note: string) => note.trim() || DEFAULT_APPROVAL_NOTE;

export function ContentReviewPanel({ target, onApprove, approvalDisabled = false, refreshKey = "", historicalApproval = false, experiential = false, handoffHref, decisionSlot, missionContentHash, framed = true }: {
  /** false면 바깥 테두리 상자를 그리지 않는다(이미 작업대 상자 안에 놓일 때). */
  framed?: boolean;
  target: ReviewTarget; onApprove?: (approval: ContentReviewApproval) => Promise<void>;
  approvalDisabled?: boolean; refreshKey?: string; historicalApproval?: boolean;
  /** 교수자 최종 승인 화면. ① 내용 확인 → ② 판정 → ③ 승인 순서로 보이고 기술 정보는 접는다. */
  experiential?: boolean;
  /** ② 판정 자리에 함께 둘 교수자 입력(예: 생성 AI 결함의 사용 근거). */
  decisionSlot?: ReactNode;
  /** 미션 콘텐츠 해시 전체. 세부 추적 정보에만 보인다. */
  missionContentHash?: string | null;
  /**
   * 승인이 이 화면의 일이 아닐 때 넘긴다. 자동 점검과 AI 검토까지만 실행하고,
   * 교수자 감수·최종 승인 자리에는 그 화면으로 가는 인계 링크를 둔다.
   */
  handoffHref?: string;
}) {
  const queryClient = useQueryClient();
  const key = ["content-review", target.kind, target.targetId, target.weekNo ?? 0, refreshKey];
  const query = useQuery({ queryKey: key, queryFn: () => contentReviewRequest(target), retry: false, staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(DEFAULT_APPROVAL_NOTE);
  const [confirmed, setConfirmed] = useState(false);
  const [openaiFailOverride, setOpenaiFailOverride] = useState("");
  const [openaiFailConfirmed, setOpenaiFailConfirmed] = useState(false);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, ProfessorDecisionDraft>>({});
  const [experienceReady, setExperienceReady] = useState(false);
  const queue = useReviewPreparationQueue();
  const queued = queue.entries.find((entry) => reviewTargetKey(entry.target) === reviewTargetKey(target));
  const queuedStatus = queued?.status;
  useEffect(() => {
    if (queuedStatus && queuedStatus !== "waiting" && queuedStatus !== "running") {
      void queryClient.invalidateQueries({ queryKey: ["content-review", target.kind, target.targetId, target.weekNo ?? 0, refreshKey], exact: true });
    }
  }, [queuedStatus, queryClient, target.kind, target.targetId, target.weekNo, refreshKey]);
  const state = query.data;
  const run = state?.run ?? null;
  const savedDecisionsJson = JSON.stringify(run?.professor_decisions ?? []);
  useEffect(() => {
    setConfirmed(false); setNote(DEFAULT_APPROVAL_NOTE); setOpenaiFailOverride(""); setOpenaiFailConfirmed(false);
  }, [state?.contentHash, run?.id]);
  useEffect(() => {
    const saved: ProfessorFindingDecision[] = JSON.parse(savedDecisionsJson);
    setDecisionDrafts(Object.fromEntries(saved.map((entry) => [entry.finding_id, entry])));
    setConfirmed(false);
  }, [run?.id, savedDecisionsJson, state?.contentHash]);
  const focused = run?.approval_policy === CONTENT_APPROVAL_POLICY;
  const findings = professorReviewFindings(run);
  const primary = run ? primaryReviewResult(run) : null;
  const steps = effectiveReviewSteps(run);
  const draftDecisions = toDecisions(findings, decisionDrafts);
  // 결정론적 신호는 묶어서 확인하고, AI 의미 지적은 항목별로 판정한다. 규칙 fail은 run을 막으므로 여기 오지 않는다.
  const signalFindings = findings.filter(isBulkEligibleSignal);
  const substantiveFindings = findings.filter((finding) => !isBulkEligibleSignal(finding));
  // 이미 개별 결정(저장분·초안)이 있는 신호는 묶음 확인이 건드리지 않는다.
  const pendingSignals = signalFindings.filter((finding) => !decisionDrafts[finding.id]?.decision);
  const decisionsDirty = findings.some((finding) => {
    const draft = decisionDrafts[finding.id];
    const saved = run?.professor_decisions.find((entry) => entry.finding_id === finding.id);
    return (draft?.decision ?? "") !== (saved?.decision ?? "") || (draft?.rationale_ko.trim() ?? "") !== (saved?.rationale_ko ?? "");
  });
  const decisionsClear = professorDecisionsComplete(findings, run?.professor_decisions ?? [], true) && !decisionsDirty;
  const updateDecision = (id: string, patch: Partial<ProfessorDecisionDraft>) => {
    // 손으로 고치면 그 항목은 묶음 확인이 아니라 개별 판정이 된다.
    setDecisionDrafts((drafts) => ({ ...drafts, [id]: { decision: "", rationale_ko: "", ...drafts[id], ...patch, mode: undefined } }));
    setConfirmed(false);
  };
  const adopt = Boolean(run && !run.approved_at && !focused && state?.reusableGenerationQuality !== undefined);
  const next = adopt ? "rules" : nextReviewStage(run);
  const stepIndex = next === "approved" ? steps.length : steps.findIndex((step) => step.key === next);
  const locked = run?.running_stage && run.lease_until && Date.parse(run.lease_until) > Date.now();
  const blocked = run?.rules.verdict === "fail";
  const dependencyBlocked = state?.dependencies.some((item) => !item.approved);
  const hasOpenaiFail = !focused && run?.openai_review?.result.verdict === "fail";
  const openaiFailClear = !hasOpenaiFail || (openaiFailConfirmed && openaiFailOverride.trim().length >= 10);
  const experienceClear = (focused || !experiential || (experienceReady && experienceComplete(run?.instructor_experience))) && (!run?.instructor_experience || experienceComplete(run.instructor_experience));
  const ready = Boolean(state && next === "professor" && decisionsClear && openaiFailClear && experienceClear && !dependencyBlocked && !blocked && !approvalDisabled);
  const saveExperience = async (experience: InstructorExperience) => {
    if (!state) return;
    setConfirmed(false);
    const current = run ? state : await contentReviewRequest(target, "rules", state);
    if (!current.run || current.contentHash !== state.contentHash || current.sourceHash !== state.sourceHash) throw new Error("콘텐츠가 변경되었습니다. 결과를 새로고침하세요.");
    await saveInstructorExperience(current.run.id, current.contentHash, experience);
    await query.refetch();
  };
  const persistDecisions = async (decisions: ProfessorFindingDecision[]) => {
    if (!run || !state || next !== "professor" || !professorDecisionsComplete(findings, decisions)) return;
    setBusy(true); setError(null);
    try {
      await saveProfessorDecisions(run.id, state.contentHash, decisions);
      await query.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "교수자 판단 저장 실패"); }
    finally { setBusy(false); }
  };
  const saveDecisions = () => persistDecisions(draftDecisions);
  /** 미결 신호만 「수정 없이 사용」으로 채운다. 판정이 전부 갖춰지면 바로 저장하고, AI 쟁점이 남았으면 초안으로 둔다. */
  const confirmSignals = async () => {
    if (pendingSignals.length === 0) return;
    const filled = { ...decisionDrafts };
    pendingSignals.forEach((finding) => { filled[finding.id] = { decision: "no_change", rationale_ko: BULK_SIGNAL_RATIONALE, mode: "bulk_signal" }; });
    setDecisionDrafts(filled); setConfirmed(false);
    await persistDecisions(toDecisions(findings, filled));
  };
  const runNext = async () => {
    setBusy(true); setError(null);
    try {
      if (next === "professor") {
        if (!run || !ready || !confirmed) return;
        const approval: ContentReviewApproval = { reviewId: run.id, contentHash: state!.contentHash, professorNote: approvalNote(note),
          ...(hasOpenaiFail ? { openaiFailOverride: openaiFailOverride.trim() } : {}) };
        await (onApprove ?? approveContentReview)(approval);
        await query.refetch();
      } else if (next !== "approved") {
        const result = await contentReviewRequest(target, next, state);
        queryClient.setQueryData(key, result);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "콘텐츠 승인 처리 실패"); }
    finally { setBusy(false); }
  };
  return <section aria-label="콘텐츠 승인" className={framed ? "my-4 space-y-4 rounded-xl border border-[#D8D3C4] bg-white p-4 text-sm" : "space-y-3 text-sm"}>
    {/* 단계는 얇은 진행줄로. 끝난 단계는 조용히, 현재 단계만 강조한다. 최종 승인 화면은 이 줄 없이 감수부터 시작한다. */}
    {!experiential && <div className="flex flex-wrap items-center justify-between gap-2">
      {/* The final-approval screen already shows its own ①②③ flow; the stage line stays on the quality-check screen. */}
      {experiential ? <span /> : <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]" aria-label={target.kind === "mission" ? "점검 단계 · 코어·MJT5·DCT1 전체" : "점검 단계 · 편성 후 공통 수업자료·교수자 고유 메모"}>
        {steps.map((step, index) => {
          const failed = Boolean(state) && index === 0 && blocked;
          const done = Boolean(state) && index < stepIndex && !failed;
          const current = Boolean(state) && index === stepIndex && !failed;
          return <li key={step.key} aria-current={index === stepIndex ? "step" : undefined} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden className="text-[#B7BEC2]">›</span>}
            <span className={failed ? "rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-800"
              : current ? "rounded-full bg-[#FFF3B8] px-2 py-0.5 font-semibold text-[#5C4A0B]"
              : done ? "text-emerald-800" : "text-[#8C969B]"}>
              {done ? "✓ " : ""}{step.label}{!state ? " · 확인 중" : failed ? " · 오류" : current ? " · 현재" : ""}
            </span>
          </li>;
        })}
      </ol>}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>결과 새로고침</Button>
    </div>}
    {query.isPending && <p role="status">저장된 콘텐츠와 승인 이력을 확인하는 중…</p>}
    {query.isError && <p role="alert" className="text-red-800">{query.error.message}</p>}
    {state && <>
      {experiential && target.kind === "mission" && <InstructorReviewExperience key={`${target.targetId}-${state.contentHash}-${state.sourceHash}`}
        inspection={state} onSave={saveExperience} onReady={setExperienceReady} disabled={busy || approvalDisabled} />}
      {next !== "approved" && next !== "professor" && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#E2DED2] bg-[#FBFAF6] px-3 py-2.5">
        <Button size="sm" disabled={busy || query.isFetching || queue.active || Boolean(locked) || blocked || approvalDisabled}
          onClick={() => void startReviewPreparation([{ target, label: target.kind === "mission" ? `미션 ${target.targetId.slice(0, 8)}` : `${target.weekNo}주차 자료` }])}>감수 자료 준비</Button>
        <p className="text-xs text-muted-foreground">저장 결과는 재사용하고, 없는 AI 검토만 유료로 실행합니다. 추가 모델 검토는 선택 시에만.</p>
      </div>}
      {!experiential && <p className="text-xs text-muted-foreground">버전 {state.contentHash.slice(0, 12)} · 규칙 검사 무료 · 최종 검수 자료는 문항별 근거 생성 비용 발생</p>}
      {experiential && (run || decisionSlot) && <FlowHeading title="자동 검수 결과" />}
      {!run && <p className="text-[13px] text-[#7A5A12]">{state.history.length ? "내용 또는 기준이 달라져 재검토가 필요합니다. 이전 결과는 이력에 보존됩니다." : historicalApproval ? "기존 교수자 승인은 유지됩니다. 이 버전의 점검 연결 기록은 아직 없습니다." : "이 버전의 점검 기록이 없습니다."}</p>}
      {run && <>
        <ReviewFindings title="1. 규칙 검사" result={run.rules} />
        {/* 모델명·검사 시각은 교수자 결정에 필요한 정보가 아니라 추적 정보라, 승인 화면에서는 세부 추적 정보로 옮긴다. */}
        {primary && <ReviewFindings title={run.openai_review ? "OpenAI 검토" : "저장된 OpenAI 검토 재사용 · 추가 호출 없음"} result={primary} metadata={experiential ? undefined : run.openai_review ?? undefined} />}
        {run.openai_review && run.generation_quality && <ReviewFindings title="기존 생성 단계 OpenAI 검토"result={generationQualityResult(run.generation_quality)} />}
        {run.claude_review && <ReviewFindings title="저장된 Claude 독립 검토"result={run.claude_review.result} metadata={experiential ? undefined : run.claude_review} />}
        {findings.length > 0 && (() => {
          const findingCard = (finding: ReviewFinding) => {
            const decision = run.adjudication?.result.decisions.find((item) => item.finding_id === finding.id);
            const draft = decisionDrafts[finding.id];
            const saved = run.professor_decisions.find((item) => item.finding_id === finding.id);
            return <div key={finding.id} className="grid gap-3 rounded border p-3 lg:grid-cols-3">
              <div><strong>{finding.id.startsWith("rule-") ? "규칙 검사" : finding.id.startsWith("claude-") ? "Claude 독립 검토" : finding.id.startsWith("generation-") ? "생성 단계 OpenAI 검토" : "OpenAI 검토"} · {finding.issue_ko}</strong><p className="mt-1">{finding.reason_ko}</p>
                <p className="mt-1 text-xs">유형: {finding.problem_type_ko} · {verdictLabel[finding.severity]}{finding.needs_professor ? " · 교수자 확인 필요" : ""}</p>
                {finding.uncertainty_ko && <p className="mt-1 text-xs">불확실성: {finding.uncertainty_ko}</p>}
                {finding.quote && <blockquote className="my-2 border-l-2 pl-2">{finding.quote}</blockquote>}
                <p className="text-xs">제안: {finding.suggestion_ko}</p><code className="break-all text-[10px]">{finding.where}</code></div>
              <div className="rounded bg-[#F8F7F3] p-3">{decision ? <>
                <strong>OpenAI 재검토 · {decisionLabel[decision.decision]}{decision.needs_professor ? " · 교수자 확인 필요" : ""}</strong>
                <p className="mt-1">{decision.rationale_ko}</p>
                {decision.proposed_change_ko && <p className="mt-2 text-xs">제안: {decision.proposed_change_ko}</p>}
                {decision.evidence_quote && <blockquote className="mt-2 border-l-2 pl-2">{decision.evidence_quote}</blockquote>}
              </> : focused ? "추가 OpenAI 재검토 없음 · 교수자가 직접 판단할 수 있습니다." : "OpenAI 재검토 전"}</div>
              <div className="space-y-2 rounded bg-amber-50 p-3">
                {run.approved_at ? <><strong>교수자 · {saved ? PROFESSOR_DECISION_LABELS[saved.decision] : "판단 없음"}{saved?.mode === "bulk_signal" ? " (묶음 확인)" : ""}</strong><p>{saved?.rationale_ko}</p></>
                  : focused || run.adjudication ? <>
                    <label className="block text-xs font-semibold" htmlFor={`decision-${run.id}-${finding.id}`}>교수자 결정 · {finding.id}</label>
                    <select id={`decision-${run.id}-${finding.id}`} className="w-full rounded border bg-white p-2" value={draft?.decision ?? ""} disabled={busy}
                      onChange={(event) => updateDecision(finding.id, { decision: event.target.value as ProfessorDecisionDraft["decision"] })}>
                      <option value="">판단 선택</option>
                      {Object.entries(PROFESSOR_DECISION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <Textarea aria-label={`교수자 판단 근거 · ${finding.id}`} value={draft?.rationale_ko ?? ""} disabled={busy}
                      onChange={(event) => updateDecision(finding.id, { rationale_ko: event.target.value })} placeholder="이 문제 항목에 대한 결정과 이유를 10자 이상 기록하세요." />
                    {draft?.mode === "bulk_signal" && <p className="text-xs text-muted-foreground">묶음 확인으로 채워진 항목입니다. 결정이나 근거를 고치면 개별 판정이 됩니다.</p>}
                  </> : <p>OpenAI 재검토 후 교수자 결정을 기록합니다.</p>}
              </div>
            </div>;
          };
          const canDecide = next === "professor" && !run.approved_at && (focused || Boolean(run.adjudication));
          return <div className="space-y-3">
            {signalFindings.length > 0 && <section className="space-y-2 rounded-lg border p-3" aria-label="자동 품질 점검 신호">
              <h4 className="text-[14px] font-bold text-[#233542]">자동 품질 점검 신호 {signalFindings.length}건</h4>
              <p className="text-xs">규칙·정규식·집계로 잡힌 비차단 신호입니다 — {signalSummary(signalFindings)}. 묶어서 확인하거나, 필요한 항목만 열어 수정 필요·판단 보류로 바꿀 수 있습니다.</p>
              {canDecide && (pendingSignals.length > 0
                ? <Button variant="outline" disabled={busy || query.isFetching || Boolean(locked) || Boolean(dependencyBlocked) || approvalDisabled} onClick={() => void confirmSignals()}>
                    미결 자동 품질 점검 신호 {pendingSignals.length}건 확인 · 현재 버전 그대로 사용
                  </Button>
                : <p className="text-xs text-muted-foreground">모든 신호에 교수자 결정이 있습니다.</p>)}
              <details className="rounded border p-2"><summary className="cursor-pointer text-xs font-semibold">신호 상세 {signalFindings.length}건 열람</summary>
                <div className="mt-2 space-y-3">{signalFindings.map(findingCard)}</div></details>
            </section>}
            {substantiveFindings.length > 0 && <section className="space-y-3 rounded-lg border p-3" aria-label="의미 쟁점 판정">
              <h4 className="text-[14px] font-bold text-[#233542]">의미 쟁점 판정 {substantiveFindings.length}건</h4>
              <p className="text-xs">AI 검토가 근거를 들어 제기한 의미·화용·콘텐츠 쟁점입니다. 항목마다 교수자가 판정하고 근거를 남깁니다.</p>
              {substantiveFindings.map(findingCard)}
            </section>}
            {run.adjudication && <p className="text-xs">{run.adjudication.result.summary_ko} · {run.adjudication.model}</p>}
            <p className="text-xs text-muted-foreground">AI의 수용·보완은 수정 제안이며 자동 수정되지 않습니다. 기각된 Claude 독립 검토 의견도 보존합니다. OpenAI 재검토에는 1차 검토 결과를 제공하지 않습니다.</p>
            {next === "professor" && <>
              <Button variant="outline" disabled={busy || query.isFetching || Boolean(locked) || Boolean(dependencyBlocked) || approvalDisabled
                || !decisionsDirty || !professorDecisionsComplete(findings, draftDecisions)} onClick={() => void saveDecisions()}>교수자 판단 저장 · 무료</Button>
              <p className="text-xs">{decisionsDirty ? "저장하지 않은 판단이 있습니다." : professorDecisionsComplete(findings, run.professor_decisions) ? "교수자 판단이 현재 버전에 저장되어 있습니다." : "모든 문제 항목의 결정과 근거를 입력한 뒤 저장하세요."}</p>
              <p className="text-xs">판단 저장은 승인이 아닙니다. ‘수정 필요’·‘판단 보류’가 남으면 최종 승인할 수 없습니다. 수정한 콘텐츠는 새 버전의 규칙·품질점검을 연결합니다. 추가 모델 전수 검토를 반복하지 않습니다.</p>
            </>}
          </div>;
        })()}
      </>}
      {decisionSlot}
      {state.dependencies.length > 0 &&<div className="rounded-lg border p-3"><h4 className="text-[14px] font-bold text-[#233542]">재사용 미션 해설</h4>
        <p className="mt-1 text-xs">주차 자료 승인 전 연결 미션의 현재 버전 승인도 완료해야 합니다. 같은 해설을 출력 형식별로 중복 검토하지 않습니다.</p>
        <ul className="mt-2 space-y-1">{state.dependencies.map((item, index) => <li key={item.id}><Link className="underline" to={`/admin/review?scenarioId=${item.id}`}>미션 {index + 1} 승인 확인</Link> · {item.approved ? "현재 버전 승인" : "승인 필요"}</li>)}</ul>
      </div>}
      {blocked && <p className="text-red-800">규칙 오류를 수정·저장해야 AI 검토를 진행할 수 있습니다. 원본은 자동으로 수정하지 않습니다.</p>}
      {run?.last_error && <p role="alert" className="text-red-800">직전 실행: {run.last_error} 재시도에는 비용이 다시 발생할 수 있습니다.</p>}
      {locked && <p role="status">{steps.find(step => step.key === run?.running_stage)?.label ?? "AI 검토"} 실행 중입니다. 결과를 새로고침하세요. 응답이 없으면 실행 잠금 만료 후 수동 재시도할 수 있습니다.</p>}
      {focused && primary && !run?.approved_at && !run?.independent_review_requested && (() => {
        const body = <>
          <p className="text-xs">판단이 엇갈리는 사례에 한해 독립 모델 검토를 추가할 수 있습니다. 교수자 직접 판단도 가능합니다.</p>
          <Button variant="outline" size="sm" className="mt-2" disabled={busy || Boolean(locked) || queue.active || blocked} onClick={() => {
            setBusy(true); setError(null);
            void contentReviewRequest(target, "request_independent", state).then(result => queryClient.setQueryData(key, result))
              .catch(cause => setError(cause instanceof Error ? cause.message : "추가 검토 선택 실패")).finally(() => setBusy(false));
          }}>추가 모델 검토 선택</Button>
        </>;
        // 승인 화면에서는 선택 사항이라 접어 둔다. 기능과 조건은 그대로다.
        return experiential
          ? <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-semibold">추가 모델 검토 선택 (필요할 때만)</summary><div className="mt-2">{body}</div></details>
          : <div className="rounded-lg border p-3">{body}</div>;
      })()}
      {next === "professor" && !handoffHref && <div id="professor-final-approval" className="space-y-2 rounded-lg border border-[#D8D3C4] bg-[#FBFAF6] p-3">
        <h4 className="text-[14px] font-bold text-[#233542]">교수자 최종 승인</h4>
        {!decisionsClear && <p className="text-amber-800">문제 항목별 교수자 판단을 저장하고 수정 필요·판단 보류를 해결해야 최종 승인할 수 있습니다.</p>}
        {!experienceClear && <p className="text-amber-800">체험 감수의 장면·문항·참고 표현을 확인하고 수정 요청·보류·미저장 기록을 해결해야 최종 승인할 수 있습니다.</p>}
        {hasOpenaiFail && <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="font-semibold">AI 검토에서 중대 문제 항목이 확인됐습니다.</p>
          <p className="text-xs">독립 AI 검토의 문제 항목 유무와 별개입니다. 수정이 필요하면 원본을 수정하고 다시 점검하세요. 수정 없이 사용할 때만 그 근거를 남깁니다.</p>
          <Textarea aria-label="AI 검토의 중대 문제 항목 사용 근거" value={openaiFailOverride}
            onChange={(event) => { setOpenaiFailOverride(event.target.value); setOpenaiFailConfirmed(false); setConfirmed(false); }}
            placeholder="중대 문제 항목을 검토하고도 현재 내용을 사용할 수 있는 근거를 10자 이상 기록하세요." />
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={openaiFailConfirmed}
            onChange={(event) => setOpenaiFailConfirmed(event.target.checked)} />AI 검토의 중대 문제 항목을 확인했으며 수정 없이 사용할 수 있다고 판단했습니다.</label>
        </div>}
        <Textarea aria-label="교수자 승인 근거" rows={2} className="min-h-0" value={note} onChange={(event) => setNote(event.target.value)} />
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />현재 원본과 저장된 품질점검·미해결 쟁점을 확인했습니다.</label>
        {approvalDisabled && <p className="text-amber-800">저장하지 않은 수정 또는 기존 결함의 교수자 판단 근거를 먼저 확인하세요.</p>}
      </div>}
      {next !== "approved" && !(handoffHref && next === "professor") && <Button disabled={busy || query.isFetching || queue.active || Boolean(locked) || blocked || (next === "claude" && !state.models.claude)
        || (next === "professor" && (!ready || !confirmed))} onClick={() => void runNext()}>
        {busy ? "처리 중…" : next === "rules" ? "규칙 검사 시작 · 무료" : next === "professor" ? "교수자 최종 승인" : `${steps[stepIndex].label} 실행 · 유료`}
      </Button>}
      {/* 인계는 늘 열어 둔다. 화면을 나눈 탓에 같은 미션을 다시 찾게 만들지 않는다.
          단계와 무관하게 넘어갈 수 있고, 넘어가는 것만으로 승인 상태가 바뀌지 않는다. */}
      {handoffHref && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE8DE] pt-3 text-[13px]">
        <p className="text-[#5D6970]">{next === "approved"
          ? "이 버전은 교수자 승인을 마쳤습니다."
          : next === "professor"
            ? "점검이 끝났습니다. AI 의견은 판단 자료이며 승인은 교수자가 합니다."
            : "점검을 마치면 교수자 최종 승인의 「결정 대기」로 넘어갑니다."}</p>
        <Link to={handoffHref} className="font-semibold text-[#15202B] underline underline-offset-4">교수자 최종 승인에서 이 미션 열기 →</Link>
      </div>}
      {next === "claude" && !state.models.claude && <p className="text-amber-800">Claude 독립 검토 모델이 설정되지 않았습니다. 운영 설정을 먼저 확인해 주세요.</p>}
      {next === "approved" && !handoffHref && <div className="rounded bg-emerald-50 p-3">현재 버전 교수자 승인 · {run?.approved_at}<p className="mt-1">{run?.professor_note}</p>
        {run?.openai_fail_override && <p className="mt-2">AI 검토의 중대 문제 항목 사용 근거: {run.openai_fail_override}</p>}
        {/* 승인·편성·노출은 서로 다른 사건이다. 노출 여부는 이 화면이 판정하지 않으므로 조건만 안내한다. */}
        <p className="mt-2 border-t border-emerald-200 pt-2 text-xs text-emerald-900">
          교수자 승인은 수업 사용·학습자 공개 <b>자격</b>을 부여합니다. 실제 노출에는 주차 편성과 공개 강좌의 접근 조건이 더 필요합니다.
        </p>
      </div>}
      {experiential && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>결과 새로고침</Button>}
      <details><summary className="cursor-pointer text-xs">{experiential ? "세부 추적 정보 · 콘텐츠 원본·승인 이력" : "콘텐츠 원본·승인 이력"}</summary>
        {experiential && <dl className="my-2 grid gap-x-3 gap-y-1 break-all text-[11px] sm:grid-cols-[10rem_1fr]">
          {([
            ["미션 콘텐츠 해시", missionContentHash],
            ["검수 버전 해시", state.contentHash],
            ["원본 해시", state.sourceHash],
            ["검수 run ID", run?.id],
            ["검수 기준", run?.criteria_version],
            ["승인 정책", run?.approval_policy],
            ["OpenAI 검토 모델", run?.openai_review ? `${run.openai_review.model} · ${run.openai_review.checked_at}` : null],
            ["Claude 독립 검토 모델", run?.claude_review ? `${run.claude_review.model} · ${run.claude_review.checked_at}` : null],
            ["OpenAI 재검토 모델",run?.adjudication ? `${run.adjudication.model} · ${run.adjudication.checked_at}` : null],
          ] as Array<[string, string | null | undefined]>).filter(([, value]) => value).map(([label, value]) => <div key={label} className="contents">
            <dt className="font-semibold text-[#5D6970]">{label}</dt><dd className="font-mono">{value}</dd>
          </div>)}
        </dl>}
        <p className="my-2 text-xs">현재 정적 콘텐츠 원본을 확인합니다. 개별 학습자 실시간 피드백을 전수 검토했다는 뜻은 아닙니다.</p>
        <pre className="max-h-72 overflow-auto rounded bg-[#F7F7F5] p-3 text-[11px]">{JSON.stringify(state.snapshot, null, 2)}</pre>
        <ul className="mt-2 space-y-1 text-xs">{state.history.map((item) => <li key={item.id}>{item.created_at} · {experiential ? item.content_hash : item.content_hash.slice(0, 12)} · {item.approved_at ? "당시 승인" : "점검·승인 이력"}</li>)}</ul>
      </details>
    </>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
  </section>;
}

function FlowHeading({ step, title, note }: { step?: string; title: string; note?: string }) {
  return <div className="border-t pt-3 first:border-t-0 first:pt-0">
    <h4 className="text-[14px] font-bold text-[#233542]">{step ? `${step} ${title}` : title}</h4>
    {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
  </div>;
}

function ReviewFindings({ title, result, metadata }: { title: string; result: ReviewResult; metadata?: ModelReview<ReviewResult> }) {
  return <details open={result.findings.length > 0} className="border-l-2 border-[#D9D6CC] py-0.5 pl-3">
    <summary className="cursor-pointer font-semibold">{title} · {verdictLabel[result.verdict]} · {result.findings.length}건</summary>
    {metadata && <p className="mt-1 text-xs text-muted-foreground">{metadata.model} · {metadata.checked_at}</p>}
    {/* 판정·findings가 정본. 자유서술 요약은 판정과 어긋날 수 있어 목록 뒤에 보조로 둔다. */}
    <ul className="mt-2 space-y-3">{result.findings.map((finding) => <li key={finding.id} className="border-t pt-2">
      <strong>{finding.issue_ko}</strong><p>{finding.reason_ko}</p>
      <p className="text-xs">유형: {finding.problem_type_ko}{finding.needs_professor ? " · 교수자 확인 필요" : ""}</p>
      {finding.uncertainty_ko && <p className="text-xs">불확실성: {finding.uncertainty_ko}</p>}
      {finding.quote && <blockquote className="my-1 border-l-2 pl-2">{finding.quote}</blockquote>}
      <p className="text-xs">제안: {finding.suggestion_ko}</p>
    </li>)}</ul>
    {result.summary_ko && <p className="mt-2 text-xs text-muted-foreground"><b>요약(보조)</b> {result.summary_ko}</p>}
  </details>;
}
