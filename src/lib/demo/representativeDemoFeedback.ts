// 대표 미션 시연(모델 하우스)의 DCT 예시 답안과 피드백. 시연은 AI를 호출하지 않는다.
// 1차·2차 모두 2026-09-28 운영 수업 경로의 한 번의 연구자 시험 수행(attempt 41fb9065-a621-41b0-8d14-7c030b5b04d1)에서
// 실제 AI(gpt-4.1-mini)가 최초안 A와 수정안 B에 돌려준 피드백 원문이다(learner_mission_events feedback_received).
// 같은 수행의 MJT 응답·A·B는 아래 시연 답안과 같다. 결과를 고르기 위해 다시 돌리지 않았다.

import { FeedbackSchema, type RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

/**
 * 시연 학습자의 MJT 답안(2026-09-28 연구자 판정). 전부 정답이면 실제 학습 체험이 보이지 않으므로
 * 해설이 확실한 두 자리만 의도적으로 틀린다(2026-09-28 연구자 재판정: 화면 4번 수정안 고르기는 정답).
 * 원어민(DeepSeek) 무정답 판정이 정답 키와 모두 일치했다.
 * - A2 추천서: 「다소 적절」 + 「요청 내용과 시점이 분명」 — 就交给您写了의 수락 전제를 놓침
 * - A5 포스터 원본(화면상 세 번째): 표현 1(能…发给我吗？)을 「너무 직접적」으로 봄 — 麻烦가 없으면 무례하다는 과잉 공손 오판.
 *   원어민 판정은 「매우 적절」이다.
 * - A4 리허설: 2026-09-26 운영 확인의 실제 연구자 수정문
 * 나머지(A1·A5)는 기준 답안을 쓴다.
 */
export const DEMO_MJT_ANSWERS: Record<string, { pick?: string; reasonId?: string; text?: string; candidatePicks?: Record<string, string> }> = {
  A2: { pick: "somewhat_appropriate", reasonId: "request-and-deadline" },
  A5: { candidatePicks: { "A5-0": "too_direct" } },
  A4: { text: "我下课晚，明天的彩排能从七点推迟到七点半吗？" },
};

export const DEMO_FIRST_DRAFT = "您好，这个周末我有急事要出门，送到我家的快递就麻烦您帮我收一下了。谢谢您。";
export const DEMO_REVISED_DRAFT = "您好，这个周末我有急事要出门。如果方便的话，能不能麻烦您帮我收一下送到我家的快递？非常感谢！";

const RECORDED_FIRST_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  "blocks": {
    "alternatives": [
      {
        "note_ko": "‘能不能’과 ‘如果方便的话’를 넣어 요청을 완화하고 상대의 선택권을 명확히 표현했습니다.",
        "text": "您好，这个周末我有急事要出门，能不能麻烦您帮我收一下送到我家的快递？如果方便的话，真的非常感谢您。"
      }
    ],
    "discourse_ko": "전체 문장이 자연스럽게 연결되어 있으며, 상황에 맞는 간결한 메시지입니다.",
    "feature_ko": "‘麻烦您帮我收一下了’는 요청을 직접적으로 단정하는 어조로, 원문의 완화와 선택권을 주는 표현보다 부담이 다소 커 보일 수 있습니다. 이 상황에서는 상대에게 선택권을 더 명확히 남기는 표현을 다시 점검해 보길 권합니다.",
    "grammar": [],
    "meaning_ko": "원문의 핵심 요청인 ‘이번 주말에 외출하니 집으로 올 택배를 대신 받아달라’는 내용과 감사 인사가 모두 포함되어 의미가 잘 전달되었습니다.",
    "offfocus_warnings": []
  },
  "provenance": {
    "generated_at": "2026-09-28T14:31:34.888Z",
    "model": "gpt-4.1-mini",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "feature",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": [],
  "verdicts": {
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "band_code": "too_direct",
      "feature_code": "request_mitigation_optionality"
    },
    "semantic_fidelity": "preserved"
  }
});

const RECORDED_RECHECK_FEEDBACK: RuntimeFeedback = FeedbackSchema.parse({
  "blocks": {
    "alternatives": [
      {
        "note_ko": "‘如果方便的话’를 빼고 ‘您能帮我收一下…吗’로 직접적인 의문형 요청만 사용해 선택권 완화 정도를 줄인 예입니다.",
        "text": "您好，这个周末我有急事要出门，您能帮我收一下送到我家的快递吗？非常感谢！"
      }
    ],
    "discourse_ko": "전체 문장이 자연스럽게 연결되어 있으며, 상황에 맞는 요청과 감사 표현이 잘 어우러져 있습니다.",
    "feature_ko": "‘如果方便的话’와 ‘能不能麻烦您帮我收一下’ 표현으로 요청의 완화와 상대의 선택권이 적절히 드러납니다. 이 상황과 관계에 비추어 요청이 너무 직접적이지 않고, 상대에게 부담을 덜어주는 표현으로 알맞게 실현된 것으로 보입니다.",
    "grammar": [],
    "meaning_ko": "원문의 핵심 요청인 ‘이번 주말에 급한 일이 있어 외출해야 하므로 집으로 올 택배를 대신 받아줄 수 있느냐’는 내용이 모두 포함되어 있습니다. 추가적인 사실이나 조건 없이 원문의 명제가 잘 보존되었습니다.",
    "offfocus_warnings": []
  },
  "provenance": {
    "generated_at": "2026-09-28T14:31:56.228Z",
    "model": "gpt-4.1-mini",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise"
  },
  "revision_scope": "clear",
  "rubric_version": "request_mitigation_optionality@1.1",
  "schema_version": "feedback_v1",
  "uncertainty_flags": [],
  "verdicts": {
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "band_code": "within_band",
      "feature_code": "request_mitigation_optionality"
    },
    "semantic_fidelity": "preserved"
  }
});

const normalize = (text: string) => text.replace(/\s+/g, "");

/** 시연용 피드백 요청 — 예시 답안(A·B)에만 준비된 피드백을 돌려주고 AI는 부르지 않는다. */
export async function requestDemoFeedback(_mission: unknown, answer: string): Promise<FeedbackRequestResult> {
  if (normalize(answer) === normalize(DEMO_FIRST_DRAFT)) return { ok: true, feedback: RECORDED_FIRST_FEEDBACK };
  if (normalize(answer) === normalize(DEMO_REVISED_DRAFT)) return { ok: true, feedback: RECORDED_RECHECK_FEEDBACK };
  return { ok: false, error: "시연에서는 AI를 호출하지 않습니다. 「답안 자동 채우기」로 예시 답안의 피드백을 확인해 주세요." };
}
