export type InstructorGuideTimingPreset = 30 | 50 | 90;

export type InstructorGuideTimingActivity = {
  id: string;
  labelKo: string;
  minutes: number;
  howKo: string;
  outputKo: string;
};

export type InstructorGuideTimingPlan = {
  preset: InstructorGuideTimingPreset;
  labelKo: string;
  descriptionKo: string;
  activities: readonly InstructorGuideTimingActivity[];
};

export type InstructorGuideMissionIdentity = {
  scenarioId: string;
  speechAct: string | null;
  learnerLevel: string | null;
  mode: string | null;
  direction: string;
};

const TIMING_PLANS: Record<InstructorGuideTimingPreset, InstructorGuideTimingPlan> = {
  30: {
    preset: 30,
    labelKo: "미션 1세트 기본 운영",
    descriptionKo: "MJT5+DCT1 수행 20분과 class discussion·5 POINT LESSON 10분을 운영합니다.",
    activities: [
      {
        id: "mission-a",
        labelKo: "MJT5+DCT1 미션 1세트 수행",
        minutes: 20,
        howKo: "학습자가 MJT5를 판단하고 DCT 초안→최소 피드백→수정안을 완성합니다.",
        outputKo: "MJT5 판단·근거와 DCT 초안·수정안",
      },
      {
        id: "discussion-a",
        labelKo: "Class discussion · 5 POINT LESSON",
        minutes: 10,
        howKo: "판단 근거와 표현의 관계적 효과를 비교하고 한 가지 조정점을 정리합니다.",
        outputKo: "화행 판단 근거 1개와 표현 조정점 1개",
      },
    ],
  },
  50: {
    preset: 50,
    labelKo: "미션 1세트 확장 운영",
    descriptionKo: "기본 30분 수행 뒤 수정·참고안 비교와 다른 맥락 전이를 확장합니다.",
    activities: [
      {
        id: "briefing",
        labelKo: "상황·P/D/R 브리핑",
        minutes: 5,
        howKo: "핵심 관계·부담 단서와 이번 화행의 판단 초점을 확인합니다.",
        outputKo: "핵심 상황 단서",
      },
      {
        id: "mission-a",
        labelKo: "MJT5+DCT1 미션 1세트 수행",
        minutes: 20,
        howKo: "MJT5 판단과 DCT 초안→최소 피드백→수정안을 수행합니다.",
        outputKo: "MJT5 판단·근거와 DCT 초안·수정안",
      },
      {
        id: "discussion-a",
        labelKo: "Class discussion · 5 POINT LESSON",
        minutes: 15,
        howKo: "경계형 표현과 복수 허용안의 관계적 효과를 비교합니다.",
        outputKo: "공동 판단 근거와 조정 원리",
      },
      {
        id: "reference",
        labelKo: "수정안·참고안 비교",
        minutes: 5,
        howKo: "수정 완료 뒤 참고안을 공개해 공통점과 차이를 확인합니다.",
        outputKo: "나의 수정 포인트",
      },
      {
        id: "transfer",
        labelKo: "다른 맥락으로 전이",
        minutes: 5,
        howKo: "관계·부담·매체 중 한 조건을 바꾸고 표현 하나를 조정합니다.",
        outputKo: "재맥락화 표현 1개",
      },
    ],
  },
  90: {
    preset: 90,
    labelKo: "같은 화행 두 미션 통합 운영",
    descriptionKo: "같은 화행의 독립 미션 1·2를 각각 30분 운영하고 두 수행의 판단 근거를 30분간 비교·적용합니다.",
    activities: [
      {
        id: "mission-a",
        labelKo: "미션 1 수행",
        minutes: 20,
        howKo: "첫 번째 MJT5+DCT1을 최초 판단부터 DCT 수정까지 수행합니다.",
        outputKo: "미션 1 수행 결과",
      },
      {
        id: "discussion-a",
        labelKo: "미션 1 discussion · 5 POINT LESSON",
        minutes: 10,
        howKo: "미션 1의 핵심 상황 단서와 표현 조정점을 정리합니다.",
        outputKo: "미션 1 판단 근거",
      },
      {
        id: "mission-b",
        labelKo: "미션 2 수행",
        minutes: 20,
        howKo: "같은 화행의 두 번째 MJT5+DCT1을 독립적으로 수행합니다.",
        outputKo: "미션 2 수행 결과",
      },
      {
        id: "discussion-b",
        labelKo: "미션 2 discussion · 5 POINT LESSON",
        minutes: 10,
        howKo: "미션 2의 핵심 상황 단서와 표현 조정점을 정리합니다.",
        outputKo: "미션 2 판단 근거",
      },
      {
        id: "compare",
        labelKo: "미션 1·2 판단 근거 비교",
        minutes: 20,
        howKo: "독립적인 두 상황에서 선택하고 수정한 근거의 공통점과 차이를 나란히 정리합니다.",
        outputKo: "두 미션 비교표와 공통 판단 원리",
      },
      {
        id: "transfer",
        labelKo: "새 상황 적용·출구 활동",
        minutes: 10,
        howKo: "새로운 상황에 표현을 적용하고 조정 이유를 한 문장으로 설명합니다.",
        outputKo: "새 상황 표현과 조정 이유",
      },
    ],
  },
};

export const INSTRUCTOR_GUIDE_TIMING_PRESETS = [30, 50, 90] as const;

export function instructorGuideTimingPlan(preset: InstructorGuideTimingPreset) {
  return TIMING_PLANS[preset];
}

export function instructorGuideTimingTotal(plan: InstructorGuideTimingPlan) {
  return plan.activities.reduce((total, activity) => total + activity.minutes, 0);
}

export function parseInstructorGuideTimingPreset(value: string | null): InstructorGuideTimingPreset {
  return value === "50" || value === "90" ? Number(value) as InstructorGuideTimingPreset : 30;
}

export function isCompatibleInstructorGuideSecondary(
  first: InstructorGuideMissionIdentity,
  candidate: InstructorGuideMissionIdentity,
) {
  return first.scenarioId !== candidate.scenarioId
    && first.speechAct === candidate.speechAct
    && first.learnerLevel === candidate.learnerLevel
    && first.mode === candidate.mode
    && first.direction === candidate.direction;
}

export function instructorGuideSequencePath(firstScenarioId: string, secondScenarioId: string) {
  const params = new URLSearchParams({
    mission: firstScenarioId,
    mission2: secondScenarioId,
    timing: "90",
  });
  return `/admin/package?${params.toString()}`;
}

export function shouldClearInstructorGuideSecondary(
  loading: boolean,
  requestedScenarioId: string,
  resolvedScenarioId: string | null,
) {
  return !loading && requestedScenarioId.length > 0 && resolvedScenarioId === null;
}
