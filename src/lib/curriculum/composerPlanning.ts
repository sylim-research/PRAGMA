import type { CurriculumWeekRow } from "@/lib/curriculum/types";
import type { ComposerCore } from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";
import type {
  GenMode,
  LanguageDirection,
  LearnerLevel,
  SpeechActUI,
} from "@/lib/pragma/enums";
import {
  ACTUAL_LEARNING_WEEK_NOS,
  expectedCoreModeForWeek,
  interpretingTargetWeekNumbers,
  isCourseModePolicyValid,
  type CourseModePolicy,
} from "@/lib/curriculum/courseModePolicy";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import { isReinforcementWeek, previouslyLearnedActs, REINFORCEMENT_WEEK } from "./weekGuidance";
import {
  weeklyMissionPairIssues,
  type WeeklyMissionPairAssignment,
  type WeeklyMissionPairIssueCode,
} from "@/lib/curriculum/weeklyMissionPair";

export type AssignedItem = WeeklyMissionPairAssignment & { slot_role: string };
export type AssignMap = Record<number, AssignedItem[]>;
type PlanningWeek = Pick<
  CurriculumWeekRow,
  "week_no" | "type" | "speech_act" | "scenario_slots"
>;

export const slotRoleFor = (core: ComposerCore): string =>
  core.mode === "stt_interpreting" ? "interpreting" : "primary";

export interface AutoFillOptions {
  weeks: PlanningWeek[];
  cores: ComposerCore[];
  level: LearnerLevel;
  direction: LanguageDirection;
  themes: ThemeCode[];
  courseModePolicy: CourseModePolicy;
  /** 기존 outline 호출 호환용. 표준 화행 주차 자동 편성은 항상 두 미션이다. */
  defaultScenariosPerWeek: number;
  /** 선택 주제가 부족할 때 다른 주제로 넓힐지 여부. 교수자의 명시 조작만 허용한다. */
  allowThemeExpansion?: boolean;
}

export interface AutoFillResult {
  assignments: AssignMap;
  filledWeeks: number;
  totalAssigned: number;
  shortages: Array<{ weekNo: number; missingSlots: number }>;
  expandedThemeWeeks: number[];
  interpretingWeekNumbers: number[];
}

/**
 * 15주 골격의 화행 주차를 검토 완료 미션으로 채운다.
 * 주제는 기본적으로 엄수한다. 다른 주제로 넓히는 것은 UI에서 교수가 명시적으로
 * 승인해 allowThemeExpansion=true를 넘긴 경우에만 허용한다.
 */
export function buildAutomaticAssignments(options: AutoFillOptions): AutoFillResult {
  const {
    weeks,
    cores,
    level,
    direction,
    themes,
    courseModePolicy,
    allowThemeExpansion = false,
  } = options;
  if (!isCourseModePolicyValid(courseModePolicy)) {
    throw new Error("강좌 수행모드와 통역 주차 수가 일치하지 않습니다.");
  }
  const assignments: AssignMap = {};
  const usedIds = new Set<string>();
  const shortages: AutoFillResult["shortages"] = [];
  const expandedThemeWeeks: number[] = [];
  const learningWeekNumbers = ACTUAL_LEARNING_WEEK_NOS.filter((weekNo) =>
    weeks.some((week) => week.week_no === weekNo),
  );
  const interpretingWeekNumbers = interpretingTargetWeekNumbers(
    courseModePolicy,
    learningWeekNumbers,
  );
  let filledWeeks = 0;

  for (const week of weeks) {
    if (week.type !== "regular" || !week.speech_act) continue;
    if (isReinforcementWeek(week) && !previouslyLearnedActs(weeks).includes(week.speech_act as SpeechActUI)) continue;
    const act = week.speech_act as SpeechActUI;
    const slots = 2;
    const expectedMode = expectedCoreModeForWeek(
      courseModePolicy,
      week.week_no,
      learningWeekNumbers,
    );
    const isBaseEligible = (core: ComposerCore) =>
      isReviewedMission(core) &&
      core.is_native_mpj5 &&
      !usedIds.has(core.scenario_id) &&
      core.speech_act === act &&
      core.learner_level === level &&
      core.direction === direction &&
      core.mode === expectedMode;

    let candidates = cores.filter(
      (core) =>
        isBaseEligible(core) &&
        (themes.length === 0 ||
          (core.theme_code != null && themes.includes(core.theme_code))),
    );
    let picked = pickDistinctSituationMissions(candidates, slots);
    if (themes.length > 0 && picked.length < slots && allowThemeExpansion) {
      candidates = cores.filter(isBaseEligible);
      picked = pickDistinctSituationMissions(candidates, slots);
      if (picked.length === slots) expandedThemeWeeks.push(week.week_no);
    }

    if (picked.length < slots) {
      shortages.push({ weekNo: week.week_no, missingSlots: slots });
      continue;
    }
    picked.forEach((core) => usedIds.add(core.scenario_id));
    assignments[week.week_no] = picked.map((core) => ({
      scenario_id: core.scenario_id,
      slot_role: slotRoleFor(core),
    }));
    filledWeeks += 1;
  }

  return {
    assignments,
    filledWeeks,
    totalAssigned: Object.values(assignments).reduce(
      (sum, items) => sum + items.length,
      0,
    ),
    shortages,
    expandedThemeWeeks,
    interpretingWeekNumbers,
  };
}

export function assignedScenarioIds(assignments: AssignMap): Set<string> {
  return new Set(
    Object.values(assignments).flatMap((items) =>
      items.map((item) => item.scenario_id),
    ),
  );
}

export interface ManualCandidateOptions {
  act: SpeechActUI | null;
  level: LearnerLevel;
  direction: LanguageDirection;
  themes: ThemeCode[];
  assignments: AssignMap;
  expectedMode?: GenMode | null;
  weekNo?: number;
  coreById?: Record<string, ComposerCore>;
}

function normalizedSituation(core: ComposerCore): string {
  return core.situation_ko
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase();
}

export function hasSameSituation(
  first: ComposerCore,
  second: ComposerCore,
): boolean {
  const firstSituation = normalizedSituation(first);
  return firstSituation.length > 0 && firstSituation === normalizedSituation(second);
}

/** 후보 순서를 보존하되 같은 상황문의 명백한 복제본은 한 주차에 함께 고르지 않는다. */
export function pickDistinctSituationMissions(
  candidates: readonly ComposerCore[],
  count: number,
): ComposerCore[] {
  const picked: ComposerCore[] = [];
  for (const candidate of candidates) {
    if (picked.some((item) => hasSameSituation(item, candidate))) continue;
    picked.push(candidate);
    if (picked.length === count) break;
  }
  return picked;
}

/** 수동 교체 후보도 자동 편성과 같은 절대 조건, 강좌 중복, 명백한 상황 복제 금지를 적용한다. */
export function filterManualCandidates(
  candidates: ComposerCore[],
  options: ManualCandidateOptions,
): ComposerCore[] {
  if (options.weekNo === REINFORCEMENT_WEEK && !options.act) return [];
  const usedIds = assignedScenarioIds(options.assignments);
  const weekCores = options.weekNo == null || !options.coreById
    ? []
    : (options.assignments[options.weekNo] ?? [])
        .map((item) => options.coreById?.[item.scenario_id])
        .filter((core): core is ComposerCore => core != null);
  return candidates.filter(
    (core) =>
      isReviewedMission(core) &&
      core.is_native_mpj5 &&
      !usedIds.has(core.scenario_id) &&
      (options.act ? core.speech_act === options.act : true) &&
      core.learner_level === options.level &&
      core.direction === options.direction &&
      (options.expectedMode ? core.mode === options.expectedMode : true) &&
      !weekCores.some((assigned) => hasSameSituation(assigned, core)) &&
      (options.themes.length === 0 ||
        (core.theme_code != null && options.themes.includes(core.theme_code))),
  );
}

export function removeAssignment(
  assignments: AssignMap,
  weekNo: number,
  scenarioId: string,
): AssignMap {
  return {
    ...assignments,
    [weekNo]: (assignments[weekNo] ?? []).filter(
      (item) => item.scenario_id !== scenarioId,
    ),
  };
}

/**
 * 검토 완료 미션만 추가한다. 같은 강좌의 어느 주차든 이미 사용된 코어면 거부한다.
 * 반환 참조가 같으면 추가가 거부된 것이다.
 */
export function addAssignment(
  assignments: AssignMap,
  weekNo: number,
  core: ComposerCore,
  expectedMode?: GenMode | null,
): AssignMap {
  if (
    !isReviewedMission(core) ||
    assignedScenarioIds(assignments).has(core.scenario_id) ||
    (expectedMode ? core.mode !== expectedMode : false)
  ) {
    return assignments;
  }
  return {
    ...assignments,
    [weekNo]: [
      ...(assignments[weekNo] ?? []),
      { scenario_id: core.scenario_id, slot_role: slotRoleFor(core) },
    ],
  };
}

export function duplicateScenarioIds(assignments: AssignMap): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const items of Object.values(assignments)) {
    for (const item of items) {
      if (seen.has(item.scenario_id)) duplicates.add(item.scenario_id);
      seen.add(item.scenario_id);
    }
  }
  return [...duplicates];
}

/** 선택한 수준·언어방향과 맞지 않는 기존 배정을 찾아 저장 전에 차단한다. */
export function incompatibleAssignmentIds(
  assignments: AssignMap,
  coreById: Record<string, ComposerCore>,
  level: LearnerLevel,
  direction: LanguageDirection,
): string[] {
  return [...assignedScenarioIds(assignments)].filter((scenarioId) => {
    const core = coreById[scenarioId];
    return !core || core.learner_level !== level || core.direction !== direction;
  });
}

export type AssignmentStructureIssueCode =
  | "missing_core"
  | "unreviewed"
  | "level"
  | "direction"
  | "missing_week"
  | "non_regular_week"
  | "speech_act"
  | "reinforcement_act_required"
  | "reinforcement_act_not_learned"
  | "course_mode_policy"
  | "course_mode"
  | "too_many_items"
  | "duplicate_situation"
  | WeeklyMissionPairIssueCode;

export interface AssignmentStructureIssue {
  weekNo: number;
  scenarioId?: string;
  code: AssignmentStructureIssueCode;
}

/**
 * 강좌 설정·주차 계획과 실제 미션 배정 사이의 공통 불변조건 검사.
 * Composer 저장과 주차 계획 저장이 같은 검사를 사용해 한쪽 경로의 누수를 막는다.
 */
export function assignmentStructureIssues(
  assignments: AssignMap,
  coreById: Record<string, ComposerCore>,
  weeks: PlanningWeek[],
  level: LearnerLevel,
  direction: LanguageDirection,
  defaultScenariosPerWeek: number,
  courseModePolicy?: CourseModePolicy,
): AssignmentStructureIssue[] {
  const issues: AssignmentStructureIssue[] = [];
  const weekByNo = new Map(weeks.map((week) => [week.week_no, week]));
  const learningWeekNumbers = ACTUAL_LEARNING_WEEK_NOS.filter((weekNo) =>
    weeks.some((week) => week.week_no === weekNo),
  );
  if (courseModePolicy && !isCourseModePolicyValid(courseModePolicy)) {
    issues.push({ weekNo: 0, code: "course_mode_policy" });
  }

  for (const [weekNoText, items] of Object.entries(assignments)) {
    const weekNo = Number(weekNoText);
    const week = weekByNo.get(weekNo);
    if (!week) {
      issues.push({ weekNo, code: "missing_week" });
      continue;
    }
    if (week.type !== "regular") {
      if (items.length > 0) issues.push({ weekNo, code: "non_regular_week" });
      continue;
    }
    const reinforcement = isReinforcementWeek(week);
    const slots = reinforcement ? 2 : week.scenario_slots ?? defaultScenariosPerWeek;
    if (reinforcement && items.length > 0) {
      if (!week.speech_act) issues.push({ weekNo, code: "reinforcement_act_required" });
      else if (!previouslyLearnedActs(weeks).includes(week.speech_act as SpeechActUI)) {
        issues.push({ weekNo, code: "reinforcement_act_not_learned" });
      }
    }
    const expectedMode = courseModePolicy && isCourseModePolicyValid(courseModePolicy)
      ? expectedCoreModeForWeek(courseModePolicy, weekNo, learningWeekNumbers)
      : null;
    if (items.length > slots) issues.push({ weekNo, code: "too_many_items" });

    for (const item of items) {
      const core = coreById[item.scenario_id];
      if (!core) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "missing_core" });
        continue;
      }
      if (!isReviewedMission(core)) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "unreviewed" });
      }
      if (core.learner_level !== level) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "level" });
      }
      if (core.direction !== direction) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "direction" });
      }
      if (week.speech_act && core.speech_act !== week.speech_act) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "speech_act" });
      }
      if (expectedMode && core.mode !== expectedMode) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "course_mode" });
      }
    }

    const knownCores = items
      .map((item) => coreById[item.scenario_id])
      .filter((core): core is ComposerCore => core != null);
    for (let index = 1; index < knownCores.length; index += 1) {
      if (
        knownCores
          .slice(0, index)
          .some((core) => hasSameSituation(core, knownCores[index]))
      ) {
        issues.push({
          weekNo,
          scenarioId: knownCores[index].scenario_id,
          code: "duplicate_situation",
        });
      }
    }

    for (const pairIssue of weeklyMissionPairIssues(items, coreById)) {
      issues.push({
        weekNo,
        scenarioId: pairIssue.scenarioId,
        code: pairIssue.code,
      });
    }
  }

  return issues;
}
