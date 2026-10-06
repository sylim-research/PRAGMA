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

// 중→한 반대 승인본(원래 통역 미션, 데모에서는 번역 과제로 제시) · translation · recorded 2026-10-06T15:58:16.508Z
// The prepared draft keeps the workplace register but gives a different reason than the source (meaning distortion example).
export const ZH_KO_TRANSLATION_DRAFT = "한 달 앞당기자는 말씀은 충분히 이해가 됩니다. 다만 테스트가 아직 끝나지 않아 제 생각에는 원래 계획대로 가는 게 좋을 것 같습니다.";
export const ZH_KO_TRANSLATION_FEEDBACK = FeedbackSchema.parse({
  "schema_version": "feedback_v1",
  "rubric_version": "opposition_stance_mitigation@1.0",
  "verdicts": {
    "semantic_fidelity": "distorted",
    "grammatical_accuracy": "clean",
    "pragmatic_appropriateness": {
      "feature_code": "opposition_stance_mitigation",
      "band_code": "too_obscured"
    }
  },
  "revision_scope": "meaning",
  "blocks": {
    "meaning_ko": "원문은 프로젝트 기간을 2주 줄이자는 제안에 대해 품질 관리를 소홀히 하면 전체 일정에 악영향이 생긴다는 반대 입장을 명확히 밝히고 있다. 학습자 번역은 기간 단축에 대한 반대 이유가 품질 관리가 아니라 테스트 미완료라는 다른 근거로 바뀌어 원문의 핵심 명제가 누락되었다.",
    "grammar": [],
    "feature_ko": "이견의 대상과 근거가 원문과 달라서 반대 입장이 흐려지고, 관계 조정도 원문의 근거 중심 설명 대신 개인 의견으로 바뀌어 이견 명료성이 떨어질 수 있다.",
    "alternatives": [
      {
        "text": "프로젝트 기간을 2주 줄이자는 말씀은 이해합니다. 다만 품질 관리를 소홀히 하면 오히려 전체 일정에 영향을 줄 수 있다고 생각합니다.",
        "note_ko": "반대 이유를 원문과 같이 품질 관리 문제로 명확히 하여 이견의 대상과 근거를 일치시켰다."
      }
    ],
    "discourse_ko": "한국어 문장 연결은 자연스럽지만 원문 의미와 근거가 달라져 전체 담화 의미가 변질되었다.",
    "offfocus_warnings": []
  },
  "uncertainty_flags": [],
  "provenance": {
    "model": "gpt-4.1-mini",
    "prompt_version": "feedback_v1_minidiscourse_v6_concise",
    "generated_at": "2026-10-06T15:58:16.545Z"
  }
});

const MISMATCH = "이 시연에는 예시 초안의 피드백 기록만 있습니다. 시연용 답안을 채우거나 현재 표현을 직접 검토해 최종 결정해 주세요.";
const same = (a: string, b: string) => a.replace(/s+/g, "") === b.replace(/s+/g, "");
export const recordedDemoFeedback = (draft: string, feedback: ReturnType<typeof FeedbackSchema.parse>) =>
  async (_mission: unknown, answer: string): Promise<FeedbackRequestResult> =>
    same(answer, draft) ? { ok: true, feedback } : { ok: false, error: MISMATCH };
