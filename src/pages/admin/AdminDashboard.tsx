import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
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
  approvedLearnerCount: number;
  learnerRecordCount: number;
};

type DashboardMetricKey =
  | "core"
  | "mission"
  | "reviewTarget"
  | "finalized"
  | `review.${DashboardReviewQueueStage}`
  | "assignments"
  | "learners"
  | "records";

function dashboardMetricValues(snapshot: DashboardSnapshot): Record<DashboardMetricKey, number> {
  return {
    core: snapshot.content.coreCount,
    mission: snapshot.content.generatedMissionCount,
    reviewTarget: snapshot.content.reviewTargetCount,
    finalized: snapshot.content.professorFinalizedCount,
    "review.rules": snapshot.review.rules,
    "review.openai": snapshot.review.openai,
    "review.claude": snapshot.review.claude,
    "review.adjudication": snapshot.review.adjudication,
    "review.professor": snapshot.review.professor,
    assignments: snapshot.assignments.missionCount,
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
  <div className="mb-2 mt-7 rounded-r-md border-l-4 border-[#D6BE42] bg-[#F3F0E5] px-3 py-1.5">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1B2A36]">{title}</h2>
      {action}
    </div>
    {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
  </div>
);

const SummaryMetric = ({
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
      "group flex min-h-[98px] flex-col rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(21,32,43,0.04)]",
      "motion-safe:transition-all motion-safe:duration-200 hover:border-[#C9B54E] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
      changed ? "border-[#D6B84A] bg-[#FFFBE8] ring-2 ring-[#F4D85E]/30" : "border-border",
    ].join(" ")}
  >
    <span className="text-xs font-medium text-muted-foreground group-hover:text-[#273B4A]">{label}</span>
    <div className="mt-1.5 flex items-end gap-1.5">
      {value === null && !error ? (
        <span aria-label="불러오는 중" className="h-7 w-14 rounded bg-muted motion-safe:animate-pulse" />
      ) : (
        <span className="text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
          {error ? <span className="text-sm font-normal text-destructive">확인 필요</span> : value}
        </span>
      )}
      {!error && value !== null && <span className="pb-0.5 text-[11px] text-muted-foreground">{unit}</span>}
    </div>
    <span className="mt-auto pt-1.5 text-[11px] leading-4 text-muted-foreground">{description}</span>
  </Link>
);

const REVIEW_STAGE_DISPLAY_LABELS: Record<DashboardReviewQueueStage, string> = {
  rules: "규칙 기반 점검",
  openai: "AI 1차 검토",
  claude: "AI 교차 검토",
  adjudication: "검토 결과 정리",
  professor: "교수자 최종 승인",
};

const REVIEW_STAGE_DESCRIPTIONS: Record<DashboardReviewQueueStage, string> = {
  rules: "자동 규칙 점검 필요",
  openai: "1차 검토 대기",
  claude: "독립 교차검토 대기",
  adjudication: "지적별 판정 대기",
  professor: "최종 승인 대기",
};

const REVIEW_STAGE_ITEMS = CONTENT_REVIEW_STEPS.map((stage, index) => ({
  ...stage,
  step: index + 1,
  displayLabel: REVIEW_STAGE_DISPLAY_LABELS[stage.key],
  description: REVIEW_STAGE_DESCRIPTIONS[stage.key],
}));

const ReviewPipeline = ({
  review,
  dominant,
  error,
  changedKeys,
}: {
  review: DashboardReviewStageCounts | null;
  dominant: DashboardReviewQueueStage | null;
  error: string | null;
  changedKeys: ReadonlySet<DashboardMetricKey>;
}) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-8">
      {REVIEW_STAGE_ITEMS.map((stage) => {
        const value = review?.[stage.key] ?? null;
        const active = dominant === stage.key;
        const changed = changedKeys.has(`review.${stage.key}`);
        return (
          <div key={stage.key} className="relative min-w-0">
            <Link
              to="/admin/review"
              className={[
                "group flex min-h-[98px] flex-col rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(21,32,43,0.04)]",
                "motion-safe:transition-all motion-safe:duration-200 hover:border-[#C9B54E] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
                active ? "border-[#D6B84A] bg-[#FFFBE8]" : "border-border",
                changed ? "ring-2 ring-[#F4D85E]/35" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className={[
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums",
                  active ? "bg-[#F1D54A] text-[#293641]" : "bg-[#EEF1F2] text-[#63727C]",
                ].join(" ")}>
                  {stage.step}
                </span>
                <span className="text-xs font-semibold leading-4 text-[#3F4E59]">{stage.displayLabel}</span>
              </div>
              <div className="mt-1.5 flex items-end gap-1.5">
                {value === null && !error ? (
                  <span aria-label="불러오는 중" className="h-7 w-12 rounded bg-muted motion-safe:animate-pulse" />
                ) : (
                  <span className="text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
                    {error ? <span className="text-xs font-normal text-destructive">확인 필요</span> : value}
                  </span>
                )}
                {!error && value !== null && <span className="pb-0.5 text-[11px] text-muted-foreground">개</span>}
              </div>
              <span className="mt-auto pt-1.5 text-[11px] text-muted-foreground">{stage.description}</span>
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
      "group flex min-h-[98px] flex-col rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(21,32,43,0.04)]",
      "motion-safe:transition-all motion-safe:duration-200 hover:border-[#789184] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E8063]",
      changed ? "border-[#75A488] bg-[#F3FAF5] ring-2 ring-[#8FC7A4]/30" : "border-border",
    ].join(" ")}
  >
    <span className="text-xs font-medium text-muted-foreground group-hover:text-[#273B4A]">{label}</span>
    {value === null && !error ? (
      <span aria-label="불러오는 중" className="mt-1.5 h-7 w-16 rounded bg-muted motion-safe:animate-pulse" />
    ) : (
      <span className="mt-1.5 flex items-end gap-1.5">
        <span className="text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
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
      const [scenarioRows, reviewRows, assignmentRows, learnerResult, learnerRecordResult] = await Promise.all([
        fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
          .from("scenarios")
          .select("scenario_id,content_format,review_status,mission_status,updated_at,mission_schema_version:mission_content->>schema_version,authoring_stage:mission_content->authoring->>stage")
          .eq("content_format", "scenario_core_v1")
          .order("scenario_id", { ascending: true })
          .range(from, to)),
        fetchAllDashboardRows<DashboardReviewRunRow>("검수 이력", (from, to) => db
          .from("content_review_runs")
          .select("target_id,kind,criteria_version,rules_verdict:rules->>verdict,openai_response_id:openai_review->>response_id,claude_response_id:claude_review->>response_id,adjudication_response_id:adjudication->>response_id,created_at")
          .eq("kind", "mission")
          .eq("criteria_version", DASHBOARD_REVIEW_CRITERIA_VERSION)
          .order("created_at", { ascending: false })
          .range(from, to)),
        fetchAllDashboardRows<DashboardAssignmentRow>("수업 편성", (from, to) => db
          .from("curriculum_week_scenarios")
          .select("outline_id,week_no,scenario_id")
          .order("outline_id", { ascending: true })
          .order("week_no", { ascending: true })
          .order("scenario_id", { ascending: true })
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
      title="운영 대시보드"
      description="콘텐츠 준비, 검수, 수업 현황을 한눈에 확인합니다."
    >
      {displayError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          운영 지표를 처음 불러오지 못했습니다. {displayError}
        </p>
      )}

      <PanelHeader
        title="콘텐츠 준비 현황"
        action={<LiveDatabaseStatus delayed={Boolean(dashboardError)} />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          to="/admin/library"
          label="시나리오 원안"
          value={snapshot?.content.coreCount ?? null}
          unit="개"
          description="학습 미션 제작의 기본 자료"
          error={displayError}
          changed={changedKeys.has("core")}
        />
        <SummaryMetric
          to="/admin/assembly"
          label="학습 미션 생성 완료"
          value={snapshot?.content.generatedMissionCount ?? null}
          unit="개"
          description="생성·저장된 학습 미션"
          error={displayError}
          changed={changedKeys.has("mission")}
        />
        <SummaryMetric
          to="/admin/review"
          label="검수 대기 미션"
          value={snapshot?.content.reviewTargetCount ?? null}
          unit="개"
          description="콘텐츠 검수 진행 대상"
          error={displayError}
          changed={changedKeys.has("reviewTarget")}
        />
        <SummaryMetric
          to="/admin/review"
          label="교수자 승인 완료"
          value={snapshot?.content.professorFinalizedCount ?? null}
          unit="개"
          description="수업 사용 최종 승인"
          error={displayError}
          changed={changedKeys.has("finalized")}
        />
      </div>

      <PanelHeader
        title="콘텐츠 검수 진행 현황"
        action={<LiveDatabaseStatus delayed={Boolean(dashboardError)} />}
      />
      <ReviewPipeline
        review={snapshot?.review ?? null}
        dominant={dominantReviewStage}
        error={displayError}
        changedKeys={changedKeys}
      />

      <PanelHeader
        title="수업·학습 현황"
        action={<LiveDatabaseStatus delayed={Boolean(dashboardError)} />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OperationMetric
          to="/admin/composer"
          label="수업 편성 미션"
          value={snapshot?.assignments.missionCount ?? null}
          unit="개 미션"
          description={snapshot ? `${snapshot.assignments.weekCount}개 주차 · ${snapshot.assignments.assignmentCount}건 배정` : "편성 현황"}
          error={displayError}
          changed={changedKeys.has("assignments")}
        />
        <OperationMetric
          to="/admin/learners"
          label="수업 참여 승인"
          value={snapshot?.approvedLearnerCount ?? null}
          unit="명"
          description="승인된 학습자"
          error={displayError}
          changed={changedKeys.has("learners")}
        />
        <OperationMetric
          to="/admin/decision-traces"
          label="학습 수행 기록"
          value={snapshot?.learnerRecordCount ?? null}
          unit="건"
          description="누적 학습 수행 기록"
          error={displayError}
          changed={changedKeys.has("records")}
        />
      </div>

      {isAdmin && (
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
