import type { LearnerCourseWeek, LearnerWeekScenario } from "./learnerCourse";

// 주차 진행 판정 — 강좌 화면과 홈이 같은 규칙을 쓰도록 여기서만 정한다.
// 두 화면이 각자 "다음에 할 것"을 계산하면 서로 다른 주차를 가리키게 된다.

export type WeekState = "done" | "doing" | "todo" | "empty" | "unknown";

export interface WeekProgress {
  week: LearnerCourseWeek;
  /** 실행 가능한 미션만 분모로 삼는다(미검수·준비 중은 셀 수 없다). */
  assigned: LearnerWeekScenario[];
  doneCount: number;
  state: WeekState;
  /** 아직 하지 않은 첫 미션. 전부 마쳤거나 배정이 없으면 null. */
  nextScenario: LearnerWeekScenario | null;
}

/**
 * ⚠️ 하나라도 완료했으면 '완료'로 보면 안 된다 — 미션 2개 중 1개만 한 주차를
 * 완료로 표시하는 것은 진행을 과장한다. 전부 마쳐야 완료, 일부면 학습 중이다.
 * 조회가 실패했을 때는 0으로 채워 '예정'이라고 말하지 말고 상태를 모른다고 한다.
 */
export function weekProgress(
  week: LearnerCourseWeek,
  completed: ReadonlySet<string>,
  lookupFailed = false,
): WeekProgress {
  const assigned = week.scenarios.filter((s) => s.runnable);
  const doneCount = assigned.filter((s) => completed.has(s.scenario_id)).length;
  const nextScenario = assigned.find((s) => !completed.has(s.scenario_id)) ?? null;
  const state: WeekState =
    assigned.length === 0
      ? "empty"
      : lookupFailed
        ? "unknown"
        : doneCount === assigned.length && assigned.length === (week.expected_mission_modes?.length ?? assigned.length)
          ? "done"
          : doneCount > 0
            ? "doing"
            : "todo";
  return { week, assigned, doneCount, state, nextScenario };
}

/** 화행 주차 = 카드 그리드 / 화행 없는 정규 주차 = 통합 수행 / 그 외 = 이정표. */
export const isActWeek = (w: LearnerCourseWeek) => Boolean(w.speech_act);
export const isIntegrationWeek = (w: LearnerCourseWeek) =>
  !w.speech_act && w.type === "regular";
export const isMilestoneWeek = (w: LearnerCourseWeek) => w.type !== "regular";

/**
 * 지금 할 주차 — 실제로 시작할 미션이 남아 있는 주차만 고른다.
 *
 * 순서: ①진행 중인 주차(일부 완료) → ②아직 시작 안 한 가장 빠른 주차.
 * 이어서 할 것이 있으면 그것부터 가리키는 편이 자연스럽고, 편성상 앞선 주차를
 * 무조건 앞세우면 진행 중이던 학습이 화면에서 사라진다.
 *
 * `nextScenario`가 있는 주차만 후보다 — 화면의 「미션 시작」 버튼이 그려지는 조건과
 * 같은 식을 쓴다. 다른 식을 쓰면 CTA가 가리킨 주차를 열었을 때 시작할 것이 없다.
 */
export function pickCurrentWeek(
  weeks: LearnerCourseWeek[],
  completed: ReadonlySet<string>,
  lookupFailed = false,
): WeekProgress | null {
  const ordered = [...weeks.filter(isActWeek), ...weeks.filter(isIntegrationWeek)];
  const startable = ordered
    .map((w) => weekProgress(w, completed, lookupFailed))
    .filter((p) => p.nextScenario !== null);
  return startable.find((p) => p.state === "doing") ?? startable[0] ?? null;
}
