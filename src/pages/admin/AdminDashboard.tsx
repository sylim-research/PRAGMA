import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { ServiceHealthPanel } from "@/components/admin/ServiceHealthPanel";
import { DashboardResourceOverview } from "@/components/admin/DashboardResourceOverview";
import { DASHBOARD_SCENARIO_SELECT, summarizeDashboardResources } from "@/lib/admin/adminDashboardResources";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IS_DEV } from "@/lib/auth/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  DASHBOARD_ROW_CAP,
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  dominantDashboardReviewStage,
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  type DashboardAssignmentRow,
  type DashboardReviewRunRow,
  type DashboardReviewQueueStage,
  type DashboardReviewStageCounts,
  type DashboardScenarioRow,
  countRulesFailures,
  excludeSupersededRows,
  isDashboardReviewTarget,
  summarizeAssignmentApproval,
  summarizeCourses,
  type DashboardCourseRow,
  DASHBOARD_REVIEW_RUN_SELECT,
  DASHBOARD_CUMULATIVE_RUN_SELECT,
  summarizeCumulativeReviewCompletion,
  type DashboardCumulativeReviewCounts,
  type DashboardCumulativeRunRow,
} from "@/lib/admin/adminDashboardMetrics";
import { ACTIVE_RULE_IDS } from "@/lib/pragma/missionRules";
import { CONTENT_REVIEW_STEPS } from "../../../supabase/functions/_shared/contentReview";
import { toast } from "sonner";

// content_review_runs는 2026-08-27 migration 이후 생성 타입을 아직 재발행하지 않았다.
// 이 화면의 예외는 조회 전용이며 선택 컬럼을 DashboardReviewRunRow로 즉시 좁힌다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

type DashboardSnapshot = {
  resources: ReturnType<typeof summarizeDashboardResources>;
  content: ReturnType<typeof summarizeDashboardContent>;
  review: DashboardReviewStageCounts;
  assignments: ReturnType<typeof summarizeDashboardAssignments>;
  /** 편성된 미션(중복 제거) 중 승인 완료·승인 전. */
  assignmentApproval: ReturnType<typeof summarizeAssignmentApproval>;
  /** 교과목 전체와 공개(published)·비공개. */
  courses: ReturnType<typeof summarizeCourses>;
  /** 규칙 검사 칸 안의 검사 실패 수. */
  rulesFailCount: number;
  approvedLearnerCount: number;
  learnerRecordCount: number;
  /** 단계별 누적 완료(서로 다른 미션 수). 메인에는 대기량을 두고, 누적은 카드에 마우스를 올릴 때 보인다. 읽지 못하면 null. */
  cumulative: DashboardCumulativeReviewCounts | null;
  /** 교과목(course_id)에 연결된 수행 기록 수 — 수업 운영 기록과 시범 수행을 가른다. 읽지 못하면 null. */
  courseLinkedRecordCount: number | null;
};

type DashboardMetricKey =
  | "core"
  | "mission"
  | "reviewTarget"
  | "finalized"
  | "pending"
  | `review.${DashboardReviewQueueStage}`
  | "courses"
  | "assignments"
  | "learners"
  | "records";

function dashboardMetricValues(snapshot: DashboardSnapshot): Record<DashboardMetricKey, number> {
  return {
    core: snapshot.content.coreCount,
    mission: snapshot.content.generatedMissionCount,
    reviewTarget: snapshot.content.reviewTargetCount,
    finalized: snapshot.content.professorFinalizedCount,
    pending: snapshot.content.pendingRevisionCount,
    "review.rules": snapshot.review.rules,
    "review.openai": snapshot.review.openai,
    "review.claude": snapshot.review.claude,
    "review.adjudication": snapshot.review.adjudication,
    "review.professor": snapshot.review.professor,
    courses: snapshot.courses.total,
    // 큰 수 = 배정 건수(운영 단위). 서로 다른 미션 수는 설명줄에.
    assignments: snapshot.assignments.assignmentCount,
    learners: snapshot.approvedLearnerCount,
    records: snapshot.learnerRecordCount,
  };
}

const PanelHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="mb-3 mt-6">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1B2A36]">{title}</h2>
      {action}
    </div>
    {description && <p className="mt-0.5 text-[12px] text-[#4F5D68]">{description}</p>}
  </div>
);

// 용어대장 기준: 규칙은 「검사」, AI는 「검토」(의견 제시, 판정 아님), 뒤따르는 AI는 「재검토」,
// 교수자는 「최종 승인」. 「지적」은 산출물 이름으로 쓰지 않고 「판정」은 연구자 몫이라 여기 쓰지 않는다.
// 카드 숫자는 그 단계를 마친 서로 다른 미션 수(누적)다 — 대기는 대부분 0이라 흐름이 보이지 않는다.
// 지금 기다리는 수는 카드 툴팁에 둔다. 누가 무엇을 검토하는지도 이름에 둔다 —
// 「AI」만으로는 단계가 구별되지 않아 모델 제공사 이름을 붙인다(모델 버전은 추적 정보라 넣지 않는다)
// (논문 4.3.3, focused_v1: 규칙 검사 → OpenAI 검토(저장된 생성 품질점검 재사용) → 선택 시에만 Claude 독립 검토 → Claude 의견이 있을 때만 OpenAI 재검토 → 교수자 최종 승인).
const REVIEW_STAGE_DISPLAY_LABELS: Record<DashboardReviewQueueStage, string> = {
  rules: "규칙 검사 완료",
  openai: "OpenAI 검토 완료",
  claude: "Claude 독립 검토 완료",
  adjudication: "OpenAI 재검토 완료",
  // 전체 흐름 「교수자 승인 완료」와 같은 수다.
  professor: "교수자 승인 완료",
};

// 1~4단계는 품질 점검 화면이, 5단계는 교수자 최종 승인 화면이 처리한다.
const REVIEW_STAGE_ROUTE = (stage: DashboardReviewQueueStage) => (stage === "professor" ? "/admin/review" : "/admin/ai-review");

// 카드 폭 안에서 한 줄. 무엇을 하는지만 남기고 방법은 뺀다.
const REVIEW_STAGE_DESCRIPTIONS: Record<DashboardReviewQueueStage, string> = {
  // 규칙은 형식만이 아니라 문항 구성·요청 조건·역할·언어 방향까지 본다 — 좁혀 부르지 않는다.
  rules: `규칙 ${ACTIVE_RULE_IDS.length}개 자동 검사`,
  // 저장된 생성 품질 점검 재사용 여부는 구현 사정이라 첫 화면에 두지 않는다. 검토가 보는 것만 쓴다.
  openai: "의미·자연성 검토",
  claude: "교수자가 요청할 때",
  // Claude 독립 검토에 의견이 있을 때만, OpenAI가 그 의견을 항목별로 다시 판단한다(nextDashboardReviewStage·ContentReviewPanel).
  adjudication: "Claude 의견이 있을 때",
  // 교수자는 학습자에게 보일 장면·문항을 그대로 확인한 뒤 따로 최종 승인한다(ContentReviewPanel 「학생 화면으로 감수하기」).
  professor: "학습자 화면 확인 후 승인",
};
// 2026-09-06 경량 검수부터 Claude 별도 검토와 재검토는 교수자가 선택했을 때만 거친다.
// 화살표만 두면 다섯 단계를 모두 지나는 것처럼 읽히므로, 선택 단계는 점선으로 구분한다.
const OPTIONAL_REVIEW_STAGES: ReadonlySet<DashboardReviewQueueStage> = new Set(["claude", "adjudication"]);

// Final evidence preparation belongs to the professor-work queue on this overview.
const REVIEW_STAGE_ITEMS = CONTENT_REVIEW_STEPS.filter((stage) => stage.key !== "finalization").map((stage, index) => ({
  ...stage,
  step: index + 1,
  displayLabel: REVIEW_STAGE_DISPLAY_LABELS[stage.key],
  description: REVIEW_STAGE_DESCRIPTIONS[stage.key],
  optional: OPTIONAL_REVIEW_STAGES.has(stage.key),
}));

const ReviewPipeline = ({
  review,
  cumulative,
  professorFinalized,
  dominant,
  rulesFailCount,
  error,
  changedKeys,
}: {
  review: DashboardReviewStageCounts | null;
  cumulative: DashboardCumulativeReviewCounts | null;
  professorFinalized: number | null;
  dominant: DashboardReviewQueueStage | null;
  rulesFailCount: number;
  error: string | null;
  changedKeys: ReadonlySet<DashboardMetricKey>;
}) => (
  <div role="group" aria-label="품질 검수 단계">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {(() => {
      const renderStage = (stage: (typeof REVIEW_STAGE_ITEMS)[number]) => {
        // 메인은 누적 완료(서로 다른 미션 수)다. 지금 기다리는 수는 마우스를 올릴 때 보인다.
        const waiting = review?.[stage.key] ?? null;
        const value = stage.key === "professor" ? professorFinalized : cumulative?.[stage.key] ?? null;
        // 대기는 읽혔는데 누적 조회만 실패한 경우 — 스켈레톤 대신 「—」.
        const unavailable = waiting !== null && value === null;
        const active = dominant === stage.key;
        const changed = changedKeys.has(`review.${stage.key}`);
        return (
          <div key={stage.key} className="relative min-w-0">
            {/* 단계 카드는 중립색으로 두고 가장 많이 쌓인 단계만 표시해 둔다. */}
            <Link
              to={REVIEW_STAGE_ROUTE(stage.key)}
              className={[
                "group flex min-h-[78px] flex-col rounded-xl border bg-white px-4 py-2.5",
                "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
                stage.key === "professor" ? "border-[#D9CB8F]" : "border-[#E6E1D5]",
                changed ? "ring-2 ring-[#F4D85E]/35" : "",
              ].join(" ")}
              data-optional={stage.optional ? "true" : undefined}
              data-dominant={active ? "true" : undefined}
              title={waiting === null || error ? undefined : `지금 대기 ${waiting}개`}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF1F2] text-[10px] font-semibold tabular-nums text-[#56646E]">
                  {stage.step}
                </span>
                <span className="text-xs font-semibold leading-4 text-[#3F4E59]">{stage.displayLabel}</span>
              </div>
              <div className="mt-1.5 flex items-end gap-1.5">
                {value === null && !error && !unavailable ? (
                  <span aria-label="불러오는 중" className="h-7 w-12 rounded bg-muted motion-safe:animate-pulse" />
                ) : (
                  <span className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
                    {error ? <span className="text-xs font-normal text-destructive">확인 필요</span> : value ?? "—"}
                  </span>
                )}
                {!error && value !== null && <span className="pb-0.5 text-[11px] text-[#4F5D68]">개</span>}
              </div>
              <span className="mt-auto pt-1.5 text-[11px] text-[#4F5D68]">
                {stage.description}
                {stage.key === "rules" && rulesFailCount > 0 && ` · 불통과 ${rulesFailCount}`}
              </span>
            </Link>
            {stage.step < REVIEW_STAGE_ITEMS.length && (
              <ArrowRight aria-hidden className="absolute -right-[26px] top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#81909A] xl:block" />
            )}
          </div>
        );
      };
      const optional = REVIEW_STAGE_ITEMS.filter((stage) => stage.optional);
      const firstOptional = REVIEW_STAGE_ITEMS.findIndex((stage) => stage.optional);
      return (
        <>
          {REVIEW_STAGE_ITEMS.slice(0, firstOptional).map(renderStage)}
          {/* 선택 단계(3·4)는 한 틀로 묶는다 — 모든 미션이 거치는 기본 경로가 아니라는 것을 글이 아니라 모양으로 보인다. */}
          <div
            role="group"
            aria-label="정밀 검토"
            className="relative -mb-[7px] -mt-3 grid grid-cols-1 gap-2.5 rounded-xl border border-dashed border-[#B3AA94] bg-[#F3F0E7] px-1.5 pb-1.5 pt-[11px] sm:col-span-2 sm:grid-cols-2"
          >
            <span className="absolute -top-2 left-3 rounded bg-background px-1.5 text-[10.5px] font-semibold leading-4 tracking-[0.02em] text-[#5A6670]">
              정밀 검토
            </span>
            {optional.map(renderStage)}
          </div>
          {REVIEW_STAGE_ITEMS.slice(firstOptional + optional.length).map(renderStage)}
        </>
      );
    })()}
  </div>
  </div>
);

const OperationMetric = ({
  to,
  label,
  value,
  unit,
  description,
  error,
  changed = false,
  title,
}: {
  to: string;
  label: string;
  value: number | null;
  unit: string;
  description: string;
  error: string | null;
  changed?: boolean;
  /** 운영 점검용 2차 정보. 메인 문구에 두지 않고 마우스를 올릴 때만 보인다. */
  title?: string;
}) => (
  <Link
    to={to}
    title={title}
    className={[
      "group flex min-h-[78px] flex-col rounded-xl border bg-white px-4 py-2.5",
      "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E8063]",
      changed ? "border-[#75A488] bg-[#F3FAF5] ring-2 ring-[#8FC7A4]/30" : "border-[#E6E1D5]",
    ].join(" ")}
  >
    <span className="text-xs font-medium text-[#4F5D68] group-hover:text-[#273B4A]">{label}</span>
    {value === null && !error ? (
      <span aria-label="불러오는 중" className="mt-1.5 h-7 w-16 rounded bg-muted motion-safe:animate-pulse" />
    ) : (
      <span className="mt-1.5 flex items-end gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
          {error ? <span className="text-sm font-normal text-destructive">확인 필요</span> : value}
        </span>
        {!error && value !== null && <span className="pb-0.5 text-[11px] text-[#4F5D68]">{unit}</span>}
      </span>
    )}
    <span className="mt-auto pt-1.5 text-[11px] leading-4 text-[#4F5D68]">{description}</span>
  </Link>
);

const LiveDatabaseStatus = ({ delayed, announce = false }: { delayed: boolean; announce?: boolean }) => (
  <span
    aria-live={announce ? "polite" : undefined}
    className={[
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
      delayed
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
    ].join(" ")}
  >
    <span className="relative flex h-2 w-2" aria-hidden>
      {!delayed && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 motion-safe:animate-ping" />}
      <span className={["relative inline-flex h-2 w-2 rounded-full", delayed ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
    </span>
    {delayed ? "갱신 지연" : "최근 조회"}
  </span>
);

const DASHBOARD_PAGE_SIZE = 1000;

async function fetchAllDashboardRows<T>(
  label: string,
  queryPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= DASHBOARD_ROW_CAP; from += DASHBOARD_PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + DASHBOARD_PAGE_SIZE - 1);
    if (error) throw new Error(`${label} 집계 실패: ${error.message}`);
    const page = (data ?? []) as T[];
    if (from === DASHBOARD_ROW_CAP && page.length > 0) {
      throw new Error(`${label} 집계가 안전 조회 상한 ${DASHBOARD_ROW_CAP}건을 초과했습니다.`);
    }
    rows.push(...page);
    if (page.length < DASHBOARD_PAGE_SIZE) return rows;
  }
  return rows;
}

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [changedKeys, setChangedKeys] = useState<Set<DashboardMetricKey>>(() => new Set());
  const mountedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const previousMetricsRef = useRef<Record<DashboardMetricKey, number> | null>(null);
  const changeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.rpc("is_admin");
      if (active) setIsAdmin(Boolean(data));
    })();

    return () => {
      active = false;
    };
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const [allScenarioRows, reviewRows, cumulativeRows, assignmentRows, courseRows, learnerResult, learnerRecordResult, courseLinkedResult] = await Promise.all([
        fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
          .from("scenarios")
          .select(DASHBOARD_SCENARIO_SELECT)
          .eq("content_format", "scenario_core_v1")
          .is("archived_at", null)
          .order("scenario_id", { ascending: true })
          .range(from, to)),
        fetchAllDashboardRows<DashboardReviewRunRow>("점검·승인 이력", (from, to) => db
          .from("content_review_runs")
          .select(DASHBOARD_REVIEW_RUN_SELECT)
          .eq("kind", "mission")
          .eq("criteria_version", DASHBOARD_REVIEW_CRITERIA_VERSION)
          // Counts describe the current review of each mission; a row replaced by a gate rebind is history.
          .is("superseded_by", null)
          .order("created_at", { ascending: false })
          .range(from, to)),
        // 누적 완료는 기준 버전·재결합 이력까지 모든 mission run에서 미션 단위로 센다. 실패해도 대기열은 보여야 해서 null로 받는다.
        fetchAllDashboardRows<DashboardCumulativeRunRow>("검수 누적 이력", (from, to) => db
          .from("content_review_runs")
          .select(DASHBOARD_CUMULATIVE_RUN_SELECT)
          .eq("kind", "mission")
          .order("created_at", { ascending: true })
          .range(from, to)).catch((cause: unknown) => {
            console.error("[dashboard] cumulative review counts failed:", cause);
            return null;
          }),
        fetchAllDashboardRows<DashboardAssignmentRow>("수업 편성", (from, to) => db
          .from("curriculum_week_scenarios")
          .select("outline_id,week_no,scenario_id")
          .order("outline_id", { ascending: true })
          .order("week_no", { ascending: true })
          .order("scenario_id", { ascending: true })
          .range(from, to)),
        fetchAllDashboardRows<DashboardCourseRow>("교과목", (from, to) => db
          .from("curriculum_outlines")
          .select("status")
          .order("id", { ascending: true })
          .range(from, to)),
        db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "learner").eq("approval_status", "approved"),
        db.from("learner_mission_logs").select("id", { count: "exact", head: true }),
        db.from("learner_mission_logs").select("id", { count: "exact", head: true }).not("course_id", "is", null),
      ]);

      const scenarioRows = excludeSupersededRows(allScenarioRows);

      const results = [
        ["승인 학습자", learnerResult],
        ["학습 수행", learnerRecordResult],
      ] as const;
      for (const [label, result] of results) {
        if (result.error) throw new Error(`${label} 집계 실패: ${result.error.message}`);
      }

      // v5 미션은 검수하지 않고 v6로 전환한다 — 검수 대기열·단계별 대기는 v6만 센다(점검·승인 화면과 같은 기준).
      const v5ReviewTarget = (row: DashboardScenarioRow) => isDashboardReviewTarget(row) && row.mission_schema_version !== "mission_v6";
      const reviewScopeRows = scenarioRows.filter((row) => !v5ReviewTarget(row));
      const content = summarizeDashboardContent(scenarioRows);
      const review = summarizeDashboardReviewStages(reviewScopeRows, reviewRows);
      const next: DashboardSnapshot = {
        resources: summarizeDashboardResources(scenarioRows),
        content: { ...content, reviewTargetCount: content.reviewTargetCount - scenarioRows.filter(v5ReviewTarget).length },
        review,
        assignments: summarizeDashboardAssignments(assignmentRows),
        assignmentApproval: summarizeAssignmentApproval(assignmentRows, scenarioRows),
        courses: summarizeCourses(courseRows),
        rulesFailCount: countRulesFailures(reviewScopeRows, reviewRows),
        approvedLearnerCount: learnerResult.count ?? 0,
        learnerRecordCount: learnerRecordResult.count ?? 0,
        cumulative: cumulativeRows ? summarizeCumulativeReviewCompletion(scenarioRows, cumulativeRows) : null,
        courseLinkedRecordCount: courseLinkedResult.error ? null : courseLinkedResult.count ?? 0,
      };
      if (!mountedRef.current) return;

      const nextMetrics = dashboardMetricValues(next);
      const previous = previousMetricsRef.current;
      if (previous) {
        const changed = new Set(
          (Object.keys(nextMetrics) as DashboardMetricKey[]).filter(
            (key) => previous[key] !== nextMetrics[key],
          ),
        );
        setChangedKeys(changed);
        if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
        if (changed.size > 0) {
          changeTimerRef.current = window.setTimeout(() => setChangedKeys(new Set()), 900);
        }
      }
      previousMetricsRef.current = nextMetrics;
      setSnapshot(next);
      setDashboardError(null);
    } catch (cause) {
      console.error("[dashboard] metrics failed:", cause);
      if (mountedRef.current) {
        setDashboardError(cause instanceof Error ? cause.message : "대시보드 조회 실패");
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshDashboard();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDashboard();
    }, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshDashboard();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    };
  }, [refreshDashboard]);

  const dominantReviewStage = useMemo(
    () => snapshot ? dominantDashboardReviewStage(snapshot.review) : null,
    [snapshot],
  );
  const displayError = snapshot ? null : dashboardError;
  // 지표 묶음마다 제목 옆에 붙인다. 알림 영역은 첫 묶음 하나만 두어 보조기기가 같은 말을 세 번 읽지 않게 한다.
  const liveStatus = (announce = false) => <LiveDatabaseStatus delayed={Boolean(dashboardError)} announce={announce} />;

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({ profile_completed: false })
        .eq("user_id", uid)
        .select("user_id, profile_completed");
      if (error) throw error;
      console.log("[reset-profile] updated rows:", data);
      toast.success("초기화됨. 로그아웃 후 다시 로그인하면 프로필 설정부터 시작합니다.");
      window.dispatchEvent(new Event("profile-changed"));
    } catch (cause) {
      console.error("[reset-profile] failed:", cause);
      toast.error(`초기화 실패: ${(cause as Error).message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminShell
      title="PRAGMA 대시보드"
      hideTitle
    >
      {displayError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          운영 지표를 처음 불러오지 못했습니다. {displayError}
        </p>
      )}

      <DashboardResourceOverview resources={snapshot?.resources ?? null} error={displayError} status={liveStatus(true)} />

      {/* 단계마다 그 단계를 마친 서로 다른 미션 수(누적). 3·4는 선택 단계라 점선이다. */}
      <PanelHeader
        title="검수 단계별 현황"
        action={liveStatus()}
      />
      <ReviewPipeline
        review={snapshot?.review ?? null}
        cumulative={snapshot?.cumulative ?? null}
        professorFinalized={snapshot?.content.professorFinalizedCount ?? null}
        dominant={dominantReviewStage}
        rulesFailCount={snapshot?.rulesFailCount ?? 0}
        error={displayError}
        changedKeys={changedKeys}
      />

      <PanelHeader title="수업 운영·학습 수행 현황" action={liveStatus()} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 교과목이 최상위 단위다 — 주차·미션 배정도, 백업도, 학습자 진입도 여기서 갈린다.
            운영에서 중요한 축은 만든 수보다 「학습자에게 공개했는가」다. */}
        <OperationMetric
          to="/admin/composer"
          label="교과목"
          value={snapshot?.courses.total ?? null}
          unit="개"
          description={snapshot ? `공개 ${snapshot.courses.published}개 · 비공개 ${snapshot.courses.unpublished}개` : "15주 수업의 단위"}
          error={displayError}
          changed={changedKeys.has("courses")}
        />
        {/* 큰 수 = 배정 건수(운영 단위). 승인 전 미션이 섞여 있으면 게이트 이전의 옛 편성이다 —
            새 편성은 승인·현행 릴리스 미션으로 제한된다. 학습자 노출은 승인 외 조건도 있어 여기서 판정하지 않는다. */}
        <OperationMetric
          to="/admin/composer"
          // 주차를 큰 수로 둔다(편성 건수는 수업 편성 화면에서 본다).
          label="편성 주차"
          value={snapshot?.assignments.weekCount ?? null}
          unit="개"
          description={snapshot ? `교과목 ${snapshot.assignments.courseCount}개에 배치` : "교과목 주차에 놓인 미션"}
          error={displayError}
          changed={changedKeys.has("assignments")}
          title={snapshot && snapshot.assignmentApproval.unapprovedMissionCount > 0
            ? `승인 전 미션 ${snapshot.assignmentApproval.unapprovedMissionCount}개 포함(게이트 이전 편성)`
            : undefined}
        />
        {/* 계정 이용 승인이지 교과목별 수강 등록이 아니다 — 「수강생」으로 부르지 않는다. */}
        <OperationMetric
          to="/admin/learners"
          label="승인 학습자 계정"
          value={snapshot?.approvedLearnerCount ?? null}
          unit="개"
          description="전체 교과목 공통"
          error={displayError}
          changed={changedKeys.has("learners")}
        />
        {/* 표 전체 행 수다 — 계정 역할·기간으로 거르지 않는다. 시험 기록과 실제 학습을 나누려면
            시험 계정 식별 근거가 먼저 있어야 한다(논문 3.1.4·5.4.2). */}
        <OperationMetric
          to="/admin/decision-traces"
          // 교과목 맥락에서 나온 기록을 큰 수로 둔다
          // (실제 수업 기록과 시범 수행을 가르는 유일한 단서 — 교과목 맥락 없는 실행은 연결되지 않는다).
          label="교과목 수업 기록"
          value={snapshot?.courseLinkedRecordCount ?? null}
          unit="건"
          description={snapshot && snapshot.courseLinkedRecordCount !== null
            ? `시범 수행 ${snapshot.learnerRecordCount - snapshot.courseLinkedRecordCount}건 별도`
            : "교과목에 연결된 수행"}
          error={displayError ?? (snapshot && snapshot.courseLinkedRecordCount === null ? "교과목 연결 조회 실패" : null)}
          changed={changedKeys.has("records")}
        />
      </div>

      {/* 운영 수치가 아니라 연동 점검이라 맨 아래 둔다. */}
      <div className="mt-8">
        <ServiceHealthPanel />
      </div>

      {/* 내 프로필을 미완료로 되돌리는 시험용 조작이라 운영 화면에서는 감춘다. */}
      {isAdmin && IS_DEV && (
        <div className="mt-4 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="border-[#D9CB8F] bg-[#FBF6E1] text-xs font-semibold text-[#6B5A1E] hover:border-[#C5B05F] hover:bg-[#F6ECC0] hover:text-[#4F4213]" disabled={resetting}>프로필 초기화 테스트</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>내 프로필을 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>내 프로필을 미완료 상태로 되돌립니다. 다음 로그인 때 프로필 설정 화면부터 다시 시작합니다. 계속할까요?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>계속</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminDashboard;
