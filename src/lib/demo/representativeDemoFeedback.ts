// 대표 미션 시연(모델 하우스)의 DCT 예시 답안과 피드백. 시연은 AI를 호출하지 않는다.
// 1차·2차 모두 2026-10-04 운영 수업 경로의 한 번의 연구자 시험 수행(attempt fe5051ac-7819-4d36-88d5-b3b7b629264d,
// 승인본 24fb6841 v2 · hash 0024c911…)에서 실제 AI(gpt-4.1-mini)가 초안과 수정안에 돌려준 피드백 원문이다
// (learner_mission_events feedback_received 64a009c6-9e55-4504-b945-35d298c1601d). 결과를 고르기 위해 다시 돌리지 않았다.
// 원자료: docs/research-trail/evidence/2026-10-04-representative-storage-demo/recorded-attempt.json

import { FeedbackSchema, type RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

/**
 * 시연 학습자의 MJT 답안 — 연구자가 구성한 시연 응답이다(2026-10-04, GPT 프로젝트 설계안 채택). 실제 학습자 자료가 아니며,
 * 아래 DCT 기록을 남긴 수행의 MJT 응답과도 다르다(그 수행의 응답은 증거 파일 mjt_responses_of_this_attempt에 보존).
 * 채점되는 8자리 = 기준과 같음 6 · 허용 판단 1 · 기준과 다름 1.
 * - A1 단일 표현 판단: 「다소 적절」 — 기준 판단(매우 적절)과 다르지만 허용 판단. 허용 판단 꼬리표의 의미를 실제 선택으로 보여 준다.
 * - A2 판단과 이유: 「다소 부적절」 + 「일을 맡기는 방식」 — 판단·이유 모두 기준과 같음.
 * - A5 복수 표현 비교(화면상 세 번째): 표현 1(能…吗？)만 「너무 직접적」 — 유일한 오판. 麻烦您 같은 추가 완화 표지가 없다고
 *   과잉 판단한 경우를 해설이 바로잡는다. 표현 2·3·4는 기준 판단.
 * - A3 수정안 선택: 기준 선택(想麻烦您帮我核实一下) — 항목을 두지 않으면 기준 답을 쓴다.
 * - A4 직접 수정(채점 없음): 참고 표현을 그대로 베끼지 않은 자연스러운 다른 수정.
 */
export const DEMO_MJT_ANSWERS: Record<string, { pick?: string; reasonId?: string; text?: string; candidatePicks?: Record<string, string> }> = {
  A1: { pick: "somewhat_appropriate" },
  A2: { pick: "somewhat_inappropriate", reasonId: "assumed-acceptance" },
  A5: { candidatePicks: { "A5-0": "too_direct" } },
  A4: { text: "明天我下课比较晚，彩排从七点改到七点半，可以吗？" },
};

export const DEMO_FIRST_DRAFT = "您好，这个周末我不在家，送到门口的快递就麻烦您帮我保管一下了，我周日晚上回来拿。谢谢您。";
export const DEMO_REVISED_DRAFT = "您好，这个周末我不在家，快递已经送到门口了。我周日晚上回来，在那之前能麻烦您帮我暂时保管一下吗？给您添麻烦了，非常感谢！";

/** 초안에 돌아온 실제 1차 AI 피드백(too_direct). 가상 학급 데모도 이 기록만 쓴다. */
export const RECORDED_FIRST_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  "blocks": {
    "grammar": [],
    "feature_ko": "요청이 '麻烦您帮我保管一下了'로 직접적이고 단정적으로 표현되어, 상대에게 선택권이나 완화된 여지를 충분히 주지 못하는 점이 있습니다. 이 상황에서는 좀 더 완화적이고 선택권을 남기는 표현을 검토할 필요가 있습니다.",
    "meaning_ko": "원문의 핵심 내용인 주말 부재, 택배 도착, 일요일 저녁에 돌아와서 찾겠다는 사실이 모두 전달되었습니다. 추가적인 사실이나 조건이 들어가지 않아 의미가 잘 보존되었습니다.",
    "alternatives": [
      {
        "text": "您好，这个周末我不在家，送到门口的快递能不能麻烦您帮我保管一下？我周日晚上回来拿。谢谢您。",
        "note_ko": "요청을 의문형으로 바꿔 상대의 선택권을 더 명확히 남긴 최소대조안입니다."
      }
    ],
    "discourse_ko": "전체 문장이 자연스럽게 연결되어 있으며, 상황 설명과 요청, 감사 인사가 잘 어우러져 있습니다.",
    "offfocus_warnings": []
  },
  "verdicts": {
    "semantic_fidelity": "preserved",
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "band_code": "too_direct",
      "feature_code": "request_mitigation_optionality"
    }
  },
  "provenance": {
    "model": "gpt-4.1-mini",
    "generated_at": "2026-10-03T16:26:32.053Z",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "feature",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": []
});

/** 수정안에 돌아온 실제 2차 AI 피드백(within_band). */
export const RECORDED_RECHECK_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  "blocks": {
    "grammar": [],
    "feature_ko": "요청이 직접적이면서도 '能麻烦您帮我…吗' 표현으로 상대에게 선택권과 완화된 부탁의 뉘앙스를 적절히 남겨 상황에 알맞게 실현되었을 수 있습니다.",
    "meaning_ko": "원문의 핵심 내용인 주말 부재, 택배 도착, 일요일 저녁 귀가 예정, 그때까지 잠시 보관 요청, 감사 표현이 모두 잘 전달되었습니다.",
    "alternatives": [
      {
        "text": "您好，这个周末我不在家，快递已经送到门口了。我周日晚上回来，在那之前您能帮我暂时保管一下吗？给您添麻烦了，非常感谢！",
        "note_ko": "'能麻烦您帮我…吗' 대신 '您能帮我…吗'로 요청을 약간 더 직접적으로 표현한 예입니다."
      }
    ],
    "discourse_ko": "전체 문장이 자연스럽게 연결되어 상황 설명과 요청, 감사가 매끄럽게 표현되었습니다.",
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
    "generated_at": "2026-10-03T16:26:52.698Z",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "clear",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": []
});

const normalize = (text: string) => text.replace(/\s+/g, "");

/** 시연용 피드백 요청 — 예시 답안(A·B)에만 준비된 피드백을 돌려주고 AI는 부르지 않는다. */
export async function requestDemoFeedback(_mission: unknown, answer: string): Promise<FeedbackRequestResult> {
  if (normalize(answer) === normalize(DEMO_FIRST_DRAFT)) return { ok: true, feedback: RECORDED_FIRST_FEEDBACK };
  if (normalize(answer) === normalize(DEMO_REVISED_DRAFT)) return { ok: true, feedback: RECORDED_RECHECK_FEEDBACK };
  return { ok: false, error: "시연에서는 AI를 호출하지 않습니다. 「답안 자동 채우기」로 예시 답안의 피드백을 확인해 주세요." };
}
