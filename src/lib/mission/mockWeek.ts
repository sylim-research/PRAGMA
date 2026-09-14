// 주차 상세 mock — speech_act 유형의 요청 주차 1개만.
// 주차별 실제 학습 내용 구성은 추후 지시 예정. 여기서는 구조와 연결만 만든다.
//
// 전략지도 개방 여부는 여기 고정 필드가 아니라 LearnerFeatureState에서 읽는다
// (featureId로 연결). 이중 루프의 단계 이름은 학습자 언어로만 노출한다:
//   처음 배우기(도입 아크) / 직접 연습(일반 미션) / 상황 바꿔보기(전이) / 실력 점검(앵커)

import { getProgress } from "@/lib/mission/learnerState";

export type WeekType = "speech_act"; // 추후: "integration" | "assessment" 등

export interface WeekPracticeItem {
  missionId: string;
  label: string;
  mode: "quick" | "transfer";
  /** 이번 커밋에서 실제로 열 수 있는 항목만 true (나머지는 mock 표시) */
  available: boolean;
}

export const WEEK_REQUEST = {
  weekNo: 2,
  weekType: "speech_act" as WeekType,
  speechAct: "요청",
  title: "요청",
  featureId: "request_directness_mitigation",
  keyIdea: "부탁을 너무 직접적이거나 과하게 격식적으로 만들지 않기",
  stages: {
    intro: {
      label: "처음 배우기",
      desc: "결과 보기 → 단서 추리 → 원리 연결 → 적용 판단",
      // 요청 주차 샘플 도입 화면. 완료 상태 저장은 learnerState가 담당한다.
      mockCompleted: true,
    },
    practice: {
      label: "직접 연습",
      items: [
        { missionId: "w2-practice-wechat", label: "위챗 · 동급생", mode: "quick", available: true },
        { missionId: "w2-practice-email", label: "이메일 · 교수", mode: "quick", available: false },
        { missionId: "w2-practice-f2f", label: "대면 · 친구", mode: "quick", available: false },
        { missionId: "w2-practice-leader", label: "위챗 · 조장", mode: "quick", available: false },
      ] as WeekPracticeItem[],
    },
    transfer: {
      label: "상황 바꿔보기",
      desc: "한 조건만 바꿔 다시 표현하기",
      item: {
        missionId: "w2-transfer-1",
        label: "상대·매체 변경 (동급생·위챗 → 교수·이메일)",
        mode: "transfer",
        available: true,
      } as WeekPracticeItem,
    },
    anchor: {
      label: "실력 점검",
      desc: "힌트 없이 판단하고 표현하기",
      // AnchorMission 후보 엔진(MissionShell)은 별도 감사 후 연결 — 이번엔 잠금 표시만
      locked: true,
      lockedNote: "공개 예정",
    },
  },
};

/** mode → missionId (PracticeMission이 세션 키·완료 기록에 사용) */
export const MISSION_ID_BY_MODE: Record<"quick" | "transfer", string> = {
  quick: "w2-practice-wechat",
  transfer: "w2-transfer-1",
};

// ── 오늘의 학습 배정 (mock 엔진) ──
// 배정 이유 한 줄을 함께 돌려준다 — 보이지 않는 결정은 불신을 만든다.

export interface TodayAssignment {
  missionId: string;
  mode: "quick" | "transfer";
  title: string;
  minutes: number;
  reason: string;
  /** 이번 주 연습을 다 끝낸 상태 */
  allDone?: boolean;
}

/** 주차 진행률 (mock): 도입 1 + 활성 연습 1 + 전이 1 = 분모 3 */
export function getWeekProgress(): { done: number; total: number } {
  const progress = getProgress();
  let done = WEEK_REQUEST.stages.intro.mockCompleted ? 1 : 0;
  if (progress.completedMissionIds.includes(MISSION_ID_BY_MODE.quick)) done += 1;
  if (progress.completedMissionIds.includes(MISSION_ID_BY_MODE.transfer)) done += 1;
  return { done, total: 3 };
}
