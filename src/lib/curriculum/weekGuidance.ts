import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";

type GuidanceWeek = { week_no: number; type: string; speech_act: string | null; title?: string | null };

export const REINFORCEMENT_WEEK = 13;
export const REINFORCEMENT_TITLE = "선택 화행 집중 보완";
export const REINFORCEMENT_DESCRIPTION = "교강사가 기학습 화행 하나를 선택해 새 상황의 미션 두 개로 집중 보완합니다. 수행 결과는 14주 종합 토론으로 이어집니다.";
export const CENTRAL_QUESTION_GUIDANCE = "중심 질문은 수업의 방향을 안내하는 대표 질문입니다. 관계(P)·거리(D)·부담(R), 상황과 원문의 의도에 따라 구체화하거나 바꿔 사용할 수 있습니다. 특정 표현 전략이나 정답을 요구하지 않습니다.";

// 수업 안내 전용. 생성·검수 통과 조건, 평가 준거, 내부 진단 태그로 사용하지 않는다.
const ACT_QUESTIONS: Record<SpeechActUI, string> = {
  request: "이 상황에서 요청의 뜻을 어떻게 전달하는 것이 적절한가?",
  thanks: "이 상황의 도움과 관계에 맞게 감사의 뜻을 어떻게 전할까?",
  compliment: "이 상황에서 칭찬의 의도와 표현은 어떻게 받아들여질까?",
  agreement: "이 상황에서 함께하자는 뜻을 어떻게 전하는 것이 적절한가?",
  refusal: "이 상황에서 거절의 뜻과 태도를 어떻게 전달할까?",
  apology: "이 상황에서 사과의 뜻과 태도를 어떻게 전달하는 것이 적절한가?",
  proposal: "이 상황에서 제안의 취지가 어떻게 이해되도록 전달할까?",
  opposition: "이 상황에서 다른 의견을 어떻게 전달하는 것이 적절한가?",
  complaint: "이 상황에서 무엇에 대한 불만이며, 어떻게 전달하는 것이 적절한가?",
};

export function isReinforcementWeek(week: Pick<GuidanceWeek, "week_no" | "type">): boolean {
  return week.week_no === REINFORCEMENT_WEEK && week.type === "regular";
}

/** 선택지는 실제 앞선 주차의 계획에서 얻는다. 교강사 대신 자동 선택하지 않는다. */
export function previouslyLearnedActs(weeks: readonly GuidanceWeek[]): SpeechActUI[] {
  return [...new Set(weeks
    .filter((week) => week.type === "regular" && week.week_no < REINFORCEMENT_WEEK)
    .map((week) => week.speech_act)
    .filter((act): act is SpeechActUI => act != null && Object.prototype.hasOwnProperty.call(SPEECH_ACT_UI, act)))];
}

/** 화행·활동 표시 전용. 저장 제목과 역사적 편성은 재작성하지 않는다. */
export function weekActivityLabel(week: GuidanceWeek): string {
  if (isReinforcementWeek(week)) return REINFORCEMENT_TITLE;
  if (week.speech_act && Object.prototype.hasOwnProperty.call(SPEECH_ACT_UI, week.speech_act)) {
    return SPEECH_ACT_UI[week.speech_act as SpeechActUI];
  }
  return week.title?.trim() || `${week.week_no}주차`;
}

export function weekCentralQuestion(week: GuidanceWeek): string | null {
  if (isReinforcementWeek(week)) {
    return "선택한 화행에서 다시 살펴볼 판단은 무엇이며, 새 상황에서는 어떻게 적용할까?";
  }
  if (week.type === "orientation") {
    return "누가 누구에게 무엇을 전달하며, 원문의 의미·의도와 수신자의 해석을 어떻게 함께 고려할까?";
  }
  if (week.type === "midterm" || week.type === "final") return null;
  if (week.speech_act && Object.prototype.hasOwnProperty.call(ACT_QUESTIONS, week.speech_act)) {
    return ACT_QUESTIONS[week.speech_act as SpeechActUI];
  }
  if (week.week_no === 7) return "같은 표현에 대한 판단이 갈린 이유는 무엇인가? 내가 사용한 근거를 설명할 수 있는가?";
  if (week.week_no === 14) return "어떤 조건에서 표현을 바꾸거나 유지했고, 그 이유를 무엇으로 설명할 수 있는가?";
  return null;
}
