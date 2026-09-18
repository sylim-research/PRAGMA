import { describe, expect, it } from "vitest";
import { evaluationFromRuntimeFeedback } from "./CanonicalMissionRun";

// 뜻이 옮겨지지 않은 산출(예: 「地方地方地方」)에 문법 「좋음」이 붙던 문제 — DEC-20260918-04.
const runtime = {
  mission: {
    unit: { target_feature: "gratitude_calibration", closing_ko: "" },
    direction: "ko_zh",
    production_task: { mode: "translation" },
  },
} as never;
const quest = { referenceAnswer: "参考" } as never;
const feedback = (semantic: "preserved" | "minor_loss" | "distorted") => ({
  verdicts: {
    semantic_fidelity: semantic,
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "gratitude_calibration", band_code: "insufficient" },
  },
  blocks: { meaning_ko: "감사와 행사 결과가 옮겨지지 않았습니다.", grammar: [], feature_ko: "감사가 약하게 들릴 수 있습니다.", alternatives: [], discourse_ko: "", offfocus_warnings: [] },
  uncertainty_flags: [],
  revision_scope: "meaning",
}) as never;

describe("fidelity first", () => {
  it("defers grammar and pragmatics when the meaning was not carried over", () => {
    const evaluation = evaluationFromRuntimeFeedback(runtime, quest, feedback("distorted"));
    expect(evaluation.criteria.map(c => c.level)).toEqual(["required", "deferred", "deferred"]);
    expect(evaluation.criteria[1].body).toBe("의미 충실성을 먼저 보완하면, 다듬기 단계에서 문법과 화용을 이어서 검토합니다.");
    expect(evaluation.headline).toBe("먼저 원문의 뜻을 옮겨 주세요.");
  });

  it("keeps all three judgments when the meaning is mostly carried over", () => {
    const evaluation = evaluationFromRuntimeFeedback(runtime, quest, feedback("minor_loss"));
    expect(evaluation.criteria.map(c => c.level)).toEqual(["recommend", "very_good", "recommend"]);
    expect(evaluation.criteria[2].body).toBe("감사가 약하게 들릴 수 있습니다.");
  });
});
