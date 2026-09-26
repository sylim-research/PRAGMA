import type { ComposerCore } from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";
import type { CourseMode } from "@/lib/curriculum/courseModePolicy";
import type { LanguageDirection, LearnerLevel } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

export const COMPOSITION_LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
export const COMPOSITION_DIRECTIONS: LanguageDirection[] = ["ko_zh", "zh_ko"];

export interface CompositionConditions {
  level: LearnerLevel;
  direction: LanguageDirection;
  courseMode: CourseMode;
  themes: ThemeCode[];
}

/** 조건(수준·방향·비율·주제)에 맞고 검수가 끝난 미션 수. 기존 편성과 새 편성이 같은 기준을 쓴다. */
export function countAvailableMissions(cores: ComposerCore[], c: CompositionConditions): number {
  return cores.filter(
    (core) =>
      core.direction === c.direction &&
      core.learner_level === c.level &&
      isReviewedMission(core) &&
      core.is_native_mpj5 &&
      (c.courseMode === "mixed" ||
        (c.courseMode === "translation" ? core.mode === "translation" : core.mode === "stt_interpreting")) &&
      (c.themes.length === 0 || c.themes.includes(core.theme_code as ThemeCode)),
  ).length;
}

export function courseModeHint(courseMode: CourseMode): string {
  return `주차마다 ${courseMode === "mixed" ? "번역·통역 미션을 1개씩" : courseMode === "interpreting" ? "통역 미션 2개를" : "번역 미션 2개를"}, 서로 다른 상황으로 배치합니다.`;
}


/** 조건에 맞는 검토 완료 미션(편성 후보)만 남긴다 — countAvailableMissions와 같은 기준. */
export function eligibleMissions(cores: ComposerCore[], c: CompositionConditions): ComposerCore[] {
  return cores.filter(
    (core) =>
      core.direction === c.direction &&
      core.learner_level === c.level &&
      isReviewedMission(core) &&
      core.is_native_mpj5 &&
      (c.courseMode === "mixed" ||
        (c.courseMode === "translation" ? core.mode === "translation" : core.mode === "stt_interpreting")) &&
      (c.themes.length === 0 || c.themes.includes(core.theme_code as ThemeCode)),
  );
}

/** 화행 하나에 대해 번역·통역 후보가 각각 몇 개인지. 새 교과목 미리보기용. */
export function eligibleByMode(eligible: ComposerCore[], act: string): { translation: number; interpreting: number } {
  let translation = 0;
  let interpreting = 0;
  for (const core of eligible) {
    if (core.speech_act !== act) continue;
    if (core.mode === "stt_interpreting") interpreting += 1;
    else translation += 1;
  }
  return { translation, interpreting };
}
