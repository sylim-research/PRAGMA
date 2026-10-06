import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT, requestDemoFeedback } from "./representativeDemoFeedback";
import { REVERSE_DEMO_DRAFT, requestReverseDemoFeedback } from "./reverseDemoFeedback";
import { REPRESENTATIVE_MISSION_ID, REVERSE_REPRESENTATIVE_MISSION_ID } from "./representativeMissionCatalog";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

export type RepresentativeDemoContent = {
  firstDraft: string;
  revisedDraft: string;
  mjtAnswers: typeof DEMO_MJT_ANSWERS;
  feedbackNote: string;
  requestFeedback: (mission: unknown, answer: string) => Promise<FeedbackRequestResult>;
};
const FORWARD: RepresentativeDemoContent = {
  firstDraft: DEMO_FIRST_DRAFT, revisedDraft: DEMO_REVISED_DRAFT, mjtAnswers: DEMO_MJT_ANSWERS,
  feedbackNote: "이 예시 답안으로 수행한 번역 과제의 실제 AI 피드백 기록입니다. 시연에서는 AI를 새로 호출하지 않습니다.",
  requestFeedback: requestDemoFeedback,
};
const REVERSE: RepresentativeDemoContent = {
  firstDraft: REVERSE_DEMO_DRAFT, revisedDraft: REVERSE_DEMO_DRAFT,
  // Unspecified MJT items use this mission's reference choices, never the forward demo's answers.
  mjtAnswers: {},
  feedbackNote: "이 예시 전사문으로 수행한 통역 과제의 실제 AI 피드백 기록입니다. 원래 수행에서는 초안을 유지했습니다. 시연에서는 AI를 새로 호출하지 않습니다.",
  requestFeedback: requestReverseDemoFeedback,
};
export function representativeDemoContent(scenarioId?: string) {
  return scenarioId === REPRESENTATIVE_MISSION_ID ? FORWARD : scenarioId === REVERSE_REPRESENTATIVE_MISSION_ID ? REVERSE : null;
}
// Unknown demo IDs must never fall through to the live AI requester.
export async function unavailableDemoFeedback(): Promise<FeedbackRequestResult> {
  return { ok: false, error: "이 시연의 피드백 기록을 찾을 수 없습니다." };
}
