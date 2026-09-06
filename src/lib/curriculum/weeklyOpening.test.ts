import { describe, expect, it } from "vitest";
import { buildWeeklyOpening } from "./weeklyOpening";
import type { LearnerCourse, LearnerCourseWeek } from "./learnerCourse";
import { LEVEL, SPEECH_ACT_UI, type LearnerLevel, type SpeechActUI } from "@/lib/pragma/enums";

export const openingOutline = { id: "hook-course", title: "한중 학업 통번역", level: "intermediate", language_direction: "ko_zh", domain: "school", course_mode: "translation", target_interpreting_week_count: 0 } as LearnerCourse["outline"];
export const openingWeek: LearnerCourseWeek = { week_no: 2, title: "상황에 맞게 요청하기", type: "regular", can_do: ["관계와 부담을 근거로 요청 표현을 선택할 수 있다."], competency_focus: "원문의 요청 의도와 태도 전달", speech_act: "request", channel: "messenger", pdr_power: "equal", pdr_distance: "formal", pdr_imposition: "low", domain: "school", review_released: false, scenarios: [] };

describe("교과목·주차 도입 자료", () => {
  it("통번역 두 미션의 역할과 P/D/R이 달라도 도입은 한 번역 예시의 조건으로만 구성한다", () => {
    const translation = { scenario_id: "t", situation_ko: "PRIVATE_TEXT_SCENE", source_text: "PRIVATE_TEXT",
      speech_act: "request" as const, mission_status: "reviewed", target_feature: null,
      mode: "translation" as const, runnable: true, domain: "school" as const,
      context: { power: "equal", distance: "close", burden: "low", channel: "email", counterpart: null } };
    const interpreting = { ...translation, scenario_id: "i", mode: "stt_interpreting" as const,
      situation_ko: "PRIVATE_SPOKEN_SCENE", source_text: "PRIVATE_SPEECH",
      context: { power: "speaker_lower", distance: "distant", burden: "high", channel: "facetoface", counterpart: null } };
    const week = { ...openingWeek, week_no: 13, channel: null, pdr_power: null, pdr_distance: null,
      pdr_imposition: null, scenarios: [translation, interpreting] };
    const before = JSON.stringify(week);
    const result = buildWeeklyOpening({ ...openingOutline, course_mode: "mixed" }, week);
    expect(result.status).toBe("draft");
    expect(result.contextLabel).toContain("번역 예시");
    expect(result.notice).toContain("두 미션의 공통 조건이 아니며");
    expect(result.clues[1].fact).toContain("몇 분");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(JSON.stringify(week)).toBe(before);
  });
  it("9화행 × 3수준 × 양방향 × 두 수행모드가 실제 예문과 역할에 반영된다", () => {
    for (const act of Object.keys(SPEECH_ACT_UI) as SpeechActUI[]) for (const level of Object.keys(LEVEL) as LearnerLevel[]) for (const direction of ["ko_zh", "zh_ko"] as const) for (const interpreting of [false, true]) {
      const result = buildWeeklyOpening({ ...openingOutline, level, language_direction: direction, course_mode: interpreting ? "interpreting" : "translation", target_interpreting_week_count: interpreting ? 12 : 0 }, { ...openingWeek, speech_act: act, channel: interpreting ? "facetoface" : "email" });
      expect(result.status, `${act}/${level}/${direction}/${interpreting}`).toBe("draft");
      expect(result.source?.language).toBe(direction === "ko_zh" ? "ko" : "zh");
      expect(result.rendering?.language).toBe(direction === "ko_zh" ? "zh" : "ko");
      expect(result.contextLabel).toContain(SPEECH_ACT_UI[act]);
      expect(result.role).toContain(interpreting ? "통역사 C" : "여러분이 보내려는 이메일");
      expect(result.goals).toEqual([openingWeek.competency_focus, ...openingWeek.can_do]);
      expect(result.clues).toHaveLength(2);
    }
  });
  it("주차 영역을 우선하고 수준을 바꾸면 예문과 토론 지원도 바뀐다", () => {
    const school = buildWeeklyOpening(openingOutline, openingWeek);
    const work = buildWeeklyOpening({ ...openingOutline, level: "advanced" }, { ...openingWeek, domain: "work" });
    expect(school.scene).toContain("세미나");
    expect(work.scene).toContain("설명회");
    expect(work.source?.text).not.toBe(school.source?.text);
    expect(work.support).not.toBe(school.support);
  });
  it("관계·거리·부담이 바뀌면 공개할 사실도 바뀐다", () => {
    const result = buildWeeklyOpening(openingOutline, { ...openingWeek, pdr_power: "higher", pdr_distance: "close", pdr_imposition: "high" });
    expect(result.clues[0].fact).toContain("사적인 이야기");
    expect(result.clues[0].fact).toContain("상대가 최종 결정");
    expect(result.clues[1].fact).toContain("여러 사람의 일정");
  });
  it("미지정 또는 잘못된 조건을 임의로 보완하지 않는다", () => {
    expect(buildWeeklyOpening({ ...openingOutline, language_direction: "unknown" }, openingWeek).status).toBe("unavailable");
    expect(buildWeeklyOpening({ ...openingOutline, course_mode: "unknown" }, openingWeek).status).toBe("unavailable");
    expect(buildWeeklyOpening(openingOutline, { ...openingWeek, channel: "phone" }).status).toBe("unavailable");
    const missing = buildWeeklyOpening(openingOutline, { ...openingWeek, pdr_distance: null });
    expect(missing.status).toBe("planning");
    expect(missing.source).toBeNull();
    expect(buildWeeklyOpening(openingOutline, { ...openingWeek, can_do: [], competency_focus: null }).goals.length).toBeGreaterThan(0);
  });
  it("미션 원문 중복과 편성 불일치를 차단하고 미션 해설을 가져오지 않는다", () => {
    const source = buildWeeklyOpening(openingOutline, openingWeek).source!.text;
    const scenario = { scenario_id: "m1", situation_ko: "PRIVATE_MISSION_SCENE", source_text: source, speech_act: "request" as const, mission_status: "reviewed", target_feature: "request_mitigation_optionality", mode: "translation" as const, runnable: true };
    expect(buildWeeklyOpening(openingOutline, { ...openingWeek, scenarios: [scenario] }).status).toBe("unavailable");
    expect(buildWeeklyOpening(openingOutline, { ...openingWeek, scenarios: [{ ...scenario, source_text: "다른 원문", speech_act: "refusal" }] }).status).toBe("unavailable");
    const result = buildWeeklyOpening(openingOutline, { ...openingWeek, scenarios: [{ ...scenario, source_text: "다른 원문" }] });
    expect(result.status).toBe("draft");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_MISSION_SCENE");
  });
  it("OT는 맥락 해석 사례를, 화행 없는 평가·클리닉은 주차 목표에 따른 진행안을 쓴다", () => {
    const orientation = buildWeeklyOpening(openingOutline, { ...openingWeek, week_no: 1, type: "orientation", speech_act: null });
    expect(orientation.source?.text).toBe("괜찮아요.");
    const assessment = buildWeeklyOpening(openingOutline, { ...openingWeek, week_no: 8, type: "midterm", speech_act: null });
    expect(assessment.status).toBe("planning");
    expect(assessment.source).toBeNull();
    expect(assessment.goals).toEqual(orientation.goals);
  });
  it("13주 기본 주차 필드가 비어 있어도 편성 맥락 하나로 별도 예시를 구성하고 두 번째 맥락을 덮어쓰지 않는다", () => {
    const context = { power: "equal", distance: "close", burden: "low", channel: "email", counterpart: null };
    const scenario = { scenario_id: "m1", situation_ko: "PRIVATE_SCENE", source_text: "PRIVATE_SOURCE", speech_act: "request" as const, mission_status: "reviewed", target_feature: null, mode: "translation" as const, runnable: true, context, domain: "school" as const };
    const week = { ...openingWeek, week_no: 13, title: "고부담 맥락 집중 실전", channel: null, pdr_power: null, pdr_distance: null, pdr_imposition: null, can_do: [], competency_focus: null,
      scenarios: [scenario, { ...scenario, scenario_id: "m2", context: { ...context, burden: "high" } }] };
    const before = JSON.stringify(week);
    const result = buildWeeklyOpening(openingOutline, week);
    expect(result.status).toBe("draft");
    expect(result.weekTitle).toBe("선택 화행 집중 보완");
    expect(result.questionGuidance).toContain("바꿔 사용할 수 있습니다");
    expect(result.notice).toContain("두 미션의 공통 조건이 아니며");
    expect(result.clues[1].fact).toContain("몇 분");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(JSON.stringify(week)).toBe(before);
  });
});
