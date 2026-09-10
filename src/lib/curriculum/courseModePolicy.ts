import type { GenMode } from "@/lib/pragma/enums";

export const COURSE_MODES = ["translation", "mixed", "interpreting"] as const;
export type CourseMode = (typeof COURSE_MODES)[number];

/** 9개 목표 화행을 직접 학습하는 주차. */
export const TARGET_SPEECH_ACT_WEEK_NOS = [2, 3, 4, 5, 6, 9, 10, 11, 12] as const;
/** 기존 주수 필드의 읽기·저장 호환에만 사용한다. 현행 모드 배분의 분모가 아니다. */
export const ACTUAL_LEARNING_WEEK_NOS = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14] as const;
export const ACTUAL_LEARNING_WEEK_COUNT = ACTUAL_LEARNING_WEEK_NOS.length;
/** 9화행 학습과 선택 화행 보완. 클리닉·OT·시험에는 새 미션을 배정하지 않는다. */
export const MISSION_WEEK_NOS = [...TARGET_SPEECH_ACT_WEEK_NOS, 13] as const;
export const WEEKLY_LEARNING_CONTRACT = "speech-act-translation-interpreting-v1" as const;

export interface CourseModePolicy {
  courseMode: CourseMode;
  /** 과거 DB 값의 호환용. 현행 미션 모드 결정에는 사용하지 않는다. */
  interpretingWeekCount?: number;
}

export function isCourseModePolicyValid(policy: CourseModePolicy): boolean {
  return COURSE_MODES.includes(policy.courseMode);
}

/** legacy 비율은 역사값으로만 읽고 가장 가까운 12주 정수 정책으로 한 번 해석한다. */
export function courseModePolicyFromLegacyRatio(ratio: number | null | undefined): CourseModePolicy & { interpretingWeekCount: number } {
  const finiteRatio = typeof ratio === "number" && Number.isFinite(ratio) ? ratio : 0;
  const interpretingWeekCount = Math.max(
    0,
    Math.min(ACTUAL_LEARNING_WEEK_COUNT, Math.round(finiteRatio * ACTUAL_LEARNING_WEEK_COUNT)),
  );
  if (interpretingWeekCount === 0) return { courseMode: "translation", interpretingWeekCount };
  if (interpretingWeekCount === ACTUAL_LEARNING_WEEK_COUNT) {
    return { courseMode: "interpreting", interpretingWeekCount };
  }
  return { courseMode: "mixed", interpretingWeekCount };
}

/** 유형별 두 완결 미션. 통번역형은 모든 화행 주차에서 번역·통역을 하나씩 수행한다. */
export function expectedMissionModesForWeek(
  policy: CourseModePolicy,
  weekNo: number,
): GenMode[] {
  if (!isCourseModePolicyValid(policy) || !(MISSION_WEEK_NOS as readonly number[]).includes(weekNo)) return [];
  if (policy.courseMode === "translation") return ["translation", "translation"];
  if (policy.courseMode === "interpreting") return ["stt_interpreting", "stt_interpreting"];
  return ["translation", "stt_interpreting"];
}

/** 부분 편성의 남은 슬롯을 계산한다. 같은 모드가 정원을 초과하면 무효다. */
export function remainingMissionModes(expected: readonly GenMode[], assigned: readonly GenMode[]): GenMode[] | null {
  const remaining = [...expected];
  for (const mode of assigned) {
    const index = remaining.indexOf(mode);
    if (index < 0) return null;
    remaining.splice(index, 1);
  }
  return remaining;
}

export function missionModesSummary(modes: readonly GenMode[]): string {
  return (["translation", "stt_interpreting"] as const).flatMap((mode) => {
    const count = modes.filter((item) => item === mode).length;
    return count ? [`${mode === "translation" ? "번역" : "통역"} ${count}개`] : [];
  }).join(" · ");
}

export const COURSE_MODE_LABEL: Record<CourseMode, string> = {
  translation: "번역",
  interpreting: "통역",
  mixed: "통번역 반반",
};

export function courseModeSummary(policy: CourseModePolicy): string {
  return COURSE_MODE_LABEL[policy.courseMode] ?? "수행 유형 확인 필요";
}
