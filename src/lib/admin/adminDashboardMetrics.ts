import { CONTENT_REVIEW_VERSION } from "../../../supabase/functions/_shared/contentReview";
import { libraryMissionIsReady } from "./missionLibrary";

export const DASHBOARD_ROW_CAP = 4000;
export const DASHBOARD_REVIEW_CRITERIA_VERSION = CONTENT_REVIEW_VERSION;

/** 더 새 판이 대체한 옛 판(다른 행의 supersedes_scenario_id가 가리키는 행)을 뺀다. 대시보드·제작 현황·점검·승인이 같은 기준을 쓴다. */
export function excludeSupersededRows<T extends { scenario_id: string; supersedes_scenario_id?: string | null }>(rows: readonly T[], keepId?: string | null): T[] {
  const replaced = new Set(rows.map((row) => row.supersedes_scenario_id).filter(Boolean));
  return rows.filter((row) => !replaced.has(row.scenario_id) || row.scenario_id === keepId);
}

export type DashboardScenarioRow = {
  scenario_id: string;
  supersedes_scenario_id?: string | null;
  content_format: string;
  review_status: string | null;
  mission_status: string | null;
  mission_schema_version: string | null;
  authoring_stage: string | null;
  updated_at: string | null;
  /** 편성 가능 판정용 — core_content.generation.content_release_id. 대시보드 조회만 채운다. */
  content_release_id?: string | null;
  /** mission_content.mpj_items[4]·[5]의 type — 문항 전체를 읽지 않고 「정확히 5문항」만 확인한다. */
  mpj_item_5_type?: string | null;
  mpj_item_6_type?: string | null;
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

/** content_review_runs에서 DashboardReviewRunRow를 읽는 선택 컬럼. 대시보드와 승인 목록이 같은 규칙으로 센다. */
export const DASHBOARD_REVIEW_RUN_SELECT =
  "target_id,kind,criteria_version,rules_verdict:rules->>verdict,openai_response_id:openai_review->>response_id,claude_response_id:claude_review->>response_id,adjudication_response_id:adjudication->>response_id,created_at,approval_policy,independent_review_requested,approved_at,generation_quality_hash:generation_quality->>mission_content_hash,claude_first_finding:claude_review->result->findings->0->>id";

export type DashboardAssignmentRow = {
  outline_id: string;
  week_no: number;
  scenario_id: string;
};

export type DashboardCourseRow = {
  /** 'published'(학습자에게 공개) 또는 'draft'. */
  status: string | null;
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

/** 교수자 최종 승인을 마친 현재본(논문 4.3.4: 수업 사용 후보 자격, 노출 자체는 아님). */
export function isFinalizedMission(row: DashboardScenarioRow): boolean {
  return ["reviewed", "released"].includes(row.mission_status ?? "") && isProfessorFinalized(row);
}

/** `/admin/review`의 기본 「미션 생성됨(검수 대기)」 분모와 같은 조건이다. */
export function isDashboardReviewTarget(row: DashboardScenarioRow): boolean {
  return row.content_format === "scenario_core_v1"
    && row.review_status !== "revise_required"
    && row.mission_status === "generated"
    && hasMissionContent(row);
}

/** 대시보드 「학습 미션」 칸의 집합: 현재 코어에서 미션 내용이 만들어진 것. */
function isGeneratedMission(row: DashboardScenarioRow): boolean {
  return row.content_format === "scenario_core_v1"
    && ["generated", "reviewed", "released"].includes(row.mission_status ?? "")
    && hasMissionContent(row);
}

export function summarizeDashboardContent(rows: readonly DashboardScenarioRow[]) {
  const currentCoreRows = rows.filter((row) => row.content_format === "scenario_core_v1");
  const generated = currentCoreRows.filter(isGeneratedMission);
  const reviewTargets = generated.filter(isDashboardReviewTarget);
  const finalized = generated.filter(isFinalizedMission);
  return {
    coreCount: currentCoreRows.length,
    generatedMissionCount: generated.length,
    reviewTargetCount: reviewTargets.length,
    professorFinalizedCount: finalized.length,
    // 생성 완료 = 검토 대상 + 승인 완료 + 나머지. 나머지는 「수정 필요」로 되돌아간 것과
    // 최종 승인 없이 reviewed/released로 남은 옛 항목이다. 화면에서 세 수가 더해지도록 함께 보인다.
    pendingRevisionCount: generated.length - reviewTargets.length - finalized.length,
    // 위 나머지의 두 부분. 합은 pendingRevisionCount와 같다.
    reviseRequestedCount: generated.filter((row) => row.mission_status === "generated" && row.review_status === "revise_required").length,
    legacyReviewedCount: generated.filter((row) => ["reviewed", "released"].includes(row.mission_status ?? "") && !isProfessorFinalized(row)).length,
    composerReadyCount: generated.filter(isComposerReadyMission).length,
  };
}

/**
 * 라이브러리 「편성 가능 미션」과 같은 판정(libraryMissionIsReady — 현재 release·mission_v5/v6·MJT 5문항).
 * 교수자 승인 완료의 부분집합이며, 새 편성은 이 집합에서만 고른다.
 */
function isComposerReadyMission(row: DashboardScenarioRow): boolean {
  return libraryMissionIsReady({
    mission_status: row.mission_status,
    mission_schema_version: row.mission_schema_version,
    mission_mpj_items: row.mpj_item_5_type && !row.mpj_item_6_type ? [0, 0, 0, 0, 0] : [],
    core_content: { generation: { content_release_id: row.content_release_id ?? undefined } },
  });
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
export function latestDashboardReviewRun(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewRunRow | undefined {
  return runs
    .filter(
      (candidate) => candidate.kind === "mission"
        && candidate.criteria_version === DASHBOARD_REVIEW_CRITERIA_VERSION
        && candidate.target_id === row.scenario_id
        && runIsCurrentForRow(candidate, row),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

export function nextDashboardReviewStage(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewQueueStage {
  const run = latestDashboardReviewRun(row, runs);

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

/**
 * 현재 기준 검수를 한 번도 받지 않은 mission_v5 미션. v5는 검수 대신 v6로 전환하므로(2026-09-17 결정)
 * 대시보드의 대기 수에서 빼고 따로 센다. 규칙 검사 칸(rules)의 부분집합이다.
 */
export function countUnconvertedV5Missions(
  rows: readonly DashboardScenarioRow[],
  runs: readonly DashboardReviewRunRow[],
): number {
  return rows
    .filter(isDashboardReviewTarget)
    .filter((row) => row.mission_schema_version === "mission_v5" && !latestDashboardReviewRun(row, runs))
    .length;
}

/**
 * 「규칙 기반 검사」 칸에는 아직 검사하지 않은 미션과 검사에 실패한 미션이 함께 들어간다.
 * 실패는 재검사가 아니라 내용 수정이 필요하므로 그 수를 따로 보인다.
 */
export function countRulesFailures(
  rows: readonly DashboardScenarioRow[],
  runs: readonly DashboardReviewRunRow[],
): number {
  return rows.filter(isDashboardReviewTarget).filter((row) => latestDashboardReviewRun(row, runs)?.rules_verdict === "fail").length;
}

/** 누적 완료 집계용 run 행. 기준 버전·게이트 재결합(superseded) 구분 없이 모든 mission run을 읽는다. */
export type DashboardCumulativeRunRow = Pick<
  DashboardReviewRunRow,
  "target_id" | "kind" | "rules_verdict" | "openai_response_id" | "claude_response_id" | "adjudication_response_id" | "generation_quality_hash"
>;

export const DASHBOARD_CUMULATIVE_RUN_SELECT =
  "target_id,kind,rules_verdict:rules->>verdict,openai_response_id:openai_review->>response_id,claude_response_id:claude_review->>response_id,adjudication_response_id:adjudication->>response_id,generation_quality_hash:generation_quality->>mission_content_hash";

export type DashboardCumulativeReviewCounts = Record<Exclude<DashboardReviewQueueStage, "professor">, number>;

/**
 * 검수 단계별 누적 완료 — 현재 「학습 미션」 집합 가운데 그 단계를 한 번이라도 마친 **서로 다른 미션 수**.
 * run 횟수가 아니다: 재실행·기준 버전 변경·게이트 재결합으로 run이 여럿이어도 미션 하나는 1로 센다.
 * 규칙 검사는 fail이 아닌 판정(pass·warning — warning은 다음 단계로 넘어간다)만 완료로 센다.
 * AI 단계는 규칙 검사를 통과한 run에 응답이 저장된 경우만 센다(실패를 완료로 부풀리지 않는다).
 * OpenAI 검토에는 생성 단계에서 같은 OpenAI critic이 남긴 품질 점검 재사용을 포함한다 — 대기열 판정(nextDashboardReviewStage)과 같은 기준.
 * 교수자 최종 승인의 누적은 이 함수가 아니라 summarizeDashboardContent의 professorFinalizedCount를 쓴다.
 */
export function summarizeCumulativeReviewCompletion(
  rows: readonly DashboardScenarioRow[],
  runs: readonly DashboardCumulativeRunRow[],
): DashboardCumulativeReviewCounts {
  const missionIds = new Set(rows.filter(isGeneratedMission).map((row) => row.scenario_id));
  const done = { rules: new Set<string>(), openai: new Set<string>(), claude: new Set<string>(), adjudication: new Set<string>() };
  for (const run of runs) {
    if (run.kind !== "mission" || !missionIds.has(run.target_id)) continue;
    if (!run.rules_verdict || run.rules_verdict === "fail") continue;
    done.rules.add(run.target_id);
    if (run.openai_response_id || run.generation_quality_hash) done.openai.add(run.target_id);
    if (run.claude_response_id) done.claude.add(run.target_id);
    if (run.adjudication_response_id) done.adjudication.add(run.target_id);
  }
  return {
    rules: done.rules.size,
    openai: done.openai.size,
    claude: done.claude.size,
    adjudication: done.adjudication.size,
  };
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
    // 배정이 하나라도 있는 교과목만 센다. 만들어 두고 미션을 붙이지 않은 교과목은 여기 없다.
    courseCount: new Set(rows.map((row) => row.outline_id)).size,
  };
}

/**
 * 편성된 미션(중복 제거) 가운데 교수자 최종 승인을 마친 것과 아닌 것.
 * 새 편성은 승인·현행 릴리스 미션으로 제한되지만(composerEligibility), 게이트 이전의 옛 편성이 남아 있을 수 있다.
 * 미션 표에 없는 scenario_id는 승인 전으로 센다(모르는 것을 승인으로 치지 않는다).
 */
export function summarizeAssignmentApproval(
  assignments: readonly DashboardAssignmentRow[],
  scenarios: readonly DashboardScenarioRow[],
) {
  const finalizedIds = new Set(scenarios.filter(isFinalizedMission).map((row) => row.scenario_id));
  const assignedIds = new Set(assignments.map((row) => row.scenario_id));
  let approved = 0;
  for (const id of assignedIds) if (finalizedIds.has(id)) approved += 1;
  return { approvedMissionCount: approved, unapprovedMissionCount: assignedIds.size - approved };
}

/** 학습자는 status='published'인 교과목만 본다. 나머지는 모두 비공개로 센다. */
export function summarizeCourses(rows: readonly DashboardCourseRow[]) {
  const published = rows.filter((row) => row.status === "published").length;
  return { total: rows.length, published, unpublished: rows.length - published };
}
