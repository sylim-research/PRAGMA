import { FeedbackSchema } from "@/lib/pragma/feedbackSchema";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

// 논문 4.3.4 실제 통역 수행의 초안 유지 기록. 2차 피드백은 생성하거나 재구성하지 않는다.
export const REVERSE_DEMO_DRAFT = "저희 쪽에서 생산 일정이 바뀌어서 다음 주에 있는 공급망 조정 회의 시간을 좀 옮겨야 될 것 같은데 바쁘시겠지만 혹시 일정 조정이 가능한지 좀 확인 부탁드려도 될까요?";
export const REVERSE_RECORDED_FEEDBACK = FeedbackSchema.parse({
  "blocks": {
    "grammar": [],
    "feature_ko": "요청이 직접적이면서도 '혹시', '좀' 등의 완화 표현과 선택권을 주는 표현으로 적절하게 완화되어 있습니다.",
    "meaning_ko": "원문의 핵심 내용인 공급망 조정 회의 시간 변경 필요성과 상대방 일정 확인 요청이 모두 포함되어 있습니다.",
    "alternatives": [
      {
        "text": "저희 쪽에서 생산 일정이 바뀌어서 다음 주에 있는 공급망 조정 회의 시간을 옮겨야 할 것 같은데, 바쁘시겠지만 일정 조정이 가능한지 확인 부탁드려도 될까요?",
        "note_ko": "‘좀’과 ‘혹시’를 줄이고 문장을 조금 간결하게 하여 완화 표현을 유지하면서도 자연스럽게 다듬은 최소대조안입니다."
      }
    ],
    "discourse_ko": "전체적으로 자연스럽고 문장 연결이 매끄럽습니다.",
    "offfocus_warnings": []
  },
  "verdicts": {
    "semantic_fidelity": "preserved",
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "band_code": "within_band",
      "feature_code": "request_mitigation_optionality"
    }
  },
  "provenance": {
    "model": "gpt-4.1-mini",
    "generated_at": "2026-10-05T02:58:25.713Z",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "clear",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": []
});

export async function requestReverseDemoFeedback(_mission: unknown, answer: string): Promise<FeedbackRequestResult> {
  if (answer.replace(/\s+/g, "") === REVERSE_DEMO_DRAFT.replace(/\s+/g, "")) return { ok: true, feedback: REVERSE_RECORDED_FEEDBACK };
  return { ok: false, error: "이 시연에는 예시 초안의 피드백 기록만 있습니다. 시연용 답안을 채우거나 현재 표현을 직접 검토해 최종 결정해 주세요." };
}
