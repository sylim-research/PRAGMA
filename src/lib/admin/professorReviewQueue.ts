// 「교수자 최종 승인」 목록의 판별 정보. 승인 상태·단계의 의미는 adminDashboardMetrics가 정하고,
// 이 파일은 그 결과를 목록 한 줄로 옮기기만 한다(판정 규칙을 새로 두지 않는다).
import {
  isDashboardReviewTarget,
  latestDashboardReviewRun,
  nextDashboardReviewStage,
  type DashboardAssignmentRow,
  type DashboardReviewQueueStage,
  type DashboardReviewRunRow,
  type DashboardScenarioRow,
} from "./adminDashboardMetrics";

export type ProfessorQueue = "decision" | "in_progress";

/** generated 미션이 교수자 차례인지. 차례가 아니거나 미션 본문이 없으면 검수 진행 중으로 둔다. */
export function professorQueueOf(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): ProfessorQueue {
  return isDashboardReviewTarget(row) && nextDashboardReviewStage(row, runs) === "professor"
    ? "decision"
    : "in_progress";
}

export type QualityCheckQueue = "needs_check" | "rules_error" | "decision";

/**
 * 자동 품질 점검 화면의 대기열. 같은 generated 미션을 점검 쪽에서 본 이름이다.
 * decision은 교수자 최종 승인 화면의 「결정 대기」와 같은 집합이고, rules_error는
 * 대시보드 countRulesFailures와 같은 조건(최신 run의 규칙 검사 fail)이다.
 */
export function qualityCheckQueueOf(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): QualityCheckQueue {
  if (professorQueueOf(row, runs) === "decision") return "decision";
  if (isDashboardReviewTarget(row) && latestDashboardReviewRun(row, runs)?.rules_verdict === "fail") return "rules_error";
  return "needs_check";
}

const STAGE_STATUS:Record<Exclude<DashboardReviewQueueStage, "rules">, string> = {
  openai: "규칙 통과 · AI 검토 전",
  claude: "규칙 통과 · AI 검토 완료 · 추가 모델 검토 전",
  adjudication: "규칙 통과 · 추가 모델 의견 재검토 전",
  professor: "규칙 통과 · AI 검토 완료 · 교수자 결정 대기",
};

/** 규칙 검사·AI 검토·교수자 결정이 어디까지 왔는지 한 구절로. */
export function reviewProgressLabel(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): string {
  if (["reviewed", "released"].includes(row.mission_status ?? "")) return "교수자 승인 완료";
  if (!isDashboardReviewTarget(row)) return "검수 대상 아님";
  const stage = nextDashboardReviewStage(row, runs);
  if (stage === "rules") {
    return latestDashboardReviewRun(row, runs)?.rules_verdict === "fail" ? "규칙 검사 오류 · 수정 필요" : "규칙 검사 전";
  }
  return STAGE_STATUS[stage];
}

/** 교과목·주차. 편성이 없으면 「편성 전」, 여러 곳이면 첫 편성과 나머지 수. */
export function placementLabel(
  mine: readonly DashboardAssignmentRow[] | undefined,
  outlineTitles: ReadonlyMap<string, string>,
): string {
  if (!mine || mine.length === 0) return "편성 전";
  const first = mine[0];
  const label = `${outlineTitles.get(first.outline_id) ?? "제목 없는 교과목"} ${first.week_no}주차`;
  return mine.length > 1 ? `${label} 외 ${mine.length - 1}곳` : label;
}

/** scenario_id별 편성 목록. 목록 한 줄마다 전체 편성을 다시 훑지 않도록 한 번에 묶는다(주차 순). */
export function groupAssignments(assignments: readonly DashboardAssignmentRow[]) {
  const grouped = new Map<string, DashboardAssignmentRow[]>();
  for (const row of assignments) {
    const list = grouped.get(row.scenario_id);
    if (list) list.push(row);
    else grouped.set(row.scenario_id, [row]);
  }
  return grouped;
}

export function missionVersionLabel(schemaVersion: string | null | undefined): string | null {
  const match = /^mission_v(\d+)$/.exec(schemaVersion ?? "");
  return match ? `Mission v${match[1]}` : null;
}

/** 미션 콘텐츠 해시의 앞 7자. 「Mission v6」 같은 버전 표기와 헷갈리지 않도록 Trace를 붙인다. */
export function traceLabel(hash: string | null | undefined): string | null {
  return /^[0-9a-f]{7,}$/i.test(hash ?? "") ? `Trace ${hash!.slice(0, 7).toLowerCase()}` : null;
}

export function updatedAtLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `수정 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
