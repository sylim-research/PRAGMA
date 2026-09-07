import { CONTENT_REVIEW_VERSION } from "../../../supabase/functions/_shared/contentReview";

export const DASHBOARD_ROW_CAP = 4000;
export const DASHBOARD_REVIEW_CRITERIA_VERSION = CONTENT_REVIEW_VERSION;

export type DashboardScenarioRow = {
  scenario_id: string;
  content_format: string;
  review_status: string | null;
  mission_status: string | null;
  mission_schema_version: string | null;
  authoring_stage: string | null;
  updated_at: string | null;
};

export type DashboardReviewRunRow = {
  target_id: string;
  kind: string;
  criteria_version: string;
  rules_verdict: string | null;
  openai_response_id: string | null;
  claude_response_id: string | null;
  adjudication_response_id: string | null;
  created_at: string;
  /** 'focused_v1'(2026-09-06 경량 검수) 또는 'multimodel_v2'(그 이전). 없으면 이전 규칙으로 본다. */
  approval_policy?: string | null;
  /** 경량 검수에서 교수자가 추가 모델 검토를 선택했는가. */
  independent_review_requested?: boolean | null;
  /** 재사용 가능한 생성 품질 결과가 붙어 있는가(값 자체가 아니라 존재 여부만 읽는다). */
  generation_quality_hash?: string | null;
  /** Claude 별도 검토에 의견이 하나라도 있는가(첫 의견 id — 있으면 재검토 대상). */
  claude_first_finding?: string | null;
  approved_at?: string | null;
};

export type DashboardAssignmentRow = {
  outline_id: string;
  week_no: number;
  scenario_id: string;
};

export type DashboardReviewQueueStage =
  | "rules"
  | "openai"
  | "claude"
  | "adjudication"
  | "professor";

export type DashboardReviewStageCounts = Record<DashboardReviewQueueStage, number>;

const REVIEW_QUEUE_STAGES: readonly DashboardReviewQueueStage[] = [
  "rules",
  "openai",
  "claude",
  "adjudication",
  "professor",
];

function hasMissionContent(row: DashboardScenarioRow): boolean {
  return Boolean(row.mission_schema_version);
}

function isProfessorFinalized(row: DashboardScenarioRow): boolean {
  return row.authoring_stage === "professor_finalized";
}

/** `/admin/review`의 기본 「미션 생성됨(검수 대기)」 분모와 같은 조건이다. */
export function isDashboardReviewTarget(row: DashboardScenarioRow): boolean {
  return row.content_format === "scenario_core_v1"
    && row.review_status !== "revise_required"
    && row.mission_status === "generated"
    && hasMissionContent(row);
}

export function summarizeDashboardContent(rows: readonly DashboardScenarioRow[]) {
  const currentCoreRows = rows.filter((row) => row.content_format === "scenario_core_v1");
  const generated = currentCoreRows.filter(
    (row) => ["generated", "reviewed", "released"].includes(row.mission_status ?? "")
      && hasMissionContent(row),
  );
  const reviewTargets = generated.filter(isDashboardReviewTarget);
  const finalized = generated.filter(
    (row) => ["reviewed", "released"].includes(row.mission_status ?? "") && isProfessorFinalized(row),
  );
  return {
    coreCount: currentCoreRows.length,
    generatedMissionCount: generated.length,
    reviewTargetCount: reviewTargets.length,
    professorFinalizedCount: finalized.length,
    // 생성 완료 = 검토 대상 + 승인 완료 + 나머지. 나머지는 「수정 필요」로 되돌아간 것과
    // 최종 승인 없이 reviewed/released로 남은 옛 항목이다. 화면에서 세 수가 더해지도록 함께 보인다.
    pendingRevisionCount: generated.length - reviewTargets.length - finalized.length,
  };
}

function runIsCurrentForRow(run: DashboardReviewRunRow, row: DashboardScenarioRow): boolean {
  if (!row.updated_at) return true;
  const runTime = Date.parse(run.created_at);
  const rowTime = Date.parse(row.updated_at);
  if (!Number.isFinite(runTime) || !Number.isFinite(rowTime)) return false;
  return runTime >= rowTime;
}

const FOCUSED_POLICY = "focused_v1";

/**
 * 현재 generated 미션이 다음에 처리해야 할 단계를 하나만 반환한다.
 *
 * `supabase/functions/_shared/contentReview.ts`의 `nextReviewStage`와 같은 규칙이어야 한다.
 * 2026-09-06 경량 검수(focused_v1)에서는 규칙 검사 → (재사용 가능한 생성 품질 결과가 없을 때만)
 * AI 검토 1회 → 교수자 최종 승인이 기본이고, Claude 별도 검토와 그 의견의 재검토는 교수자가
 * 추가로 선택했을 때만 거친다. 이전 정책(multimodel_v2)은 네 단계를 모두 거친다.
 *
 * 콘텐츠가 마지막 검수 run 뒤 수정됐다면 과거 결과를 재사용하지 않고 규칙 검사로 되돌린다.
 * 규칙 검사 fail도 원본 수정 뒤 다시 확인해야 하므로 rules에 남긴다.
 */
export function nextDashboardReviewStage(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewQueueStage {
  const run = runs
    .filter(
      (candidate) => candidate.kind === "mission"
        && candidate.criteria_version === DASHBOARD_REVIEW_CRITERIA_VERSION
        && candidate.target_id === row.scenario_id
        && runIsCurrentForRow(candidate, row),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  if (!run || run.rules_verdict === "fail") return "rules";
  if (run.approval_policy === FOCUSED_POLICY) {
    if (!run.openai_response_id && !run.generation_quality_hash) return "openai";
    if (run.independent_review_requested && !run.claude_response_id) return "claude";
    if (run.independent_review_requested && run.claude_first_finding && !run.adjudication_response_id) return "adjudication";
    return "professor";
  }
  if (!run.openai_response_id) return "openai";
  if (!run.claude_response_id) return "claude";
  if (!run.adjudication_response_id) return "adjudication";
  // generated 상태인데 승인 run이 남은 비정상 경우도 교수자 작업대에서 확인해야 한다.
  return "professor";
}

export function summarizeDashboardReviewStages(
  rows: readonly DashboardScenarioRow[],
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewStageCounts {
  const counts = Object.fromEntries(
    REVIEW_QUEUE_STAGES.map((stage) => [stage, 0]),
  ) as DashboardReviewStageCounts;
  for (const row of rows.filter(isDashboardReviewTarget)) {
    counts[nextDashboardReviewStage(row, runs)] += 1;
  }
  return counts;
}

export function dominantDashboardReviewStage(
  counts: DashboardReviewStageCounts,
): DashboardReviewQueueStage | null {
  let dominant: DashboardReviewQueueStage | null = null;
  let highest = 0;
  for (const stage of REVIEW_QUEUE_STAGES) {
    if (counts[stage] > highest) {
      dominant = stage;
      highest = counts[stage];
    }
  }
  return dominant;
}

export function summarizeDashboardAssignments(rows: readonly DashboardAssignmentRow[]) {
  return {
    assignmentCount: rows.length,
    missionCount: new Set(rows.map((row) => row.scenario_id)).size,
    weekCount: new Set(rows.map((row) => `${row.outline_id}:${row.week_no}`)).size,
    // 배정이 하나라도 있는 교과목만 센다. 만들어 두고 미션을 붙이지 않은 교과목은 여기 없다 —
    // 그 차이는 화면에서 전체 교과목 수와 나란히 보여 준다.
    courseCount: new Set(rows.map((row) => row.outline_id)).size,
  };
}
