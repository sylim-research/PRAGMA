import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT, requestDemoFeedback } from "./representativeDemoFeedback";
import { REVERSE_DEMO_DRAFT, requestReverseDemoFeedback } from "./reverseDemoFeedback";
import { KO_ZH_INTERPRETING_DRAFT, KO_ZH_INTERPRETING_FEEDBACK, ZH_KO_TRANSLATION_DRAFT, ZH_KO_TRANSLATION_FEEDBACK, ZH_KO_TRANSLATION_REVISED, recordedDemoFeedback } from "./additionalDemoFeedback";
import { KO_ZH_INTERPRETING_MISSION_ID, REPRESENTATIVE_MISSION_ID, REVERSE_REPRESENTATIVE_MISSION_ID, ZH_KO_TRANSLATION_MISSION_ID } from "./representativeMissionCatalog";
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
const KO_ZH_INTERPRETING: RepresentativeDemoContent = {
  firstDraft: KO_ZH_INTERPRETING_DRAFT, revisedDraft: KO_ZH_INTERPRETING_DRAFT,
  // MJT3 demo answer is deliberately wrong: the under-calibrated candidate is marked as fitting.
  mjtAnswers: { A5: { candidatePicks: { "A5-1": "within_band" } } },
  feedbackNote: "이 예시 전사문으로 수행한 통역 과제의 실제 AI 피드백 기록입니다. 시연에서는 AI를 새로 호출하지 않습니다.",
  requestFeedback: recordedDemoFeedback(KO_ZH_INTERPRETING_DRAFT, KO_ZH_INTERPRETING_FEEDBACK),
};
const ZH_KO_TRANSLATION: RepresentativeDemoContent = {
  firstDraft: ZH_KO_TRANSLATION_DRAFT, revisedDraft: ZH_KO_TRANSLATION_REVISED,
  mjtAnswers: { A2: { pick: "very_inappropriate" } },
  feedbackNote: "이 예시 답안으로 수행한 번역 과제의 실제 AI 피드백 기록입니다. 시연에서는 AI를 새로 호출하지 않습니다.",
  requestFeedback: recordedDemoFeedback(ZH_KO_TRANSLATION_DRAFT, ZH_KO_TRANSLATION_FEEDBACK),
};
const CONTENT: Record<string, RepresentativeDemoContent> = {
  [REPRESENTATIVE_MISSION_ID]: FORWARD, [REVERSE_REPRESENTATIVE_MISSION_ID]: REVERSE,
  [KO_ZH_INTERPRETING_MISSION_ID]: KO_ZH_INTERPRETING, [ZH_KO_TRANSLATION_MISSION_ID]: ZH_KO_TRANSLATION,
};
export function representativeDemoContent(scenarioId?: string) {
  return scenarioId ? CONTENT[scenarioId] ?? null : null;
}
// Unknown demo IDs must never fall through to the live AI requester.
export async function unavailableDemoFeedback(): Promise<FeedbackRequestResult> {
  return { ok: false, error: "이 시연의 피드백 기록을 찾을 수 없습니다." };
}
