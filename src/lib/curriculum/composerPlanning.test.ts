import { describe, expect, it } from "vitest";

import type { ComposerCore } from "@/lib/curriculum/composer";
import {
  addAssignment,
  assignmentStructureIssues,
  buildAutomaticAssignments,
  duplicateScenarioIds,
  filterManualCandidates,
  incompatibleAssignmentIds,
  removeAssignment,
  type AssignMap,
} from "@/lib/curriculum/composerPlanning";
import {
  createStandard15WeekTemplate,
  STANDARD_TARGET_ACTS,
} from "@/lib/curriculum/template";
import type {
  LanguageDirection,
  LearnerLevel,
} from "@/lib/pragma/enums";
import {
  COURSE_PRESETS,
  type CoursePreset,
} from "@/lib/pragma/scenarioTopics";
import { expectedMissionModesForWeek } from "@/lib/curriculum/courseModePolicy";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

function core(overrides: Partial<ComposerCore> & { scenario_id: string }): ComposerCore {
  return {
    scenario_id: overrides.scenario_id,
    speech_act: overrides.speech_act ?? "request",
    learner_level: overrides.learner_level ?? "intermediate",
    domain: overrides.domain ?? "school",
    mode: overrides.mode ?? "translation",
    theme_code: overrides.theme_code ?? "campus_study",
    topic_code: overrides.topic_code ?? "test_topic",
    mission_status: overrides.mission_status ?? "reviewed",
    content_release_id: overrides.content_release_id ?? CURRENT_CONTENT_RELEASE_ID,
    target_feature: overrides.target_feature ?? "request_mitigation",
    is_native_mpj5: overrides.is_native_mpj5 ?? true,
    situation_ko: overrides.situation_ko ?? `테스트 상황 ${overrides.scenario_id}`,
    source_text_ko: overrides.source_text_ko ?? "테스트 원문",
    direction: overrides.direction ?? "ko_zh",
    context: overrides.context ?? {
      counterpart: "교수자",
      power: "speaker_lower",
      distance: "distant",
      burden: "mid",
      channel: "written",
    },
  };
}

function presetPool(
  preset: CoursePreset,
  level: LearnerLevel,
  direction: LanguageDirection,
): ComposerCore[] {
  const theme = preset.included_themes[0];
  return STANDARD_TARGET_ACTS.flatMap((act) =>
    (["translation", "stt_interpreting"] as const).flatMap((mode) =>
      Array.from({ length: 3 }, (_, index) => core({
        scenario_id: `${preset.preset_code}-${act}-${mode}-${index}`,
        speech_act: act,
        learner_level: level,
        direction,
        theme_code: theme,
        mode,
      })),
    ),
  );
}

describe("13주 선택 화행 집중 보완", () => {
  const policy = { courseMode: "translation" as const, interpretingWeekCount: 0 };
  const options = { level: "intermediate" as const, direction: "ko_zh" as const, themes: [],
    courseModePolicy: policy, defaultScenariosPerWeek: 2 };

  it("교강사가 선택하기 전에는 후보와 배정을 허용하지 않고 초안은 보존한다", () => {
    const weeks = createStandard15WeekTemplate();
    const mission = core({ scenario_id: "new" });
    expect(filterManualCandidates([mission], { ...options, act: null, assignments: {}, weekNo: 13 })).toEqual([]);
    expect(assignmentStructureIssues({ 13: [] }, {}, weeks, options.level, options.direction, 2, policy)).toEqual([]);
    expect(assignmentStructureIssues({ 13: [{ scenario_id: "new", slot_role: "primary" }] }, { new: mission },
      weeks, options.level, options.direction, 2, policy).map((issue) => issue.code)).toContain("reinforcement_act_required");
  });

  it("선택한 같은 화행의 서로 다른 저부담·고부담 상황을 허용하고 다른 화행은 거부한다", () => {
    const weeks = createStandard15WeekTemplate();
    weeks[12].speech_act = "request";
    const first = core({ scenario_id: "first", context: { power: "equal", distance: "close", burden: "low", channel: "written", counterpart: "친구" } });
    const second = core({ scenario_id: "second", context: { power: "speaker_lower", distance: "distant", burden: "high", channel: "written", counterpart: "담당자" } });
    const assignments = { 13: [first, second].map((item) => ({ scenario_id: item.scenario_id, slot_role: "primary" })) };
    expect(assignmentStructureIssues(assignments, { first, second }, weeks, options.level, options.direction, 2, policy)).toEqual([]);
    expect(assignmentStructureIssues(assignments, { first, second: { ...second, speech_act: "apology" } },
      weeks, options.level, options.direction, 2, policy).map((issue) => issue.code)).toContain("speech_act");
    weeks[12].scenario_slots = 5;
    const third = core({ scenario_id: "third" });
    expect(assignmentStructureIssues({ 13: [...assignments[13], { scenario_id: "third", slot_role: "primary" }] },
      { first, second, third }, weeks, options.level, options.direction, 5, policy).map((issue) => issue.code)).toContain("too_many_items");
  });

  it("자동 편성도 교강사의 선택을 따르고 앞서 쓴 미션을 다시 배정하지 않는다", () => {
    const weeks = createStandard15WeekTemplate();
    weeks[12].speech_act = "request";
    const cores = Array.from({ length: 4 }, (_, index) => core({ scenario_id: `request-${index}` }));
    const result = buildAutomaticAssignments({ ...options, weeks, cores });
    expect(result.assignments[2].map((item) => item.scenario_id)).toEqual(["request-0", "request-1"]);
    expect(result.assignments[13].map((item) => item.scenario_id)).toEqual(["request-2", "request-3"]);
    expect(duplicateScenarioIds(result.assignments)).toEqual([]);
  });

  it("앞선 주차에 없는 화행을 13주 보완 대상으로 자동 편성하거나 저장하지 않는다", () => {
    const weeks = createStandard15WeekTemplate();
    weeks[1].speech_act = "thanks";
    weeks[12].speech_act = "request";
    const mission = core({ scenario_id: "new" });
    expect(buildAutomaticAssignments({ ...options, weeks, cores: [mission] }).assignments[13]).toBeUndefined();
    expect(assignmentStructureIssues({ 13: [{ scenario_id: "new", slot_role: "primary" }] }, { new: mission },
      weeks, options.level, options.direction, 2, policy).map((issue) => issue.code)).toContain("reinforcement_act_not_learned");
  });
});

describe("프리셋 기반 15주 자동 편성", () => {
  it.each(COURSE_PRESETS)(
    "$label 프리셋이 공통 15주 골격의 9개 화행 주차를 검토 완료 미션으로 채운다",
    (preset) => {
      const cores = presetPool(preset, preset.target_level, preset.language_direction);
      const result = buildAutomaticAssignments({
        weeks: createStandard15WeekTemplate(),
        cores,
        level: preset.target_level,
        direction: preset.language_direction,
        themes: preset.included_themes,
        courseModePolicy: {
          courseMode: preset.course_mode,
          interpretingWeekCount: preset.target_interpreting_week_count,
        },
        defaultScenariosPerWeek: 3,
      });

      expect(result.filledWeeks).toBe(9);
      expect(result.totalAssigned).toBe(18);
      expect(result.interpretingWeekNumbers).toHaveLength(9);
      expect(duplicateScenarioIds(result.assignments)).toEqual([]);

      const byId = new Map(cores.map((item) => [item.scenario_id, item]));
      for (const [weekNoText, items] of Object.entries(result.assignments)) {
        expect(items).toHaveLength(2);
        expect(items.every((item) => item.pair_contract_version == null)).toBe(true);
        const expectedModes = expectedMissionModesForWeek(
          {
            courseMode: preset.course_mode,
            interpretingWeekCount: preset.target_interpreting_week_count,
          },
          Number(weekNoText),
        );
        for (const [index, item] of items.entries()) {
          const selected = byId.get(item.scenario_id);
          expect(selected?.mission_status).toBe("reviewed");
          expect(selected?.learner_level).toBe(preset.target_level);
          expect(selected?.direction).toBe(preset.language_direction);
          expect(selected?.mode).toBe(expectedModes[index]);
          expect(preset.included_themes).toContain(selected?.theme_code);
        }
      }
    },
  );

  it("테마 후보가 부족해도 교수자 승인 전에는 다른 테마로 조용히 완화하지 않는다", () => {
    const eligibleFallback = core({
      scenario_id: "eligible-fallback",
      theme_code: "career_workplace",
    });
    const cores: ComposerCore[] = [
      core({ scenario_id: "selected-theme", theme_code: "campus_study" }),
      eligibleFallback,
      core({ scenario_id: "generated", mission_status: "generated" }),
      core({ scenario_id: "legacy-mpj4", is_native_mpj5: false }),
      core({ scenario_id: "wrong-act", speech_act: "apology" }),
      core({ scenario_id: "wrong-level", learner_level: "advanced" }),
      core({ scenario_id: "wrong-direction", direction: "zh_ko" }),
    ];
    const requestWeek = createStandard15WeekTemplate().filter(
      (week) => week.speech_act === "request",
    );
    const result = buildAutomaticAssignments({
      weeks: requestWeek,
      cores,
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      courseModePolicy: { courseMode: "translation", interpretingWeekCount: 0 },
      defaultScenariosPerWeek: 2,
    });

    expect(result.assignments[2]).toBeUndefined();
    expect(result.shortages).toEqual([{ weekNo: 2, missingSlots: 2 }]);
    expect(result.expandedThemeWeeks).toEqual([]);
  });

  it("교수자가 명시적으로 승인하면 부족한 주차만 다른 테마로 확대한다", () => {
    const cores = [
      core({ scenario_id: "selected-theme", theme_code: "campus_study" }),
      core({
        scenario_id: "expanded-theme",
        theme_code: "career_workplace",
      }),
    ];
    const requestWeek = createStandard15WeekTemplate().filter(
      (week) => week.speech_act === "request",
    );
    const result = buildAutomaticAssignments({
      weeks: requestWeek,
      cores,
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      courseModePolicy: { courseMode: "translation", interpretingWeekCount: 0 },
      defaultScenariosPerWeek: 2,
      allowThemeExpansion: true,
    });

    expect(result.assignments[2].map((item) => item.scenario_id)).toEqual([
      "selected-theme",
      "expanded-theme",
    ]);
    expect(result.shortages).toEqual([]);
    expect(result.expandedThemeWeeks).toEqual([2]);
  });

  it("자동 편성은 표기가 같은 상황 복제본을 건너뛰고 새로운 두 번째 상황을 고른다", () => {
    const cores = [
      core({ scenario_id: "first", situation_ko: "교수에게 일정 변경을 요청한다." }),
      core({ scenario_id: "duplicate", situation_ko: " 교수에게 일정 변경을 요청한다 " }),
      core({ scenario_id: "second", situation_ko: "기숙사 관리자에게 수리를 요청한다." }),
    ];
    const requestWeek = createStandard15WeekTemplate().filter(
      (week) => week.speech_act === "request",
    );

    const result = buildAutomaticAssignments({
      weeks: requestWeek,
      cores,
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      courseModePolicy: { courseMode: "translation", interpretingWeekCount: 0 },
      defaultScenariosPerWeek: 2,
    });

    expect(result.assignments[2].map((item) => item.scenario_id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("통번역형은 모든 화행 주차에 번역 1개·통역 1개를 편성한다", () => {
    const preset = COURSE_PRESETS[0];
    const cores = presetPool(preset, "intermediate", "ko_zh");
    const result = buildAutomaticAssignments({
      weeks: createStandard15WeekTemplate(),
      cores,
      level: "intermediate",
      direction: "ko_zh",
      themes: preset.included_themes,
      courseModePolicy: { courseMode: "mixed", interpretingWeekCount: 6 },
      defaultScenariosPerWeek: 2,
    });

    expect(result.interpretingWeekNumbers).toEqual([2, 3, 4, 5, 6, 9, 10, 11, 12]);
    const byId = new Map(cores.map((item) => [item.scenario_id, item]));
    for (const weekNo of [2, 3, 4, 5, 6, 9, 10, 11, 12]) {
      expect(result.assignments[weekNo].map((item) => byId.get(item.scenario_id)?.mode))
        .toEqual(["translation", "stt_interpreting"]);
    }
  });
});

describe("주차 수동 교체", () => {
  const current = core({ scenario_id: "current" });
  const replacement = core({ scenario_id: "replacement" });

  it("통번역형은 통역을 먼저 추가해도 번역·통역 순서로 저장하며 중복 모드를 차단한다", () => {
    const interpreting = core({ scenario_id: "interpreting", mode: "stt_interpreting" });
    const modes = ["translation", "stt_interpreting"] as const;
    const byId = { current, replacement, interpreting };
    const partial = addAssignment({}, 2, interpreting, modes, byId);
    const candidates = filterManualCandidates([current, replacement, interpreting], {
      act: "request", level: "intermediate", direction: "ko_zh", themes: [],
      assignments: partial, weekNo: 2, expectedModes: modes, coreById: byId,
    });
    expect(candidates.map((item) => item.mode)).toEqual(["translation", "translation"]);
    const complete = addAssignment(partial, 2, current, modes, byId);
    expect(complete[2].map((item) => item.scenario_id)).toEqual(["current", "interpreting"]);
    expect(addAssignment(complete, 2, replacement, modes, byId)).toBe(complete);
    expect(assignmentStructureIssues({ 2: [
      { scenario_id: "current", slot_role: "primary" }, { scenario_id: "replacement", slot_role: "primary" },
    ] }, byId, createStandard15WeekTemplate(), "intermediate", "ko_zh", 2, { courseMode: "mixed" })
      .some((issue) => issue.code === "course_mode")).toBe(true);
  });

  it("통역 후보가 없으면 번역 두 건으로 대체하지 않으며 13주도 선택 화행의 두 모드를 요구한다", () => {
    const weeks = createStandard15WeekTemplate();
    weeks[12].speech_act = "request";
    const options = { weeks, level: "intermediate" as const, direction: "ko_zh" as const,
      themes: [], defaultScenariosPerWeek: 2, courseModePolicy: { courseMode: "mixed" as const } };
    expect(buildAutomaticAssignments({ ...options, cores: [current, replacement] }).totalAssigned).toBe(0);
    const interpreting = core({ scenario_id: "interpreting", mode: "stt_interpreting" });
    const interpreting13 = core({ scenario_id: "interpreting13", mode: "stt_interpreting",
      context: { counterpart: "고객", power: "speaker_lower", distance: "distant", burden: "high", channel: "spoken" } });
    const result = buildAutomaticAssignments({ ...options, cores: [current, replacement, interpreting, interpreting13] });
    expect(result.assignments[2].map((item) => item.scenario_id)).toEqual(["current", "interpreting"]);
    expect(result.assignments[13].map((item) => item.scenario_id)).toEqual(["replacement", "interpreting13"]);
    expect(duplicateScenarioIds(result.assignments)).toEqual([]);
  });

  it("첫 번역 후보가 유일한 통역 상황과 겹치면 다음 번역 후보로 완전한 편성을 찾는다", () => {
    const interpreting = core({ scenario_id: "interpreting", mode: "stt_interpreting", situation_ko: current.situation_ko });
    const result = buildAutomaticAssignments({ weeks: createStandard15WeekTemplate(),
      cores: [current, replacement, interpreting], level: "intermediate", direction: "ko_zh",
      themes: [], defaultScenariosPerWeek: 2, courseModePolicy: { courseMode: "mixed" } });
    expect(result.assignments[2].map((item) => item.scenario_id)).toEqual(["replacement", "interpreting"]);
  });

  it("기존 항목을 제거한 뒤 검토 완료 대체 미션을 추가한다", () => {
    const before: AssignMap = {
      2: [{ scenario_id: current.scenario_id, slot_role: "primary" }],
    };
    const removed = removeAssignment(before, 2, current.scenario_id);
    const candidates = filterManualCandidates([current, replacement], {
      act: "request",
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      assignments: removed,
    });
    expect(candidates.map((item) => item.scenario_id)).toEqual([
      "current",
      "replacement",
    ]);

    const replaced = addAssignment(removed, 2, replacement);
    expect(replaced[2]).toEqual([
      { scenario_id: "replacement", slot_role: "primary" },
    ]);
  });

  it("다른 주차에 이미 배정된 코어와 검토 전 미션은 후보·추가에서 차단한다", () => {
    const generated = core({
      scenario_id: "generated",
      mission_status: "generated",
    });
    const legacyMpj4 = core({
      scenario_id: "legacy-mpj4",
      is_native_mpj5: false,
    });
    const assignments: AssignMap = {
      2: [{ scenario_id: current.scenario_id, slot_role: "primary" }],
    };
    const candidates = filterManualCandidates(
      [current, replacement, generated, legacyMpj4],
      {
        act: "request",
        level: "intermediate",
        direction: "ko_zh",
        themes: ["campus_study"],
        assignments,
      },
    );
    expect(candidates.map((item) => item.scenario_id)).toEqual(["replacement"]);
    expect(addAssignment(assignments, 3, current)).toBe(assignments);
    expect(addAssignment(assignments, 3, generated)).toBe(assignments);
  });

  it("수동 후보·추가와 저장 전 검사도 해당 주차의 수행 모드를 강제한다", () => {
    const interpreting = core({
      scenario_id: "interpreting",
      mode: "stt_interpreting",
    });
    const candidates = filterManualCandidates([replacement, interpreting], {
      act: "request",
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      assignments: {},
      expectedModes: ["stt_interpreting", "stt_interpreting"],
    });
    expect(candidates.map((item) => item.scenario_id)).toEqual(["interpreting"]);
    expect(addAssignment({}, 9, replacement, ["stt_interpreting", "stt_interpreting"])).toEqual({});

    const issues = assignmentStructureIssues(
      { 9: [{ scenario_id: replacement.scenario_id, slot_role: "primary" }] },
      { replacement },
      [{ week_no: 9, type: "regular", speech_act: "request", scenario_slots: 2 }],
      "intermediate",
      "ko_zh",
      2,
      { courseMode: "interpreting", interpretingWeekCount: 12 },
    );
    expect(issues.map((issue) => issue.code)).toContain("course_mode");
  });

  it("같은 주차의 명백한 상황 복제본은 수동 후보와 저장 검사에서 제외한다", () => {
    const missionA = core({
      scenario_id: "mission-a",
      situation_ko: "교수에게 일정 변경을 요청한다.",
    });
    const duplicate = core({
      scenario_id: "duplicate",
      situation_ko: " 교수에게  일정 변경을 요청한다 ",
    });
    const newSituation = core({
      scenario_id: "new-situation",
      situation_ko: "기숙사 관리자에게 시설 수리를 요청한다.",
    });
    const coreById = {
      [missionA.scenario_id]: missionA,
      [duplicate.scenario_id]: duplicate,
      [newSituation.scenario_id]: newSituation,
    };
    const assignments: AssignMap = {
      2: [{ scenario_id: missionA.scenario_id, slot_role: "primary" }],
    };

    expect(filterManualCandidates([duplicate, newSituation], {
      act: "request",
      level: "intermediate",
      direction: "ko_zh",
      themes: ["campus_study"],
      assignments,
      weekNo: 2,
      coreById,
    }).map((item) => item.scenario_id)).toEqual(["new-situation"]);

    const issues = assignmentStructureIssues(
      { 2: [
        { scenario_id: missionA.scenario_id, slot_role: "primary" },
        { scenario_id: duplicate.scenario_id, slot_role: "primary" },
      ] },
      coreById,
      [{ week_no: 2, type: "regular", speech_act: "request", scenario_slots: 2 }],
      "intermediate",
      "ko_zh",
      2,
    );
    expect(issues.map((issue) => issue.code)).toContain("duplicate_situation");
  });

  it("수준·언어방향 변경 뒤 새 조건과 맞지 않는 기존 배정을 찾는다", () => {
    const assignments: AssignMap = {
      2: [
        { scenario_id: "current", slot_role: "primary" },
        { scenario_id: "wrong-direction", slot_role: "primary" },
      ],
      3: [{ scenario_id: "missing", slot_role: "primary" }],
    };
    const byId = {
      current,
      "wrong-direction": core({ scenario_id: "wrong-direction", direction: "zh_ko" }),
    };

    expect(
      incompatibleAssignmentIds(assignments, byId, "intermediate", "ko_zh"),
    ).toEqual(["wrong-direction", "missing"]);
  });

  it("주차 유형·화행·미션 수와 실제 배정의 충돌을 공통 검사한다", () => {
    const apology = core({ scenario_id: "apology", speech_act: "apology" });
    const assignments: AssignMap = {
      2: [
        { scenario_id: "current", slot_role: "primary" },
        { scenario_id: "apology", slot_role: "primary" },
      ],
      8: [{ scenario_id: "exam-item", slot_role: "primary" }],
    };
    const byId = {
      current,
      apology,
      "exam-item": core({ scenario_id: "exam-item" }),
    };
    const weeks = [
      { week_no: 2, type: "regular", speech_act: "request", scenario_slots: 1 },
      { week_no: 8, type: "midterm", speech_act: null, scenario_slots: 0 },
    ] as const;

    expect(
      assignmentStructureIssues(
        assignments,
        byId,
        [...weeks],
        "intermediate",
        "ko_zh",
        2,
      ).map((issue) => issue.code),
    ).toEqual(["too_many_items", "speech_act", "non_regular_week"]);
  });
});
