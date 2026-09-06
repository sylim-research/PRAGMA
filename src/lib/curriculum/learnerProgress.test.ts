import { describe, expect, it } from "vitest";
import type {
  LearnerCourseWeek,
  LearnerWeekScenario,
} from "@/lib/curriculum/learnerCourse";
import { pickCurrentWeek, weekProgress } from "@/lib/curriculum/learnerProgress";

const week = (
  weekNo: number,
  overrides: Partial<LearnerCourseWeek> = {},
): LearnerCourseWeek => ({
  week_no: weekNo,
  title: `${weekNo}주차`,
  type: "regular",
  can_do: [],
  speech_act: "request",
  channel: null,
  pdr_power: null,
  pdr_distance: null,
  pdr_imposition: null,
  review_released: false,
  competency_focus: null,
  domain: null,
  scenarios: [],
  ...overrides,
});

const scenario = (id: string, runnable = true): LearnerWeekScenario => ({
  scenario_id: id,
  situation_ko: `상황 ${id}`,
  mission_status: "reviewed",
  target_feature: "request_mitigation_optionality",
  mode: "translation",
  runnable,
});

describe("weekProgress", () => {
  it("번역만 준비되어 완료했어도 통역 슬롯이 남은 주차를 완료로 표시하지 않는다", () => {
    const w = week(2, { expected_mission_modes: ["translation", "stt_interpreting"], scenarios: [scenario("translation")] });
    expect(weekProgress(w, new Set(["translation"])).state).toBe("doing");
    w.scenarios.push({ ...scenario("interpreting"), mode: "stt_interpreting" });
    expect(weekProgress(w, new Set(["translation", "interpreting"])).state).toBe("done");
  });
  it("배정 미션을 전부 마쳐야 완료다 — 일부만 마치면 학습 중이다", () => {
    const w = week(2, { scenarios: [scenario("a"), scenario("b")] });

    expect(weekProgress(w, new Set(["a"])).state).toBe("doing");
    expect(weekProgress(w, new Set(["a", "b"])).state).toBe("done");
    expect(weekProgress(w, new Set()).state).toBe("todo");
  });

  it("실행 불가 미션은 분모에 넣지 않는다", () => {
    const w = week(2, { scenarios: [scenario("a"), scenario("b", false)] });
    const p = weekProgress(w, new Set(["a"]));

    expect(p.assigned.map((s) => s.scenario_id)).toEqual(["a"]);
    expect(p.state).toBe("done");
  });

  it("배정이 없으면 준비 중이고, 조회 실패는 0이 아니라 확인 필요다", () => {
    expect(weekProgress(week(8, { scenarios: [] }), new Set()).state).toBe("empty");

    const w = week(2, { scenarios: [scenario("a")] });
    expect(weekProgress(w, new Set(), true).state).toBe("unknown");
  });

  it("다음 미션은 아직 하지 않은 첫 미션이다", () => {
    const w = week(2, { scenarios: [scenario("a"), scenario("b")] });

    expect(weekProgress(w, new Set(["a"])).nextScenario?.scenario_id).toBe("b");
    expect(weekProgress(w, new Set(["a", "b"])).nextScenario).toBeNull();
  });
});

describe("pickCurrentWeek", () => {
  it("미완료가 남은 가장 빠른 화행 주차를 고른다", () => {
    const weeks = [
      week(2, { scenarios: [scenario("a")] }),
      week(3, { scenarios: [scenario("b")] }),
    ];

    expect(pickCurrentWeek(weeks, new Set(["a"]))?.week.week_no).toBe(3);
  });

  it("진행 중인 주차가 있으면 편성상 앞선 미시작 주차보다 먼저 고른다", () => {
    const weeks = [
      week(2, { scenarios: [scenario("a1"), scenario("a2")] }),
      week(5, { scenarios: [scenario("b1"), scenario("b2")] }),
    ];

    // 5주차만 하나 마친 상태 — 이어서 할 것이 있는 5주차를 가리켜야 한다.
    const picked = pickCurrentWeek(weeks, new Set(["b1"]));
    expect(picked?.week.week_no).toBe(5);
    expect(picked?.nextScenario?.scenario_id).toBe("b2");
  });

  it("시작할 미션이 없는 주차는 후보가 아니다 — CTA가 빈 주차를 가리키면 안 된다", () => {
    const weeks = [
      week(2, { scenarios: [scenario("a", false)] }),
      week(3, { scenarios: [] }),
      week(5, { scenarios: [scenario("c")] }),
    ];

    expect(pickCurrentWeek(weeks, new Set())?.week.week_no).toBe(5);
  });

  it("화행 주차를 모두 마치면 통합 주차로 넘어간다", () => {
    const weeks = [
      week(2, { scenarios: [scenario("a")] }),
      week(12, { speech_act: null, scenarios: [scenario("c")] }),
    ];

    expect(pickCurrentWeek(weeks, new Set(["a"]))?.week.week_no).toBe(12);
  });

  it("남은 미션이 없으면 억지로 아무 주차나 가리키지 않는다", () => {
    const weeks = [
      week(2, { scenarios: [scenario("a")] }),
      week(8, { type: "midterm", speech_act: null, scenarios: [] }),
    ];

    expect(pickCurrentWeek(weeks, new Set(["a"]))).toBeNull();
  });

  it("평가 주차는 이번 학습 후보가 아니다", () => {
    const weeks = [
      week(15, { type: "final", speech_act: null, scenarios: [scenario("f")] }),
    ];

    expect(pickCurrentWeek(weeks, new Set())).toBeNull();
  });
});
