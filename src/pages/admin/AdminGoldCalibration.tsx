import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Info, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  GOLD_CALIBRATION_REVIEW_SCHEMA_VERSION,
  GoldCalibrationReviewSchema,
  buildResearcherApprovedCalibrationCase,
  calibrationResolutionStatus,
  makeGoldCalibrationReview,
  type GoldCalibrationReview,
} from "@/lib/pragma/goldCalibration";
import { SEED_GOLD_CASES, type SeedGoldCase } from "@/lib/pragma/seedGoldSet";
import {
  BOOTSTRAP_SEED_GOLD_CASE_COUNT,
  BOOTSTRAP_SEED_GOLD_SPEECH_ACT_COUNT,
  FINAL_GOLD_CASES_PER_SPEECH_ACT,
  FINAL_GOLD_POPULATION_COUNT,
} from "@/lib/pragma/goldProtocol";

type CandidateId = "A" | "B" | "C";
type Verdict = "approve" | "revise" | "reject";
type BooleanChoice = "yes" | "no" | "";
type CalibrationStatus = "researcher_approved" | "revise_required" | "rejected";

type CandidateDraft = {
  assessed_band_code: string;
  semantic_fidelity: "pass" | "fail" | "";
  rationale_ko: string;
};

type ReviewDraft = {
  scenario_valid: BooleanChoice;
  pdr_valid: BooleanChoice;
  semantic_invariant_valid: BooleanChoice;
  candidates: Record<CandidateId, CandidateDraft>;
  overall_verdict: Verdict | "";
  rationale_ko: string;
};

type StoredReview = GoldCalibrationReview & {
  id: string;
  reviewer_user_id: string;
  submitted_at: string;
};

type StoredResolution = {
  id: string;
  source_review_id: string;
  case_id: string;
  case_version: string;
  resolution_round: number;
  resolution_status: CalibrationStatus;
  resolved_at: string;
};

const BAND_OPTIONS = {
  request: [
    ["too_direct", "과도하게 직접적"],
    ["within_band", "목표 적절성 대역"],
    ["too_indirect", "과도하게 간접적"],
  ],
  refusal: [
    ["too_blunt", "과도하게 단정적"],
    ["within_band", "목표 적절성 대역"],
    ["over_elaborate", "과도하게 장황함"],
  ],
  thanks: [
    ["insufficient", "감사 강도 부족"],
    ["within_band", "목표 적절성 대역"],
    ["excessive", "감사 강도 과도"],
  ],
} as const;

const ACT_LABEL = { request: "요청", refusal: "거절", thanks: "감사" } as const;
const MODE_LABEL = { translation: "번역", stt_interpreting: "통역" } as const;
const STATUS_LABEL: Record<CalibrationStatus, string> = {
  researcher_approved: "연구자 판정 확정",
  revise_required: "수정 필요",
  rejected: "기각",
};

const emptyCandidate = (): CandidateDraft => ({
  assessed_band_code: "",
  semantic_fidelity: "",
  rationale_ko: "",
});

const emptyDraft = (): ReviewDraft => ({
  scenario_valid: "",
  pdr_valid: "",
  semantic_invariant_valid: "",
  candidates: { A: emptyCandidate(), B: emptyCandidate(), C: emptyCandidate() },
  overall_verdict: "",
  rationale_ko: "",
});

// 신규 moat table은 생성 타입 재생성 전이므로 제한적으로 table name을 동적 처리한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

const parseStoredReview = (row: Record<string, unknown>): StoredReview => ({
  ...GoldCalibrationReviewSchema.parse(row),
  id: String(row.id),
  reviewer_user_id: String(row.reviewer_user_id),
  submitted_at: String(row.submitted_at),
});

const statusTone = (status?: CalibrationStatus) => {
  if (status === "researcher_approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "revise_required") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const AdminGoldCalibration = () => {
  const [selectedCaseId, setSelectedCaseId] = useState(SEED_GOLD_CASES[0].case_id);
  const [actFilter, setActFilter] = useState<"all" | SeedGoldCase["speech_act"]>("all");
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<StoredReview[]>([]);
  const [resolutions, setResolutions] = useState<StoredResolution[]>([]);

  const selectedCase = useMemo(
    () => SEED_GOLD_CASES.find((item) => item.case_id === selectedCaseId) ?? SEED_GOLD_CASES[0],
    [selectedCaseId],
  );

  const filteredCases = useMemo(
    () => SEED_GOLD_CASES.filter((item) => actFilter === "all" || item.speech_act === actFilter),
    [actFilter],
  );

  const resolutionByCase = useMemo(() => {
    const result = new Map<string, StoredResolution>();
    for (const resolution of resolutions) {
      if (!result.has(resolution.case_id)) result.set(resolution.case_id, resolution);
    }
    return result;
  }, [resolutions]);

  const resolvedReviewIds = useMemo(
    () => new Set(resolutions.map((resolution) => resolution.source_review_id)),
    [resolutions],
  );

  const latestUnresolvedReview = useMemo(
    () => reviews.find((review) => review.case_id === selectedCase.case_id && !resolvedReviewIds.has(review.id)) ?? null,
    [reviews, resolvedReviewIds, selectedCase.case_id],
  );

  const nextRound = useMemo(() => {
    const rounds = reviews
      .filter((review) => review.case_id === selectedCase.case_id && review.case_version === selectedCase.version)
      .map((review) => review.review_round);
    return Math.max(0, ...rounds) + 1;
  }, [reviews, selectedCase]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data: admin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || !admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    const [reviewResult, resolutionResult] = await Promise.all([
      db.from("pragma_gold_calibration_reviews").select("*").order("submitted_at", { ascending: false }),
      db.from("pragma_gold_calibration_resolutions").select("*").order("resolved_at", { ascending: false }),
    ]);
    if (reviewResult.error || resolutionResult.error) {
      setMessage(reviewResult.error?.message ?? resolutionResult.error?.message ?? "기준답안 연구자 판정 기록을 불러오지 못했습니다.");
    } else {
      try {
        setReviews((reviewResult.data ?? []).map(parseStoredReview));
        setResolutions((resolutionResult.data ?? []) as StoredResolution[]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "저장된 calibration 계약을 해석하지 못했습니다.");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRows(); }, [loadRows]);

  useEffect(() => {
    setDraft(emptyDraft());
    setMessage(null);
  }, [selectedCaseId]);

  const updateContext = (key: "scenario_valid" | "pdr_valid" | "semantic_invariant_valid", value: BooleanChoice) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateCandidate = (candidateId: CandidateId, patch: Partial<CandidateDraft>) => {
    setDraft((current) => ({
      ...current,
      candidates: {
        ...current.candidates,
        [candidateId]: { ...current.candidates[candidateId], ...patch },
      },
    }));
  };

  const draftComplete = useMemo(() => {
    const contexts = [draft.scenario_valid, draft.pdr_valid, draft.semantic_invariant_valid].every(Boolean);
    const candidates = Object.values(draft.candidates).every((item) => (
      item.assessed_band_code && item.semantic_fidelity && item.rationale_ko.trim()
    ));
    return Boolean(contexts && candidates && draft.overall_verdict && draft.rationale_ko.trim());
  }, [draft]);

  const submitReview = async () => {
    if (!isAdmin || !draftComplete) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("관리자 로그인 세션을 확인할 수 없습니다.");
      const review = makeGoldCalibrationReview({
        caseSnapshot: selectedCase,
        review_round: nextRound,
        context_assessment: {
          scenario_valid: draft.scenario_valid === "yes",
          pdr_valid: draft.pdr_valid === "yes",
          semantic_invariant_valid: draft.semantic_invariant_valid === "yes",
        },
        candidate_assessments: draft.candidates as GoldCalibrationReview["candidate_assessments"],
        overall_verdict: draft.overall_verdict as Verdict,
        rationale_ko: draft.rationale_ko.trim(),
      });
      const { data, error } = await db.from("pragma_gold_calibration_reviews").insert({
        schema_version: GOLD_CALIBRATION_REVIEW_SCHEMA_VERSION,
        case_id: review.case_id,
        case_version: review.case_version,
        realization_pack_id: review.realization_pack_id,
        realization_pack_version: review.realization_pack_version,
        case_snapshot: review.case_snapshot,
        reviewer_user_id: authData.user.id,
        review_round: review.review_round,
        context_assessment: review.context_assessment,
        candidate_assessments: review.candidate_assessments,
        overall_verdict: review.overall_verdict,
        rationale_ko: review.rationale_ko,
      }).select("*").single();
      if (error) throw error;
      setReviews((current) => [parseStoredReview(data), ...current]);
      setMessage(`${review.review_round}차 판단을 원본 그대로 저장했습니다. 이제 이 판단을 기준답안으로 확정하세요.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "판정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const resolveLatestReview = async () => {
    if (!isAdmin || !latestUnresolvedReview) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("관리자 로그인 세션을 확인할 수 없습니다.");
      const resolutionStatus = calibrationResolutionStatus(latestUnresolvedReview);
      const resolvedSnapshot = resolutionStatus === "researcher_approved"
        ? buildResearcherApprovedCalibrationCase(latestUnresolvedReview, authData.user.id)
        : null;
      const { data, error } = await db.from("pragma_gold_calibration_resolutions").insert({
        source_review_id: latestUnresolvedReview.id,
        case_id: latestUnresolvedReview.case_id,
        case_version: latestUnresolvedReview.case_version,
        resolution_round: latestUnresolvedReview.review_round,
        resolution_status: resolutionStatus,
        resolved_case_snapshot: resolvedSnapshot,
        rationale_ko: latestUnresolvedReview.rationale_ko,
        resolved_by: authData.user.id,
      }).select("id, source_review_id, case_id, case_version, resolution_round, resolution_status, resolved_at").single();
      if (error) throw error;
      setResolutions((current) => [data as StoredResolution, ...current]);
      setMessage(`${STATUS_LABEL[resolutionStatus]} 해결본을 새 레코드로 확정했습니다. Seed snapshot은 변경되지 않았습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "해결본 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const approvedCount = [...resolutionByCase.values()]
    .filter((item) => item.resolution_status === "researcher_approved").length;
  const resolvedCount = new Set(resolutions.map((item) => item.case_id)).size;
  const selectedResolution = resolutionByCase.get(selectedCase.case_id);

  return (
    <AdminShell
      title="연구용 예시 검토 — 파일럿"
      description={`초기에 작성한 ${BOOTSTRAP_SEED_GOLD_SPEECH_ACT_COUNT}화행 ${BOOTSTRAP_SEED_GOLD_CASE_COUNT}개 예시의 판단과 근거를 기록합니다. 앱 전체의 판정 기준을 설정하는 화면은 아닙니다.`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/review" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 교수자 최종 승인로 이동
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">파일럿 판정 기록 {resolvedCount}/{BOOTSTRAP_SEED_GOLD_CASE_COUNT}</Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">기준안 승인 {approvedCount}건</Badge>
          <Badge variant="outline" className={isAdmin ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
            {loading ? "권한 확인 중" : isAdmin ? "관리자 저장 가능" : "미리보기 · 저장 잠김"}
          </Badge>
        </div>
      </div>

      <section className="mb-5 rounded-xl border border-[#E5CF72] bg-[#FFF9DF] p-4 text-sm leading-6 text-[#665515]">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">수업 콘텐츠를 감수하고 최종 승인하는 절차와 별개인 연구용 파일럿입니다.</p>
            <p className="mt-1">0/{BOOTSTRAP_SEED_GOLD_CASE_COUNT}은 파일럿 예시에 대한 판정 기록이 없다는 뜻이며, 수업 준비율이나 미승인 수업 콘텐츠 수가 아닙니다. 지금 모두 평가할 필요는 없습니다.</p>
          </div>
        </div>
        <details className="mt-3 border-t border-[#E5CF72] pt-3">
          <summary className="cursor-pointer font-medium">기존 판정 방식과 연구 프로토콜의 한계</summary>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>현재 화면은 미리 정한 기준안을 공개하지 않으며, 그 기준안과 일치하는 판단만 승인할 수 있습니다. 다른 판단은 ‘수정 필요’나 ‘기각’으로 기록할 수 있지만, 예시 자체를 수정해 확정하는 편집 기능은 없습니다.</li>
            <li>{FINAL_GOLD_POPULATION_COUNT}개는 기존 연구 프로토콜의 9화행 × {FINAL_GOLD_CASES_PER_SPEECH_ACT}개 설정값입니다. 현재 {BOOTSTRAP_SEED_GOLD_CASE_COUNT}개와는 별개이며, 지금 수업 운영을 위해 채워야 하는 수나 대표성·타당성을 보장하는 기준이 아닙니다.</li>
            <li>기존 예시·판정 기록과 과거 연구배치·외부 표본 추출의 참조는 보존합니다. 이 기록을 현재 수업 콘텐츠의 감수 완료나 학습자 공개 승인으로 사용하지 않습니다.</li>
          </ul>
        </details>
      </section>

      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-4">
          <Select value={actFilter} onValueChange={(value) => setActFilter(value as typeof actFilter)}>
            <SelectTrigger aria-label="화행 필터"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 화행 · 30</SelectItem>
              <SelectItem value="request">요청 · 10</SelectItem>
              <SelectItem value="refusal">거절 · 10</SelectItem>
              <SelectItem value="thanks">감사 · 10</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-3 max-h-[720px] space-y-1 overflow-y-auto pr-1">
            {filteredCases.map((item) => {
              const resolution = resolutionByCase.get(item.case_id);
              return (
                <button
                  key={item.case_id}
                  type="button"
                  onClick={() => setSelectedCaseId(item.case_id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${item.case_id === selectedCase.case_id ? "border-[#D6AD00] bg-[#FFF8D1]" : "border-transparent hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">{item.case_id.replace("GOLD-KOZH-", "")}</span>
                    <Badge variant="outline" className={`text-[10px] ${statusTone(resolution?.resolution_status)}`}>
                      {resolution ? STATUS_LABEL[resolution.resolution_status] : "미판정"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{ACT_LABEL[item.speech_act]} · {MODE_LABEL[item.mode]} · {item.domain}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">품질검사 사례 {selectedCase.case_id} · 문항 버전 {selectedCase.version} · 규칙집 {selectedCase.realization_pack_version}</p>
                <h2 className="mt-1 text-xl font-semibold">{ACT_LABEL[selectedCase.speech_act]} · {selectedCase.target_feature}</h2>
              </div>
              <Badge variant="outline">{nextRound}차 판정</Badge>
            </div>
            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
              <div><dt className="text-xs font-medium text-muted-foreground">P / D / R</dt><dd className="mt-1">{selectedCase.pdr.power} / {selectedCase.pdr.distance} / {selectedCase.pdr.burden}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">수준·영역·모드</dt><dd className="mt-1">{selectedCase.level} · {selectedCase.domain} · {MODE_LABEL[selectedCase.mode]}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">선행 발화</dt><dd className="mt-1">{selectedCase.preceding_turn_zh ?? "없음"}</dd></div>
            </dl>
            <div className="mt-4 grid gap-3">
              <div className="rounded-lg bg-muted/50 p-4"><p className="text-xs font-medium text-muted-foreground">상황</p><p className="mt-1 text-sm leading-6">{selectedCase.scenario_ko}</p></div>
              <div className="rounded-lg bg-muted/50 p-4"><p className="text-xs font-medium text-muted-foreground">한국어 원문</p><p className="mt-1 text-sm leading-6">{selectedCase.source_text_ko}</p></div>
              <div className="rounded-lg bg-muted/50 p-4"><p className="text-xs font-medium text-muted-foreground">보존해야 할 의미</p><p className="mt-1 text-sm leading-6">{selectedCase.semantic_invariant_ko}</p></div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">1. 상황과 원문의 의미 확인</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {([
                ["scenario_valid", "상황이 실제적·해석 가능함"],
                ["pdr_valid", "P/D/R 부호화가 상황과 맞음"],
                ["semantic_invariant_valid", "의미 불변항이 원문을 보존함"],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-sm font-medium">
                  {label}
                  <Select value={draft[key]} onValueChange={(value) => updateContext(key, value as BooleanChoice)}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="판정 선택" /></SelectTrigger>
                    <SelectContent><SelectItem value="yes">예</SelectItem><SelectItem value="no">아니오</SelectItem></SelectContent>
                  </Select>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">2. 중국어 후보 A·B·C 확인</h2>
            <p className="mt-1 text-sm text-muted-foreground">미리 정한 답을 보지 않고 각 문장의 적절성과 의미 보존 여부를 판단합니다.</p>
            <div className="mt-4 space-y-4">
              {selectedCase.candidates.map((candidate) => {
                const candidateId = candidate.candidate_id;
                return (
                  <article key={candidateId} className="rounded-xl border border-border p-4">
                    <div className="flex gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#15202B] text-sm font-semibold text-white">{candidateId}</span>
                      <p className="pt-1 text-base leading-7" lang="zh">{candidate.text_zh}</p>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium">적절성 대역
                        <Select value={draft.candidates[candidateId].assessed_band_code} onValueChange={(value) => updateCandidate(candidateId, { assessed_band_code: value })}>
                          <SelectTrigger className="mt-2"><SelectValue placeholder="대역 선택" /></SelectTrigger>
                          <SelectContent>{BAND_OPTIONS[selectedCase.speech_act].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </label>
                      <label className="text-sm font-medium">의미 충실성
                        <Select value={draft.candidates[candidateId].semantic_fidelity} onValueChange={(value) => updateCandidate(candidateId, { semantic_fidelity: value as CandidateDraft["semantic_fidelity"] })}>
                          <SelectTrigger className="mt-2"><SelectValue placeholder="의미 판정" /></SelectTrigger>
                          <SelectContent><SelectItem value="pass">보존</SelectItem><SelectItem value="fail">훼손·누락</SelectItem></SelectContent>
                        </Select>
                      </label>
                    </div>
                    <label className="mt-4 block text-sm font-medium">판정 근거
                      <Textarea className="mt-2 min-h-[76px]" value={draft.candidates[candidateId].rationale_ko} onChange={(event) => updateCandidate(candidateId, { rationale_ko: event.target.value })} placeholder="중국어 실현, 관계·부담, 의미 보존을 근거로 간결히 기록" />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">3. 연구자 종합판정</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="text-sm font-medium">판정
                <Select value={draft.overall_verdict} onValueChange={(value) => setDraft((current) => ({ ...current, overall_verdict: value as Verdict }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="종합 판정" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">승인 — 이견 없음</SelectItem>
                    <SelectItem value="revise">수정 — 판정 이견 있음</SelectItem>
                    <SelectItem value="reject">제외 — 품질검사 기준답안으로 부적합</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm font-medium">종합 근거
                <Textarea className="mt-2 min-h-[86px]" value={draft.rationale_ko} onChange={(event) => setDraft((current) => ({ ...current, rationale_ko: event.target.value }))} placeholder="채택·수정·기각 이유와 필요한 후속 조치" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <p className="max-w-xl text-xs leading-5 text-muted-foreground">상황, P/D/R, 원문의 의미와 중국어 후보가 모두 타당할 때만 승인합니다. 하나라도 다르게 판단했다면 ‘수정 필요’로 남기세요.</p>
              <Button onClick={submitReview} disabled={!isAdmin || !draftComplete || saving || Boolean(latestUnresolvedReview)}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "저장 중…" : `${nextRound}차 판정 저장`}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-semibold">4. 연구자 판정 확정본 저장</h2></div>
                <p className="mt-1 text-sm text-muted-foreground">원래 판정은 그대로 보존하고, 최종 결론을 별도로 저장합니다. 확정 전에는 다음 차수 판정을 시작하지 않습니다.</p>
              </div>
              <Button variant="outline" onClick={resolveLatestReview} disabled={!isAdmin || !latestUnresolvedReview || saving}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {latestUnresolvedReview ? `${STATUS_LABEL[calibrationResolutionStatus(latestUnresolvedReview)]} 해결본 기록` : selectedResolution ? "해결 완료" : "저장된 판정 없음"}
              </Button>
            </div>
            {latestUnresolvedReview && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">아직 확정하지 않은 {latestUnresolvedReview.review_round}차 판정이 있습니다. 확정본을 저장한 뒤 다음 판정을 시작할 수 있습니다.</p>}
            {message && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm leading-6">{message}</p>}
          </section>
        </main>
      </div>
    </AdminShell>
  );
};

export default AdminGoldCalibration;
