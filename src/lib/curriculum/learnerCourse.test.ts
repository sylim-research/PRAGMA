import { describe, expect, it } from "vitest";

import type { ComposerCore, WeekAssignment } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourseProjection";
import type { LearnerCourseSource } from "@/lib/curriculum/learnerCourse";
import type {
  CurriculumOutlineRow,
  CurriculumWeekRow,
} from "@/lib/curriculum/types";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

const outline = {
  id: "outline-1",
  title: "검토 완료 미션 강좌",
  status: "published",
  course_mode: "translation",
  target_interpreting_week_count: 0,
} as CurriculumOutlineRow;

const weeks = [
  {
    id: "week-2",
    outline_id: outline.id,
    week_no: 2,
    type: "regular",
    title: "요청",
    can_do: ["상황에 맞게 요청할 수 있다."],
    speech_act: "request",
    channel: "messenger",
    pdr_power: "equal",
    pdr_distance: "acquaintance",
    pdr_imposition: "low",
    review_released: true,
    competency_focus: "완화와 선택권",
    domain: "school",
  },
  {
    id: "week-3",
    outline_id: outline.id,
    week_no: 3,
    type: "regular",
    title: null,
    speech_act: "thanks",
  },
] as CurriculumWeekRow[];

function core(
  scenarioId: string,
  missionStatus: string | null,
  situation = `${scenarioId} 상황`,
  releaseGateMode: "legacy_reviewed" | "expert_v1" = "legacy_reviewed",
): ComposerCore {
  return {
    scenario_id: scenarioId,
    speech_act: "request",
    learner_level: "intermediate",
    domain: "school",
    mode: "translation",
    theme_code: "campus_study",
    topic_code: "test_topic",
    mission_status: missionStatus,
    release_gate_mode: releaseGateMode,
    content_release_id: CURRENT_CONTENT_RELEASE_ID,
    target_feature:
      missionStatus === null ? null : "request_mitigation_optionality",
    is_native_mpj5: true,
    situation_ko: situation,
    source_text_ko: "테스트 원문",
    direction: "ko_zh",
    context: {
      counterpart: "교수자",
      power: "speaker_lower",
      distance: "distant",
      burden: "mid",
      channel: "written",
    },
  };
}

function assignment(
  weekNo: number,
  scenarioId: string,
  position: number,
): WeekAssignment {
  return {
    id: `assignment-${weekNo}-${scenarioId}`,
    week_no: weekNo,
    scenario_id: scenarioId,
    position,
    slot_role: "primary",
  };
}

function source(
  assignments: WeekAssignment[],
  cores: ComposerCore[],
): LearnerCourseSource {
  return { outline, weeks, assignments, cores };
}

describe("학습자 편성 강좌 조립", () => {
  it("새 통역 주차와 다른 과거 번역 배정은 보존하되 학습자에게 실행시키지 않는다", () => {
    const assignments = [assignment(2, "translation", 0), assignment(9, "old-translation", 0), assignment(9, "interpreting", 1)];
    const course = assembleLearnerCourse({
      outline: { ...outline, course_mode: "mixed", target_interpreting_week_count: 6 },
      weeks: [weeks[0], { ...weeks[1], week_no: 9 }],
      assignments,
      cores: [
        core("translation", "reviewed"),
        core("old-translation", "reviewed"),
        { ...core("interpreting", "reviewed"), mode: "stt_interpreting" },
      ],
    });

    expect(course.weeks[0].scenarios.map((item) => item.scenario_id)).toEqual(["translation"]);
    expect(course.weeks[1].scenarios.map((item) => item.scenario_id)).toEqual(["interpreting"]);
    expect(assignments).toEqual([assignment(2, "translation", 0), assignment(9, "old-translation", 0), assignment(9, "interpreting", 1)]);
  });

  it("선택 화행 보완 주차도 다른 화행·통역·모드 불명 미션은 노출하지 않는다", () => {
    const course = assembleLearnerCourse({
      outline,
      weeks: [{ ...weeks[0], week_no: 13, speech_act: "request" }],
      assignments: [assignment(13, "translation", 0), assignment(13, "interpreting", 1), assignment(13, "unknown", 2), assignment(13, "other-act", 3)],
      cores: [
        core("translation", "reviewed"),
        { ...core("interpreting", "reviewed"), mode: "stt_interpreting" },
        { ...core("unknown", "reviewed"), mode: null },
        { ...core("other-act", "reviewed"), speech_act: "apology" },
      ],
    });

    expect(course.weeks[0].scenarios.map((item) => item.scenario_id)).toEqual(["translation"]);
  });

  it("화행 미선정인 과거 13주의 배정은 보존하되 학습 실행 목록에 섞지 않는다", () => {
    const assignments = [assignment(13, "legacy", 0)];
    const course = assembleLearnerCourse({ outline, weeks: [{ ...weeks[0], week_no: 13, speech_act: null }],
      assignments, cores: [core("legacy", "reviewed")] });
    expect(course.weeks[0].scenarios).toEqual([]);
    expect(assignments).toHaveLength(1);
  });

  it("reviewed 미션만 원래 주차·순서대로 노출한다", () => {
    const course = assembleLearnerCourse(
      source(
        [
          assignment(2, "reviewed-1", 0),
          assignment(2, "generated", 1),
          assignment(2, "reviewed-2", 2),
          assignment(3, "core-only", 0),
        ],
        [
          core("reviewed-1", "reviewed"),
          core("generated", "generated"),
          core("reviewed-2", "reviewed"),
          core("core-only", null),
        ],
      ),
    );

    expect(
      course.weeks[0].scenarios.map((scenario) => scenario.scenario_id),
    ).toEqual(["reviewed-1", "reviewed-2"]);
    expect(course.weeks[0].scenarios.every((scenario) => scenario.runnable)).toBe(
      true,
    );
    expect(course.weeks[1].scenarios).toEqual([]);
  });

  it("교수자 최종 검수를 마친 자료를 학습자에게 노출한다", () => {
    const course = assembleLearnerCourse(
      source(
        [assignment(2, "waiting", 0), assignment(2, "released", 1)],
        [
          core("waiting", "reviewed", "교수자 승인 상황", "expert_v1"),
          core("released", "released", "승인 상황", "expert_v1"),
        ],
      ),
    );

    expect(course.weeks[0].scenarios.map((scenario) => scenario.scenario_id)).toEqual(["waiting", "released"]);
  });

  it("편성에는 있으나 조회되지 않은 코어를 학습자에게 누락 문구로 노출하지 않는다", () => {
    const course = assembleLearnerCourse(
      source([assignment(2, "missing", 0)], []),
    );

    expect(course.weeks[0].scenarios).toEqual([]);
    expect(JSON.stringify(course)).not.toContain("불러올 수 없는 시나리오");
  });

  it("제목이 없는 주차는 주차 번호 라벨을 사용한다", () => {
    const course = assembleLearnerCourse(source([], []));

    expect(course.weeks[1].title).toBe("3주차");
  });

  it("학습 노트에 필요한 Can-do와 주차 맥락을 학습자 강좌에 전달한다", () => {
    const course = assembleLearnerCourse(source([], []));

    expect(course.weeks[0]).toMatchObject({
      can_do: ["상황에 맞게 요청할 수 있다."],
      channel: "messenger",
      pdr_power: "equal",
      pdr_distance: "acquaintance",
      pdr_imposition: "low",
      review_released: true,
      competency_focus: "완화와 선택권",
      domain: "school",
    });
  });
});
