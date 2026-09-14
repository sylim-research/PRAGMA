import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { ServiceHealthPanel } from "@/components/admin/ServiceHealthPanel";
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
  summarizeAssignmentApproval,
  summarizeCourses,
  type DashboardCourseRow,
  DASHBOARD_REVIEW_RUN_SELECT,
} from "@/lib/admin/adminDashboardMetrics";
import { CONTENT_REVIEW_STEPS } from "../../../supabase/functions/_shared/contentReview";
import { toast } from "sonner";

// content_review_runs는 2026-08-27 migration 이후 생성 타입을 아직 재발행하지 않았다.
// 이 화면의 예외는 조회 전용이며 선택 컬럼을 DashboardReviewRunRow로 즉시 좁힌다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

type DashboardSnapshot = {
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
  <div className="mb-2.5 mt-8">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1B2A36]">{title}</h2>
      {action}
    </div>
    {description && <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>}
  </div>
);

// 용어대장 기준: 규칙은 「검사」, AI는 「검토」(의견 제시, 판정 아님), 뒤따르는 AI는 「재검토」,
// 교수자는 「최종 승인」. 「지적」은 산출물 이름으로 쓰지 않고 「판정」은 연구자 몫이라 여기 쓰지 않는다.
// 숫자 옆에는 행위가 아니라 상태(「~ 대기」)가 보여야 한다. 누가 무엇을 검토하는지도 이름에 둔다
// (논문 4.3.3, focused_v1: 규칙 검사 → AI 검토(저장된 생성 품질점검 재사용) → 선택 시에만 Claude 독립 검토 → Claude 의견이 있을 때만 OpenAI 재검토 → 교수자 최종 승인).
const REVIEW_STAGE_DISPLAY_LABELS: Record<DashboardReviewQueueStage, string> = {
  rules: "규칙 검사 대기",
  openai: "AI 검토 대기",
  claude: "AI 독립 검토 대기",
  adjudication: "AI 재검토 대기",
  // 품질 점검 화면의 「교수자 승인 대기」 칩과 같은 집합이라 같은 이름을 쓴다.
  professor: "교수자 승인 대기",
};

// 1~4단계는 품질 점검 화면이, 5단계는 교수자 최종 승인 화면이 처리한다.
const REVIEW_STAGE_ROUTE = (stage: DashboardReviewQueueStage) => (stage === "professor" ? "/admin/review" : "/admin/ai-review");

// 카드 폭 안에서 한 줄. 무엇을 하는지만 남기고 방법은 뺀다.
const REVIEW_STAGE_DESCRIPTIONS: Record<DashboardReviewQueueStage, string> = {
  rules: "규칙 위반 확인",
  openai: "내용 검토 · 기존 결과 재사용",
  claude: "선택 시에만 · 독립 검토",
  adjudication: "선택 시에만 · 독립 검토 의견 재검토",
  professor: "감수 뒤 승인·보류·수정 결정",
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
  dominant,
  rulesFailCount,
  error,
  changedKeys,
}: {
  review: DashboardReviewStageCounts | null;
  dominant: DashboardReviewQueueStage | null;
  rulesFailCount: number;
  error: string | null;
  changedKeys: ReadonlySet<DashboardMetricKey>;
}) => (
  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {REVIEW_STAGE_ITEMS.map((stage) => {
        const value = review?.[stage.key] ?? null;
        const active = dominant === stage.key;
        const changed = changedKeys.has(`review.${stage.key}`);
        return (
          <div key={stage.key} className="relative min-w-0">
            {/* 강조색은 위 「지금 할 일」에만 쓴다. 단계 카드는 중립색으로 두고 가장 많이 쌓인 단계만 표시해 둔다. */}
            <Link
              to={REVIEW_STAGE_ROUTE(stage.key)}
              className={[
                "group flex min-h-[72px] flex-col rounded-lg border bg-white px-3 py-2.5",
                "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
                stage.key === "professor" ? "border-[#D9CB8F]" : "border-[#E6E1D5]",
                stage.optional ? "border-dashed" : "",
                changed ? "ring-2 ring-[#F4D85E]/35" : "",
              ].join(" ")}
              data-optional={stage.optional ? "true" : undefined}
              data-dominant={active ? "true" : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF1F2] text-[10px] font-semibold tabular-nums text-[#63727C]">
                  {stage.step}
                </span>
                <span className="text-xs font-semibold leading-4 text-[#3F4E59]">{stage.displayLabel}</span>
              </div>
              <div className="mt-1.5 flex items-end gap-1.5">
                {value === null && !error ? (
                  <span aria-label="불러오는 중" className="h-7 w-12 rounded bg-muted motion-safe:animate-pulse" />
                ) : (
                  <span className="text-[22px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
                    {error ? <span className="text-xs font-normal text-destructive">확인 필요</span> : value}
                  </span>
                )}
                {!error && value !== null && <span className="pb-0.5 text-[11px] text-muted-foreground">개</span>}
              </div>
              <span className="mt-auto pt-1.5 text-[11px] text-muted-foreground">
                {stage.description}
                {stage.key === "rules" && rulesFailCount > 0 && ` · 실패 ${rulesFailCount}`}
              </span>
            </Link>
            {stage.step < REVIEW_STAGE_ITEMS.length && (
              <ArrowRight aria-hidden className="absolute -right-[26px] top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#81909A] xl:block" />
            )}
          </div>
        );
      })}
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
}: {
  to: string;
  label: string;
  value: number | null;
  unit: string;
  description: string;
  error: string | null;
  changed?: boolean;
}) => (
  <Link
    to={to}
    className={[
      "group flex min-h-[72px] flex-col rounded-lg border bg-white px-3 py-2.5",
      "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E8063]",
      changed ? "border-[#75A488] bg-[#F3FAF5] ring-2 ring-[#8FC7A4]/30" : "border-[#E6E1D5]",
    ].join(" ")}
  >
    <span className="text-xs font-medium text-muted-foreground group-hover:text-[#273B4A]">{label}</span>
    {value === null && !error ? (
      <span aria-label="불러오는 중" className="mt-1.5 h-7 w-16 rounded bg-muted motion-safe:animate-pulse" />
    ) : (
      <span className="mt-1.5 flex items-end gap-1.5">
        <span className="text-[22px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
          {error ? <span className="text-sm font-normal text-destructive">확인 필요</span> : value}
        </span>
        {!error && value !== null && <span className="pb-0.5 text-[11px] text-muted-foreground">{unit}</span>}
      </span>
    )}
    <span className="mt-auto pt-1.5 text-[11px] leading-4 text-muted-foreground">{description}</span>
  </Link>
);

const LiveDatabaseStatus = ({ delayed }: { delayed: boolean }) => (
  <span
    aria-live="polite"
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
    {delayed ? "갱신 지연" : "DB 실시간"}
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
      const [scenarioRows, reviewRows, assignmentRows, courseRows, learnerResult, learnerRecordResult] = await Promise.all([
        fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
          .from("scenarios")
          .select("scenario_id,content_format,review_status,mission_status,updated_at,mission_schema_version:mission_content->>schema_version,authoring_stage:mission_content->authoring->>stage")
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
        db.from("profiles").select("id", { count: "exact" }).eq("role", "learner").eq("approval_status", "approved").limit(1),
        db.from("learner_mission_logs").select("id", { count: "exact" }).limit(1),
      ]);

      const results = [
        ["승인 학습자", learnerResult],
        ["학습 수행", learnerRecordResult],
      ] as const;
      for (const [label, result] of results) {
        if (result.error) throw new Error(`${label} 집계 실패: ${result.error.message}`);
      }

      const next: DashboardSnapshot = {
        content: summarizeDashboardContent(scenarioRows),
        review: summarizeDashboardReviewStages(scenarioRows, reviewRows),
        assignments: summarizeDashboardAssignments(assignmentRows),
        assignmentApproval: summarizeAssignmentApproval(assignmentRows, scenarioRows),
        courses: summarizeCourses(courseRows),
        rulesFailCount: countRulesFailures(scenarioRows, reviewRows),
        approvedLearnerCount: learnerResult.count ?? 0,
        learnerRecordCount: learnerRecordResult.count ?? 0,
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
  // 품질 점검 화면의 「점검 필요」와 같은 집합: 교수자 차례가 아닌 미션 중 규칙 오류를 뺀 것.
  const needsCheckCount = snapshot
    ? snapshot.review.rules + snapshot.review.openai + snapshot.review.claude + snapshot.review.adjudication - snapshot.rulesFailCount
    : null;

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
      title="PRAGMA 운영 워크플로우"
    >
      {displayError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          운영 지표를 처음 불러오지 못했습니다. {displayError}
        </p>
      )}

      {/* 연동이 끊겨 있으면 아래 지표를 보기 전에 알아야 한다 — 스크롤 없이 보이는 자리에 둔다.
          평소에는 한 줄로 접혀 있고, 정상이 아닌 항목이 있으면 스스로 펼쳐진다.
          이 라우트는 RequireAdmin이 이미 막고, 조회 함수도 is_admin()으로 다시 막는다. */}
      {/* 사이드바에 흩어진 화면들이 실제로는 하나의 흐름이다. 그 흐름을 한 줄로 두되
          구간마다 지금의 수를 달아 둔다 — 정적 도식이면 이틀 만에 눈이 지나친다.
          숫자는 전부 기존 snapshot 필드이고 새로 계산하는 것이 없다. */}
      <div className="mb-3 flex justify-end"><LiveDatabaseStatus delayed={Boolean(dashboardError)} /></div>

      {/* 첫 화면의 주인공은 지금 교수자를 기다리는 일이다. 수는 품질 점검·최종 승인 화면과 같은 검수 단계 판정으로 센다.
          이 화면에서 승인하지 않고, 결정은 교수자 최종 승인 화면에서 한다. */}
      <section aria-label="지금 할 일" className="rounded-2xl bg-[#15202B] px-6 py-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#FAD338]">지금 할 일</p>
            <p className="mt-1.5 text-[24px] font-bold leading-tight">
              교수자 승인 대기{" "}
              <span className="tabular-nums">{displayError ? "—" : snapshot?.review.professor ?? "—"}</span>개
            </p>
            <p className="mt-1 text-[13px] text-[#B9C3CA]">품질 점검을 마친 미션입니다. 감수한 뒤 승인·보류·수정을 결정합니다.</p>
          </div>
          <Button asChild className="h-10 bg-[#FAD338] px-5 text-[14px] font-semibold text-[#15202B] hover:bg-[#F2C71E]">
            <Link to="/admin/review">결정하러 가기 →</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-[13px] text-[#B9C3CA]">
          <span>점검 필요 <b className="font-semibold tabular-nums text-white">{displayError ? "—" : needsCheckCount ?? "—"}</b>개</span>
          <span>규칙 오류 <b className="font-semibold tabular-nums text-white">{displayError ? "—" : snapshot?.rulesFailCount ?? "—"}</b>개</span>
          <Link to="/admin/ai-review" className="ml-auto font-medium text-white underline-offset-4 hover:underline">품질 점검 화면 →</Link>
        </div>
      </section>

      {/* 흐름 전체의 누적 수. 참고용이라 할 일보다 조용하게 둔다. 숫자는 전부 기존 snapshot 필드다. */}
      <PanelHeader title="전체 흐름" description="단계별 누적 수입니다. 눌러서 해당 화면으로 이동합니다." />
      <section className="overflow-hidden rounded-xl border border-[#E6E1D5] bg-white">
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { to: "/admin/library", stage: "시나리오 재료", screen: "라이브러리", value: snapshot?.content.coreCount },
            { to: "/admin/assembly", stage: "학습 미션", screen: "조립", value: snapshot?.content.generatedMissionCount },
            { to: "/admin/ai-review", stage: "승인 전 미션", screen: "품질 점검", value: snapshot?.content.reviewTargetCount },
            // 누적 완료 수다. 할 일(대기)로 읽히지 않도록 「승인 완료」라고 부른다.
            { to: "/admin/review", stage: "교수자 승인 완료", screen: "최종 승인", value: snapshot?.content.professorFinalizedCount },
            { to: "/admin/composer", stage: "미션 배정", screen: "15주 편성", value: snapshot?.assignments.assignmentCount },
            { to: "/admin/decision-traces", stage: "학습 수행", screen: "수행 기록", value: snapshot?.learnerRecordCount },
          ].map((step, index) => (
            <li key={step.to} className={index > 0 ? "border-t border-[#EFEBE1] sm:border-t-0 sm:border-l" : ""}>
              <Link to={step.to} className="flex h-full flex-col px-4 py-3 hover:bg-[#FBFAF6]">
                <span className="text-[12px] font-medium text-[#6B7780]">{step.stage}</span>
                {step.value == null && !displayError ? (
                  <span aria-label="불러오는 중" className="mt-1.5 h-6 w-12 rounded bg-muted motion-safe:animate-pulse" />
                ) : (
                  <span className="mt-1 text-[20px] font-semibold leading-none tabular-nums text-[#2B3A45]">
                    {displayError ? "—" : step.value}
                  </span>
                )}
                <span className="mt-auto pt-1.5 text-[11.5px] text-[#9AA3A9]">{step.screen} →</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 「승인 전 미션」을 다음 처리 단계별로 쪼갠 것 — 완료 실적이 아니라 지금 어디서 기다리는가. */}
      <PanelHeader
        title={snapshot ? `검수 단계별 현황 — 승인 전 ${snapshot.content.reviewTargetCount}개` : "검수 단계별 현황"}
        description="각 미션을 다음에 처리할 단계 하나에만 셉니다. 1~4단계는 품질 점검, 5단계는 최종 승인 화면에서 처리합니다."
      />
      <ReviewPipeline
        review={snapshot?.review ?? null}
        dominant={dominantReviewStage}
        rulesFailCount={snapshot?.rulesFailCount ?? 0}
        error={displayError}
        changedKeys={changedKeys}
      />

      <PanelHeader title="수업 운영·학습 수행 현황" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
          label="미션 배정"
          value={snapshot?.assignments.assignmentCount ?? null}
          unit="건"
          description={
            snapshot
              ? `미션 ${snapshot.assignments.missionCount}개(승인 ${snapshot.assignmentApproval.approvedMissionCount}) · 주차 ${snapshot.assignments.weekCount}개`
              : "교과목 주차에 놓인 미션"
          }
          error={displayError}
          changed={changedKeys.has("assignments")}
        />
        {/* 계정 이용 승인이지 교과목별 수강 등록이 아니다 — 「수강생」으로 부르지 않는다. */}
        <OperationMetric
          to="/admin/learners"
          label="승인 학습자"
          value={snapshot?.approvedLearnerCount ?? null}
          unit="명"
          description="계정 승인 · 전체 교과목 공통"
          error={displayError}
          changed={changedKeys.has("learners")}
        />
        {/* 표 전체 행 수다 — 계정 역할·기간으로 거르지 않는다. 시험 기록과 실제 학습을 나누려면
            시험 계정 식별 근거가 먼저 있어야 한다(논문 3.1.4·5.4.2). */}
        <OperationMetric
          to="/admin/decision-traces"
          label="미션 수행 기록"
          value={snapshot?.learnerRecordCount ?? null}
          unit="건"
          description="전체 계정·기간 누적 · 1회 수행 = 1건"
          error={displayError}
          changed={changedKeys.has("records")}
        />
      </div>

      {/* 정상일 때는 한 줄로 접혀 있고 이상이 있으면 스스로 펼쳐진다 — 그 성질에 맞게 맨 아래 둔다. */}
      <div className="mt-3">
        <ServiceHealthPanel />
      </div>

      {/* 내 프로필을 미완료로 되돌리는 시험용 조작이라 운영 화면에서는 감춘다. */}
      {isAdmin && IS_DEV && (
        <div className="mt-4 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={resetting}>프로필 초기화 테스트</Button></AlertDialogTrigger>
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
