import { FeedbackSchema } from "@/lib/pragma/feedbackSchema";
import type { FeedbackRequestResult } from "@/lib/mission/missionFeedback";

// Real AI feedback recorded once (2026-10-06) for each prepared demo draft; the demo never calls AI.

// 한→중 통역 칭찬 승인본 · interpreting · recorded 2026-10-06T14:16:33.928Z
export const KO_ZH_INTERPRETING_DRAFT = "你的视频故事很独特，我印象很深。剪辑和音乐也很好，内容更有魅力了。";
export const KO_ZH_INTERPRETING_FEEDBACK = FeedbackSchema.parse({
  "schema_version": "feedback_v1",
  "rubric_version": "compliment_grounding_sensitivity@1.0",
  "verdicts": {
    "semantic_fidelity": "preserved",
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "feature_code": "compliment_grounding_sensitivity",
      "band_code": "within_band"
    }
  },
  "revision_scope": "clear",
  "blocks": {
    "meaning_ko": "원문의 핵심 명제인 영상 스토리 전개의 독특함과 깊은 인상, 편집과 음악 활용의 탁월함으로 콘텐츠 매력이 살아났다는 점이 모두 잘 전달되었습니다.",
    "grammar": [],
    "feature_ko": "칭찬의 강도와 근거가 원문과 비슷해 관계와 상황에 적절하게 느껴질 수 있습니다. 다만 ‘很好’가 다소 일반적이라 좀 더 구체적 표현도 가능하나, 과하지도 부족하지도 않은 적절한 평가입니다.",
    "alternatives": [
      {
        "text": "你的视频故事很独特，给我留下了深刻的印象。剪辑和音乐的运用也很出色，内容的魅力更加凸显了。",
        "note_ko": "‘印象很深’를 ‘给我留下了深刻的印象’로 바꿔 인상 표현을 좀 더 명확히 했습니다."
      }
    ],
    "discourse_ko": "문장 연결과 흐름이 자연스럽고 의미 전달에 무리가 없습니다.",
    "offfocus_warnings": []
  },
  "uncertainty_flags": [],
  "provenance": {
    "model": "gpt-4.1-mini",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise",
    "generated_at": "2026-10-06T14:16:33.933Z"
  }
});

// 중→한 반대 승인본(원래 통역 미션, 데모에서는 번역 과제로 제시) · translation · recorded 2026-10-06T14:16:39.102Z
export const ZH_KO_TRANSLATION_DRAFT = "프로젝트 기간 단축은 중요하지만, 품질 관리를 하지 않으면 오히려 전체 진행에 영향을 줍니다. 각 단계의 품질을 보장해야 최종 결과물에 문제가 없습니다.";
export const ZH_KO_TRANSLATION_FEEDBACK = FeedbackSchema.parse({
  "schema_version": "feedback_v1",
  "rubric_version": "opposition_stance_mitigation@1.0",
  "verdicts": {
    "semantic_fidelity": "preserved",
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "feature_code": "opposition_stance_mitigation",
      "band_code": "within_band"
    }
  },
  "revision_scope": "clear",
  "blocks": {
    "meaning_ko": "원문의 핵심 명제인 프로젝트 기간 단축의 중요성과 품질 관리 미비 시 전체 진행에 부정적 영향이 있다는 점, 각 단계 품질 보장의 필요성이 모두 잘 전달되었습니다.",
    "grammar": [],
    "feature_ko": "이견을 명확히 하면서도 상대 제안의 중요성을 인정하고, 품질 관리의 필요성을 근거로 들어 관계를 해치지 않는 적절한 반대 입장을 표현하고 있습니다.",
    "alternatives": [
      {
        "text": "프로젝트 기간 단축이 중요하긴 하지만, 품질 관리를 소홀히 하면 오히려 전체 진행에 악영향을 미칠 수 있습니다. 각 단계의 품질을 반드시 보장해야 최종 결과물이 문제없을 것입니다.",
        "note_ko": "표현을 조금 더 명확하고 자연스럽게 다듬어 이견의 근거와 범위를 분명히 했습니다."
      }
    ],
    "discourse_ko": "전체적으로 자연스럽고 논리적이며, 한국어 담화로서 무리 없이 연결됩니다.",
    "offfocus_warnings": []
  },
  "uncertainty_flags": [],
  "provenance": {
    "model": "gpt-4.1-mini",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise",
    "generated_at": "2026-10-06T14:16:39.124Z"
  }
});

const MISMATCH = "이 시연에는 예시 초안의 피드백 기록만 있습니다. 시연용 답안을 채우거나 현재 표현을 직접 검토해 최종 결정해 주세요.";
const same = (a: string, b: string) => a.replace(/s+/g, "") === b.replace(/s+/g, "");
export const recordedDemoFeedback = (draft: string, feedback: ReturnType<typeof FeedbackSchema.parse>) =>
  async (_mission: unknown, answer: string): Promise<FeedbackRequestResult> =>
    same(answer, draft) ? { ok: true, feedback } : { ok: false, error: MISMATCH };
