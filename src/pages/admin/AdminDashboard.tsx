import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  content: ReturnType<typeof summarizeDashboardContent>;
  review: DashboardReviewStageCounts;
  /** 단계별 누적 완료(서로 다른 미션 수). 읽지 못하면 null — 대기열 지표는 그대로 보인다. */
  cumulative: DashboardCumulativeReviewCounts | null;
  assignments: ReturnType<typeof summarizeDashboardAssignments>;
  /** 편성된 미션(중복 제거) 중 승인 완료·승인 전. */
  assignmentApproval: ReturnType<typeof summarizeAssignmentApproval>;
  /** 교과목 전체와 공개(published)·비공개. */
  courses: ReturnType<typeof summarizeCourses>;
  /** 규칙 검사 칸 안의 검사 실패 수. */
  rulesFailCount: number;
  approvedLearnerCount: number;
  learnerRecordCount: number;
  /** 교과목(course_id)에 연결된 수행 기록 수. 읽지 못하면 null. */
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
  <div className="mb-2 mt-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1B2A36]">{title}</h2>
      {action}
    </div>
    {description && <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>}
  </div>
);

// 용어대장 기준: 규칙은 「검사」, AI는 「검토」(의견 제시, 판정 아님), 뒤따르는 AI는 「재검토」,
// 교수자는 「최종 승인」. 「지적」은 산출물 이름으로 쓰지 않고 「판정」은 연구자 몫이라 여기 쓰지 않는다.
// 숫자 옆에는 행위가 아니라 상태(「~ 대기」)가 보여야 한다. 누가 무엇을 검토하는지도 이름에 둔다 —
// 「AI」만으로는 단계가 구별되지 않아 모델 제공사 이름을 붙인다(모델 버전은 추적 정보라 넣지 않는다)
// (논문 4.3.3, focused_v1: 규칙 검사 → OpenAI 검토(저장된 생성 품질점검 재사용) → 선택 시에만 Claude 독립 검토 → Claude 의견이 있을 때만 OpenAI 재검토 → 교수자 최종 승인).
// 운영 파이프라인의 단계 카드는 단계 이름을 주어로 두고, 누적 완료(주)와 현재 대기(보조)를 함께 보인다.
const REVIEW_STAGE_DISPLAY_LABELS: Record<DashboardReviewQueueStage, string> = {
  rules: "결정론 규칙 검사",
  openai: "OpenAI 품질 검토",
  claude: "Claude 독립 검토",
  adjudication: "OpenAI 재검토",
  professor: "교수자 최종 승인",
};

// 1~4단계는 품질 점검 화면이, 5단계는 교수자 최종 승인 화면이 처리한다.
const REVIEW_STAGE_ROUTE = (stage: DashboardReviewQueueStage) => (stage === "professor" ? "/admin/review" : "/admin/ai-review");

// 2026-09-06 경량 검수부터 Claude 별도 검토와 재검토는 교수자가 선택했을 때만 거친다.
// 화살표만 두면 다섯 단계를 모두 지나는 것처럼 읽히므로, 선택 단계는 점선으로 구분한다.
const OPTIONAL_REVIEW_STAGES: ReadonlySet<DashboardReviewQueueStage> = new Set(["claude", "adjudication"]);

// Final evidence preparation belongs to the professor-work queue on this overview.
const REVIEW_STAGE_ITEMS = CONTENT_REVIEW_STEPS.filter((stage) => stage.key !== "finalization").map((stage, index) => ({
  ...stage,
  step: index + 1,
  displayLabel: REVIEW_STAGE_DISPLAY_LABELS[stage.key],
  optional: OPTIONAL_REVIEW_STAGES.has(stage.key),
}));

// 품질관리의 세 의미 단위(논문 4.3.3 · 생성 계약 화면의 「재현 가능 검사 / 문맥 검토 / 최종 권한」과 같은 틀).
const REVIEW_STAGE_GROUPS: readonly { label: string; keys: readonly DashboardReviewQueueStage[] }[] = [
  { label: "결정론 검사", keys: ["rules"] },
  { label: "AI 문맥 검토", keys: ["openai", "claude", "adjudication"] },
  { label: "교수자 승인", keys: ["professor"] },
];

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
  /** null = 누적 집계를 읽지 못함(대기열과 따로 실패할 수 있다). */
  cumulative: DashboardCumulativeReviewCounts | null;
  professorFinalized: number | null;
  dominant: DashboardReviewQueueStage | null;
  rulesFailCount: number;
  error: string | null;
  changedKeys: ReadonlySet<DashboardMetricKey>;
}) => (
  // 규칙 → AI → 사람. 세 묶음 머리표만 두고 설명문은 쓰지 않는다. 화살표는 실제 검수 순서에만 쓴다.
  <div role="group" aria-label="품질 검수 단계">
  <div className="flex flex-wrap items-stretch gap-2 lg:flex-nowrap">
      {REVIEW_STAGE_GROUPS.map((group, groupIndex) => (
        <Fragment key={group.label}>
          {groupIndex > 0 && <ArrowRight aria-hidden className="mt-5 h-4 w-4 shrink-0 self-center text-[#81909A]" />}
          <div className="min-w-0" style={{ flex: group.keys.length }}>
            <p className="mb-1 border-b border-[#E6E1D5] pb-0.5 text-[11px] font-semibold tracking-[0.04em] text-[#6B7780]">{group.label}</p>
            <div className="flex items-stretch gap-1">
      {group.keys.map((key, index) => {
        const stage = REVIEW_STAGE_ITEMS.find((item) => item.key === key)!;
        const queue = review?.[stage.key] ?? null;
        const completed = stage.key === "professor" ? professorFinalized : cumulative?.[stage.key] ?? null;
        const active = dominant === stage.key;
        const changed = changedKeys.has(`review.${stage.key}`);
        return (
          <Fragment key={stage.key}>
          {index > 0 && <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#B9C3CA]" />}
            <Link
              to={REVIEW_STAGE_ROUTE(stage.key)}
              className={[
                "group flex min-w-0 flex-1 flex-col rounded-lg border border-[#E6E1D5] bg-white px-2.5 py-2",
                "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
                changed ? "ring-2 ring-[#F4D85E]/35" : "",
              ].join(" ")}
              data-optional={stage.optional ? "true" : undefined}
              data-dominant={active ? "true" : undefined}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold leading-4 text-[#3F4E59]">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#EEF1F2] text-[10px] tabular-nums text-[#63727C]">{stage.step}</span>
                {stage.displayLabel}
              </span>
              {/* 해낸 일(누적 완료)은 큰 숫자로 차분하게, 기다리는 일은 있을 때만 노란 배지로. */}
              <span className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[11px] text-[#63727C]">{stage.key === "professor" ? "승인 완료" : "누적 완료"}</span>
                {completed === null && !error && review === null ? (
                  <span aria-label="불러오는 중" className="inline-block h-5 w-10 rounded bg-muted motion-safe:animate-pulse" />
                ) : (
                  <span className="text-[20px] font-bold leading-none tracking-[-0.025em] text-[#15202B] tabular-nums">
                    {error || completed === null ? <span className="text-xs font-normal text-destructive">확인 필요</span> : completed}
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 whitespace-nowrap text-[11px] text-[#5F6B73]">
                {!error && (queue ?? 0) > 0
                  ? <span className="rounded-full bg-[#FAD338] px-2 py-px font-bold tabular-nums text-[#15202B]">현재 대기 {queue}</span>
                  : <span>{error || queue === null ? "—" : "대기 없음"}</span>}
                {stage.key === "rules" && <span>규칙 {ACTIVE_RULE_IDS.length}개</span>}
                {stage.optional && <span>선택형</span>}
                {stage.key === "rules" && rulesFailCount > 0 && <span>불통과 {rulesFailCount}</span>}
              </span>
            </Link>
          </Fragment>
        );
      })}
            </div>
          </div>
        </Fragment>
      ))}
  </div>
  <p className="mt-1.5 text-right text-[12px] text-[#6B7780]">
    현재 대기 합계{" "}
    <b className="font-semibold tabular-nums text-[#15202B]">
      {review && !error ? REVIEW_STAGE_ITEMS.reduce((sum, stage) => sum + review[stage.key], 0) : "—"}
    </b>개
  </p>
  </div>
);

// 사이드바의 노란 번호와 같은 모양. 원문자(③ 등)는 글꼴에 따라 깨져 보여 쓰지 않는다.
const StepBadge = ({ step }: { step: number }) => (
  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF3C4] text-[11px] font-bold text-[#15202B]">{step}</span>
);

// 사이드바 5단계와 같은 이름·순서의 흐름 줄. 상세가 아래에 있는 ③④⑤는 숫자를 반복하지 않고 흐름만 말한다.
const WorkflowStep =({ step, title, to, changed = false, children }: {
  step: number;
  title: string;
  to: string;
  changed?: boolean;
  children: ReactNode;
}) => (
  <li className="flex min-w-0 flex-1 items-stretch gap-1.5">
    {step > 1 && <ArrowRight aria-hidden className="hidden h-4 w-4 shrink-0 self-center text-[#81909A] lg:block" />}
    <Link
      to={to}
      className={[
        "flex min-w-0 flex-1 flex-col rounded-lg border border-[#E6E1D5] bg-white px-3 py-2",
        "motion-safe:transition-colors motion-safe:duration-200 hover:border-[#B9C3CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
        changed ? "ring-2 ring-[#F4D85E]/35" : "",
      ].join(" ")}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-bold text-[#15202B]">
        <StepBadge step={step} />
        {title}
      </span>
      <span className="mt-1 whitespace-nowrap text-[12px] text-[#5F6B73]">{children}</span>
    </Link>
  </li>
);

/** 흐름 줄·상세 줄 안의 수. 단위를 늘 붙인다(미션 수·건수·명수를 섞어 읽지 않게). */
const Num = ({ value, unit, error }: { value: number | null | undefined; unit?: string; error: string | null }) => (
  <>
    <b className="text-[17px] font-bold tabular-nums text-[#15202B]">{error || value == null ? "—" : value}</b>
    {unit}
  </>
);

const FlowArrow = () => <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#81909A]" />;

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
      const [scenarioRows, reviewRows, cumulativeRows, assignmentRows, courseRows, learnerResult, learnerRecordResult, courseLinkedResult] = await Promise.all([
        fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
          .from("scenarios")
          .select("scenario_id,content_format,review_status,mission_status,updated_at,mission_schema_version:mission_content->>schema_version,authoring_stage:mission_content->authoring->>stage,content_release_id:core_content->generation->>content_release_id,mpj_item_5_type:mission_content->mpj_items->4->>type,mpj_item_6_type:mission_content->mpj_items->5->>type")
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
        // 누적 완료는 기준 버전·재결합 이력까지 모든 mission run에서 미션 단위로 센다.
        // 이 조회가 실패해도 대기열·할 일은 보여야 하므로 따로 받아 null로 둔다.
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
        db.from("profiles").select("id", { count: "exact" }).eq("role", "learner").eq("approval_status", "approved").limit(1),
        db.from("learner_mission_logs").select("id", { count: "exact" }).limit(1),
        db.from("learner_mission_logs").select("id", { count: "exact" }).not("course_id", "is", null).limit(1),
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
        cumulative: cumulativeRows ? summarizeCumulativeReviewCompletion(scenarioRows, cumulativeRows) : null,
        assignments: summarizeDashboardAssignments(assignmentRows),
        assignmentApproval: summarizeAssignmentApproval(assignmentRows, scenarioRows),
        courses: summarizeCourses(courseRows),
        rulesFailCount: countRulesFailures(scenarioRows, reviewRows),
        approvedLearnerCount: learnerResult.count ?? 0,
        learnerRecordCount: learnerRecordResult.count ?? 0,
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
      hideTitle
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

      {/* 첫 화면의 주인공은 지금 교수자를 기다리는 일이다. 수는 품질 점검·최종 승인 화면과 같은 검수 단계 판정으로 센다.
          이 화면에서 승인하지 않고, 결정은 교수자 최종 승인 화면에서 한다. */}
      {/* 숫자마다 「무엇의 몇 개인지」를 붙인다 — 설명문을 읽기 전에 뜻이 서야 한다.
          「품질 점검 대기」는 규칙 검사 전과 AI 검토 진행 중을 함께 센다(규칙 검사 불통과는 따로). 그래서 「시작 전」이라 부르지 않는다. */}
      {/* 행동이 필요한 두 대기열만 한 줄로. 흐름 전체가 첫 화면에 들어오도록 높이를 낮게 둔다. */}
      <section aria-label="지금 할 일" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-[#15202B] px-4 py-2.5 text-white">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-[#FAD338]">지금 할 일</span>
        <span className="text-[15px] font-bold">
          교수자 승인 대기 · 학습 미션{" "}
          <span className="tabular-nums">{displayError ? "—" : snapshot?.review.professor ?? "—"}</span>개
        </span>
        <Button asChild className="h-8 bg-[#FAD338] px-3 text-[13px] font-semibold text-[#15202B] hover:bg-[#F2C71E]">
          <Link to="/admin/review">승인하러 가기 →</Link>
        </Button>
        <span aria-hidden className="hidden h-4 w-px bg-white/20 sm:block" />
        <span className="text-[13px] text-[#B9C3CA]">
          품질 점검 대기 · 학습 미션 <b className="font-semibold tabular-nums text-white">{displayError ? "—" : needsCheckCount ?? "—"}</b>개
        </span>
        {/* 0건은 할 일이 아니라 소음이라 생겼을 때만 보인다. */}
        {!displayError && (snapshot?.rulesFailCount ?? 0) > 0 && (
          <span className="text-[13px] text-[#B9C3CA]">
            규칙 검사 불통과 · <b className="font-semibold tabular-nums text-[#FAD338]">{snapshot?.rulesFailCount}</b>개
          </span>
        )}
        <Link to="/admin/ai-review" className="ml-auto text-[13px] font-medium text-white underline-offset-4 hover:underline">품질 점검 화면 →</Link>
      </section>

      {/* 세 운영 층위. 층위 사이는 순서가 아니라 서로 다른 층이라 화살표 없이 쌓는다.
          숫자는 전부 기존 snapshot 필드다 — 새로 계산하는 것은 검수 단계 합계(표시용 덧셈)뿐이다. */}
      {/* 사이드바의 5단계 생애와 같은 흐름 줄 + 그중 상세가 필요한 ③·④·⑤. 숫자는 전부 기존 snapshot 필드다. */}
      <PanelHeader title="PRAGMA 운영 워크플로우" action={liveStatus(true)} />
      <ol aria-label="PRAGMA 운영 워크플로우" className="flex flex-col gap-2 lg:flex-row lg:gap-1.5">
        <WorkflowStep step={1} title="생성 기준" to="/admin/prompt-harness">
          생성 계약 · 규칙 <Num value={ACTIVE_RULE_IDS.length} unit="개" error={null} />
        </WorkflowStep>
        <WorkflowStep step={2} title="학습 미션 재료" to="/admin/library" changed={changedKeys.has("core")}>
          시나리오 재료 <Num value={snapshot?.content.coreCount} unit="개" error={displayError} />
        </WorkflowStep>
        <WorkflowStep step={3} title="학습 미션 제작·품질 관리" to="/admin/assembly" changed={changedKeys.has("mission")}>
          규칙 · AI · 교수자 검수
        </WorkflowStep>
        <WorkflowStep step={4} title="수업 운영" to="/admin/composer" changed={changedKeys.has("assignments")}>
          승인 미션을 교과목·주차에 편성
        </WorkflowStep>
        <WorkflowStep step={5} title="학습 기록·연구 자료" to="/admin/decision-traces" changed={changedKeys.has("records")}>
          수행 기록 → 연구 데이터
        </WorkflowStep>
      </ol>

      {/* ③ 상세. 학습 미션 = 검수 진행 중 + 교수자 승인 완료 + 기타 상태(수정 요청 + 승인 기록 없는 옛 미션). 진행 중은 아래 단계별 현재 대기로 다시 쪼갠다. */}
      <section aria-label="학습 미션 제작·품질 관리" className="mt-2.5 rounded-xl border border-[#E6E1D5] bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-[#5F6B73]">
          <span className="mr-2 inline-flex items-center gap-1.5 self-center font-bold text-[#15202B]"><StepBadge step={3} />학습 미션 제작·품질 관리</span>
          <span>학습 미션 <Num value={snapshot?.content.generatedMissionCount} unit="개" error={displayError} /> =</span>
          <Link to="/admin/ai-review" className="underline-offset-4 hover:underline">검수 진행 중 <Num value={snapshot?.content.reviewTargetCount} error={displayError} /></Link>
          <span>+</span>
          {/* 누적 완료 수다. 할 일(대기)로 읽히지 않도록 「승인 완료」라고 부른다. */}
          <Link to="/admin/review" className="underline-offset-4 hover:underline">교수자 승인 완료 <Num value={snapshot?.content.professorFinalizedCount} error={displayError} /></Link>
          <span>+</span>
          {/* 내역(수정 요청·승인 기록 없는 옛 미션)은 운영 점검용 2차 정보라 마우스를 올릴 때만 보인다. 합계는 그대로 남긴다. */}
          <span
            title={snapshot && !displayError
              ? `수정 요청 ${snapshot.content.reviseRequestedCount} · 승인 기록 없는 옛 미션 ${snapshot.content.legacyReviewedCount}`
              : undefined}
          >
            기타 상태 <Num value={snapshot?.content.pendingRevisionCount} error={displayError} />
          </span>
        </div>
          <div className="mt-2.5">
            <ReviewPipeline
              review={snapshot?.review ?? null}
              cumulative={snapshot?.cumulative ?? null}
              professorFinalized={snapshot?.content.professorFinalizedCount ?? null}
              dominant={dominantReviewStage}
              rulesFailCount={snapshot?.rulesFailCount ?? 0}
              error={displayError}
              changedKeys={changedKeys}
            />
          </div>
      </section>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[3fr_2fr]">
        {/* ④ 상세. 승인된 콘텐츠가 수업으로 들어가는 문: 교수자 승인 ⊃ 편성 가능(현재 release·MJT5) → 교과목·주차 편성.
            승인 전 미션이 섞인 편성은 게이트 이전의 옛 편성이라, 있을 때만 알린다. */}
        <section aria-label="수업 운영" className="rounded-xl border border-[#E6E1D5] bg-white px-4 py-2.5">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#15202B]"><StepBadge step={4} />수업 운영</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#5F6B73]">
            <Link to="/admin/review" className="underline-offset-4 hover:underline">교수자 승인 <Num value={snapshot?.content.professorFinalizedCount} unit="개" error={displayError} /></Link>
            <FlowArrow />
            <Link to="/admin/library" className="underline-offset-4 hover:underline">편성 가능 미션 <Num value={snapshot?.content.composerReadyCount} unit="개" error={displayError} /></Link>
            {/* 편성 건수는 위 미션 수에서 파생된 값이 아니다(교과목×주차 배정 건수, 게이트 이전의 옛 편성 포함) — 화살표로 잇지 않는다. */}
            <span aria-hidden className="text-[#B9C3CA]">·</span>
            <Link
              to="/admin/composer"
              className="underline-offset-4 hover:underline"
              title={snapshot && !displayError && snapshot.assignmentApproval.unapprovedMissionCount > 0
                ? `승인 전 미션 ${snapshot.assignmentApproval.unapprovedMissionCount}개 포함(게이트 이전 편성)`
                : undefined}
            >
              주차별 미션 편성 <Num value={snapshot?.assignments.assignmentCount} unit="건" error={displayError} />
            </Link>
          </div>
          {snapshot && !displayError && (
            <p className="mt-1 text-[12px] text-[#5F6B73]">
              교과목 {snapshot.courses.total}개(공개 {snapshot.courses.published}) · 편성 주차 {snapshot.assignments.weekCount}개
              {" · "}
              {/* 계정 이용 승인이지 수강 등록이 아니다. */}
              <Link to="/admin/learners" className="underline-offset-4 hover:underline">승인 학습자 계정 {snapshot.approvedLearnerCount}개</Link>
            </p>
          )}
        </section>

        {/* ⑤ 상세. 학습 수행이 연구 기록으로 닫힌다 — 표 전체 행 수이고 계정·기간으로 거르지 않는다. 내보내기는 동의 기록만. */}
        <section aria-label="학습 기록·연구 자료" className="rounded-xl border border-[#E6E1D5] bg-white px-4 py-2.5">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#15202B]"><StepBadge step={5} />학습 기록·연구 자료</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#5F6B73]">
            <Link to="/admin/decision-traces" className="underline-offset-4 hover:underline">수행 기록 <Num value={snapshot?.learnerRecordCount} unit="건" error={displayError} /></Link>
            <FlowArrow />
            <Link to="/admin/export" className="font-medium text-[#15202B] underline-offset-4 hover:underline">연구 데이터 내보내기</Link>
          </div>
          {/* 수행 기록은 계정·기간으로 거르지 않은 전체 행이다. 교과목에 연결된 기록 수를 함께 보여 수업 운영 기록과 시범 수행을 가를 수 있게 한다. */}
          <p className="mt-1 text-[12px] text-[#5F6B73]">
            교과목 연결 {snapshot && !displayError && snapshot.courseLinkedRecordCount !== null ? snapshot.courseLinkedRecordCount : "—"}건 · 내보내기는 동의 기록만
          </p>
        </section>
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
