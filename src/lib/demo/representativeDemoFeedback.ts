// 대표 미션 시연(모델 하우스)의 DCT 예시 답안과 피드백. 시연은 AI를 호출하지 않는다.
// 1차: 2026-09-26 운영 확인에서 연구자 계정이 실제로 제출한 최초안 A와, 그 답안에 대해
//      실제 AI(gpt-4.1-mini)가 돌려준 피드백 원문(저장·재조회 증거 기록)이다.
// 2차: 같은 확인에서 제출한 수정안 B에 대한 재확인은 기록되지 않았으므로 시연용으로 작성했다.

import { FeedbackSchema, type RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

export const DEMO_FIRST_DRAFT = "您好，这个周末我有急事要出门，送到我家的快递就麻烦您帮我收一下了。谢谢您。";
export const DEMO_REVISED_DRAFT = "您好，这个周末我有急事要出门。如果方便的话，能不能麻烦您帮我收一下送到我家的快递？非常感谢！";

const RECORDED_FIRST_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  "blocks": {
    "grammar": [],
    "feature_ko": "요청이 '麻烦您帮我收一下了'로 표현되어 직접적이고 단정적인 어조로 들릴 수 있습니다. 원문의 완화 표현과 선택권 부여(예: '…수 있을까요?', '가능하시면')가 약화되어 상대방의 선택권이 줄어든 인상을 줄 수 있습니다.",
    "meaning_ko": "원문의 핵심 요청인 '이번 주말에 급한 일이 있어 외출해야 하므로 집으로 올 택배를 대신 받아달라'는 의미가 잘 전달되었습니다. 추가적인 이유나 조건, 약속이 포함되지 않아 의미가 유지되었습니다.",
    "alternatives": [
      {
        "text": "您好，这个周末我有急事要出门，您能帮我收一下送到我家的快递吗？如果不方便的话，请您不用勉强，谢谢您。",
        "note_ko": "요청을 의문형과 조건절로 완화하여 상대의 선택권을 명확히 남긴 표현입니다."
      }
    ],
    "discourse_ko": "전체 문장이 자연스럽게 연결되어 있으며, 상황에 맞는 요청과 감사 표현이 잘 이어집니다.",
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
    "generated_at": "2026-09-26T07:50:28.155Z",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "feature",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": []
});

const AUTHORED_RECHECK_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  schema_version: "feedback_v1",
  rubric_version: "request_mitigation_optionality@1.1",
  revision_scope: "clear",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { band_code: "within_band", feature_code: "request_mitigation_optionality" },
  },
  blocks: {
    meaning_ko: "주말에 급한 일로 외출해야 해서 택배를 대신 받아 달라는 핵심 요청이 그대로 전달되었습니다.",
    grammar: [],
    feature_ko: "'如果方便的话'와 '能不能麻烦您…？'로 요청을 완화하고 상대가 거절할 여지를 남겨, 원문의 '가능하시면'과 부탁의 결이 살아났습니다.",
    alternatives: [],
    discourse_ko: "사정 설명, 부탁, 감사가 자연스러운 순서로 이어집니다.",
    offfocus_warnings: [],
  },
  uncertainty_flags: [],
  provenance: { model: "demo", prompt_version: "demo_authored_recheck", content_release_id: "", generated_at: "" },
});

const normalize = (text: string) => text.replace(/s+/g, "");

/** 시연용 피드백 요청 — 예시 답안(A·B)에만 준비된 피드백을 돌려주고 AI는 부르지 않는다. */
export async function requestDemoFeedback(_mission: unknown, answer: string): Promise<FeedbackRequestResult> {
  if (normalize(answer) === normalize(DEMO_FIRST_DRAFT)) return { ok: true, feedback: RECORDED_FIRST_FEEDBACK };
  if (normalize(answer) === normalize(DEMO_REVISED_DRAFT)) return { ok: true, feedback: AUTHORED_RECHECK_FEEDBACK };
  return { ok: false, error: "시연에서는 AI를 호출하지 않습니다. 「답안 자동 채우기」로 예시 답안의 피드백을 확인해 주세요." };
}
