import { describe, expect, it } from "vitest";

import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { buildWeeklyLearnerNote } from "@/lib/curriculum/learnerNote";
import { buildWeeklyCourseMaterial, missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import type { CurriculumOutlineRow } from "@/lib/curriculum/types";

function week(overrides: Partial<LearnerCourseWeek> = {}): LearnerCourseWeek {
  return {
    week_no: 2,
    title: "요청",
    type: "regular",
    can_do: ["초면인 담당자에게 일정 변경을 요청할 수 있다."],
    speech_act: "request",
    channel: "messenger",
    pdr_power: "higher",
    pdr_distance: "formal",
    pdr_imposition: "high",
    review_released: false,
    competency_focus: "관계와 부담에 맞는 요청",
    domain: "work",
    scenarios: [],
    ...overrides,
  };
}

describe("주차 학습 노트 조립", () => {
  it("교수자가 작성한 Can-do와 P/D/R의 자연어 맥락을 보존한다", () => {
    const note = buildWeeklyLearnerNote(week(), "ko_zh");

    expect(note.canDoSource).toBe("instructor");
    expect(note.canDos).toEqual(["초면인 담당자에게 일정 변경을 요청할 수 있다."]);
    expect(note.contextCues.map((cue) => cue.value)).toEqual(
      expect.arrayContaining([
        "상대가 결정권을 더 가진 관계",
        "처음 만나거나 아직 거리가 먼 사이",
        "상대의 시간·노력 부담이 큰 일",
      ]),
    );
    expect(note.features[0].code).toBe("request_mitigation_optionality");
  });

  it("Can-do가 비어 있으면 기존 결정론 가이드로 기본 목표를 제공한다", () => {
    const note = buildWeeklyLearnerNote(week({ can_do: [] }), "ko_zh");

    expect(note.canDoSource).toBe("default");
    expect(note.canDos).toHaveLength(2);
    expect(note.canDos[0]).toContain("‘요청’ 소통 행동");
  });

  it("중→한 방향에서는 한국어 산출 자원을 사용한다", () => {
    const note = buildWeeklyLearnerNote(week(), "zh_ko");

    expect(note.directionLabel).toBe("중→한");
    expect(note.features[0].resources.join(" ")).toContain("주실 수 있을까요");
  });

  it("칭찬 주차도 기본 강좌의 목표 화용요소 하나만 보인다(칭찬 대응은 확장점)", () => {
    const note = buildWeeklyLearnerNote(
      week({
        title: "칭찬",
        speech_act: "compliment",
        scenarios: [],
      }),
      "ko_zh",
    );

    expect(note.features.map((feature) => feature.code)).toEqual([
      "compliment_grounding_sensitivity",
    ]);
  });

  it("공용 내용에 내부 판정 정의·교수자 메모를 넣지 않는다", () => {
    const note = buildWeeklyLearnerNote(week({ speech_act: "agreement" }), "ko_zh");
    expect(note.features[0]).not.toHaveProperty("definition");
    expect(note.features[0]).not.toHaveProperty("distinguishFrom");
    expect(note.features[0]).not.toHaveProperty("counterRule");
    expect(JSON.stringify(note)).not.toContain("too_ambiguous");
  });

  it("미션이 없거나 다른 진단 태그가 배정돼도 주차의 공통 내용은 유지한다", () => {
    const empty = buildWeeklyLearnerNote(week(), "ko_zh");
    const assigned = buildWeeklyLearnerNote(week({ scenarios: [{
      scenario_id: "mission-1", situation_ko: "테스트 상황", mission_status: "reviewed",
      target_feature: "invitation_choice_commitment", mode: "translation", runnable: true,
    }] }), "ko_zh");
    expect(assigned).toEqual(empty);
  });

  it("교과목·주차 정보와 기존 목표로 미편성 주차 자료를 구성한다", () => {
    const outline = { id: "course-1", title: "중한 번역 수업", level: "intermediate", language_direction: "zh_ko", course_mode: "translation", target_interpreting_week_count: 0 } as CurriculumOutlineRow;
    const material = buildWeeklyCourseMaterial(outline, week());
    expect(material.courseTitle).toBe("중한 번역 수업");
    expect(material.contextLabel).toContain("중→한");
    expect(material.sections[0].items).toEqual(week().can_do);
    expect(material.missions).toEqual([]);
    expect(material.preparationLabel).toContain("계획 미리보기");
    expect(material.sections[material.sections.length - 1]?.paragraphs[0]).toContain("편성 후");
  });

  it("편성된 미션을 바꾸면 수업자료의 상황·원문도 함께 바뀐다", () => {
    const outline = { id: "course-1", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 } as CurriculumOutlineRow;
    const assigned = week({ scenarios: [1, 2].map((id) => ({ scenario_id: `mission-${id}`, situation_ko: `편성 상황 ${id}.`, source_text: `편성 원문 ${id}`, mission_status: "reviewed", target_feature: null, mode: "translation", runnable: true })) });
    const material = buildWeeklyCourseMaterial(outline, assigned);
    expect(material.preparationLabel).toBe("편성 미션 2개 반영");
    expect(material.sections.find((section) => section.id === "mission-mission-2")?.items).toEqual(["편성 원문 2"]);
    assigned.scenarios[1].source_text = "교체한 원문";
    expect(JSON.stringify(buildWeeklyCourseMaterial(outline, assigned))).toContain("교체한 원문");
  });

  it("미션 카드 설명은 첫 문장만 사용하고 긴 문장은 생략 표시한다", () => {
    expect(missionSituationSummary("첫 번째 상황입니다. 두 번째 설명입니다.")).toBe("첫 번째 상황입니다.");
    expect(missionSituationSummary("가".repeat(100), 60)).toBe(`${"가".repeat(60)}…`);
  });

  it("수업자료 본문은 두 문장 전체를 보존하고 연결 목록만 요약한다", () => {
    const outline = { id: "course-1", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 } as CurriculumOutlineRow;
    const situation = "학과 선배가 오늘 저녁 모임에 함께 가자고 제안했습니다. 이미 잡힌 약속이 있어 참석할 수 없으며 다른 날 참석하겠다고 약속할 수는 없습니다.";
    const assigned = week({ scenarios: [{ scenario_id: "refusal-1", situation_ko: situation, source_text: "오늘은 먼저 잡힌 약속이 있어서 참석하기 어렵습니다.", mission_status: "reviewed", target_feature: "refusal_softening", mode: "translation", runnable: true }] });
    const before = structuredClone(assigned);
    const material = buildWeeklyCourseMaterial(outline, assigned);
    expect(material.sections.find((section) => section.id === "mission-refusal-1")?.paragraphs).toEqual([situation]);
    expect(material.missions[0].summary).toBe("학과 선배가 오늘 저녁 모임에 함께 가자고 제안했습니다.");
    expect(assigned).toEqual(before);
  });

  it("자료 본문의 긴 첫 문장도 목록의 78자 제한으로 자르지 않는다", () => {
    const outline = { id: "course-1", title: "수업", level: "intermediate", language_direction: "zh_ko", course_mode: "translation", target_interpreting_week_count: 0 } as CurriculumOutlineRow;
    const situation = `${"상황 단서 ".repeat(18)}입니다. 두 번째 문장의 필수 조건도 남깁니다.`;
    const assigned = week({ scenarios: [{ scenario_id: "long-1", situation_ko: situation, mission_status: "reviewed", target_feature: null, mode: "translation", runnable: true }] });
    const material = buildWeeklyCourseMaterial(outline, assigned);
    expect(material.sections.find((section) => section.id === "mission-long-1")?.paragraphs).toEqual([situation]);
    expect(material.missions[0].summary.length).toBeLessThanOrEqual(79);
    expect(material.missions[0].summary.endsWith("…")).toBe(true);
  });
});
