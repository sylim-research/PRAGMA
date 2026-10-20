import type { LearnerCourseWeek } from "./learnerCourse";
import { BASE_FEATURE_BY_ACT, getTargetFeature } from "@/lib/pragma/targetFeatures";
import { refusalTeachingCaseFor } from "./refusalTeachingCase";

/** 고유 교수자 설명의 단일 원본. 공용 출력 모델에서는 가져오지 않는다. */
export function weeklyInstructorContent(week: LearnerCourseWeek, direction: string) {
  const missionCases = week.speech_act === "refusal" ? week.scenarios.flatMap((scenario) => {
    const teachingCase = refusalTeachingCaseFor(scenario, direction);
    return teachingCase ? [teachingCase] : [];
  }) : [];
  return {
    // 무관한 주차의 검수 해시를 바꾸지 않도록 빈 속성은 추가하지 않는다.
    ...(missionCases.length ? { missionCases } : {}),
    features: (week.speech_act ? BASE_FEATURE_BY_ACT[week.speech_act] : []).flatMap((code) => {
      const feature = getTargetFeature(code);
      return feature ? [{ code, label: feature.learner_label,
        note: direction === "zh_ko" ? feature.counter_rule_note_zh_ko ?? feature.counter_rule_note : feature.counter_rule_note,
        confounds: direction === "zh_ko" ? feature.excluded_confounds_zh_ko ?? feature.excluded_confounds : feature.excluded_confounds,
      }] : [];
    }),
    procedure: "주차의 목표와 핵심 설명을 확인한 뒤 편성된 미션으로 연결합니다. 수행 후에는 학생이 선택·수정한 이유를 기존 기록과 함께 확인합니다.",
  };
}
