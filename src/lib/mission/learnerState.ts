// 학습자 로컬 상태(mock) — 이중 루프 배정·전략지도 개방 판정의 최소 저장소.
// 전부 localStorage 기반이며 백엔드 없음. 앵커·평가 답안은 여기 저장하지 않는다.

const LEARNER_ID_KEY = "dev-learner-id";

export function getLearnerId(): string {
  try {
    let id = localStorage.getItem(LEARNER_ID_KEY);
    if (!id) {
      id = "local";
      localStorage.setItem(LEARNER_ID_KEY, id);
    }
    return id;
  } catch {
    return "local";
  }
}

// ── 특징(전략군) 단위 상태 — 전략지도 개방 판정 ──
// 개방 조건: 도입 아크의 명시 설명 도달 ∨ 일반 미션 최초 수행 완료.
// (같은 산출 문항의 복사 가능한 답안만 최초 수행 전 금지 — 지도 자체는 잠그지 않는다)

export interface LearnerFeatureState {
  introExplanationCompleted: boolean;
  firstPerformanceCompleted: boolean;
  strategyMapUnlocked: boolean;
}

const featureKey = (featureId: string) => `learner-feature:${getLearnerId()}:${featureId}:v1`;

const EMPTY_FEATURE: LearnerFeatureState = {
  introExplanationCompleted: false,
  firstPerformanceCompleted: false,
  strategyMapUnlocked: false,
};

export function getFeatureState(featureId: string): LearnerFeatureState {
  try {
    const raw = localStorage.getItem(featureKey(featureId));
    if (!raw) return { ...EMPTY_FEATURE };
    return { ...EMPTY_FEATURE, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_FEATURE };
  }
}

export function updateFeatureState(featureId: string, patch: Partial<LearnerFeatureState>) {
  const cur = getFeatureState(featureId);
  const next: LearnerFeatureState = { ...cur, ...patch };
  next.strategyMapUnlocked =
    next.introExplanationCompleted || next.firstPerformanceCompleted;
  try {
    localStorage.setItem(featureKey(featureId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// ── 진행 상태 — 홈 '오늘의 학습' 추천이 이걸 읽는다 ──

export interface LearnerProgress {
  completedMissionIds: string[];
  practiceCount: number;
  /** 다음에 하도록 배정된 활동 id (mock 배정 엔진의 커서) */
  currentActivityId: string | null;
}

const progressKey = () => `learner-progress:${getLearnerId()}:v1`;

const EMPTY_PROGRESS: LearnerProgress = {
  completedMissionIds: [],
  practiceCount: 0,
  currentActivityId: null,
};

export function getProgress(): LearnerProgress {
  try {
    const raw = localStorage.getItem(progressKey());
    if (!raw) return { ...EMPTY_PROGRESS };
    return { ...EMPTY_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}
