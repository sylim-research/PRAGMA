import { describe, expect, it } from "vitest";
import { applyFeedbackReview, buildFeedbackReviewSystemPrompt, readFeedbackReview } from "../../../supabase/functions/_shared/feedbackReview";
import { normalizeFeedbackResponse } from "@/lib/mission/normalizeFeedback";

const feedback = {
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "request_mitigation_optionality", band_code: "too_direct" },
  },
  blocks: {
    meaning_ko: "사실이 모두 전달되었습니다.",
    grammar: [],
    feature_ko: "요청이 수락을 전제한 것처럼 들립니다.",
    alternatives: [{ text: "能麻烦您帮我保管一下吗？", note_ko: "" }],
    discourse_ko: "흐름이 자연스럽습니다.",
    offfocus_warnings: [],
  },
  uncertainty_flags: [],
};
const pass = { pass: true, reason_ko: "" };
const feature = {
  code: "request_mitigation_optionality",
  within_band_code: "within_band",
  band_schema: [{ code: "too_direct" }, { code: "within_band" }, { code: "over_indirect" }],
} as never;

describe("learner feedback review", () => {
  it("checks meaning preservation first and switches the language standard by direction", () => {
    expect(buildFeedbackReviewSystemPrompt("ko_zh")).toContain("목표 언어는 중국어");
    expect(buildFeedbackReviewSystemPrompt("zh_ko")).toContain("목표 언어는 한국어");
    expect(buildFeedbackReviewSystemPrompt("zh_ko")).toContain("원문의 뜻과 의도가 답안에 보존됐는지를 먼저 본다");
  });

  it("drops live alternatives even when every axis passes", () => {
    const out = applyFeedbackReview(feedback, { meaning: pass, grammar: pass, pragmatics: pass }, { model: "gpt-6-astra", status: "reviewed" });
    expect((out.blocks as { alternatives: unknown[] }).alternatives).toEqual([]);
    expect(out.review.held_axes).toEqual([]);
  });

  it("holds only the axes the reviewer rejects and blanks their explanations", () => {
    const out = applyFeedbackReview(feedback, { meaning: pass, grammar: pass, pragmatics: { pass: false, reason_ko: "근거가 틀림" } },
      { model: "gpt-6-astra", status: "reviewed" });
    expect(out.review.held_axes).toEqual(["pragmatics"]);
    expect((out.blocks as { feature_ko: string; meaning_ko: string }).feature_ko).toBe("");
    expect((out.blocks as { meaning_ko: string }).meaning_ko).toBe("사실이 모두 전달되었습니다.");
  });

  it("holds every axis when the review is missing or malformed", () => {
    expect(readFeedbackReview({ axes: { meaning: pass } })).toBeNull();
    const out = applyFeedbackReview(feedback, null, { model: "gpt-6-astra", status: "reviewed" });
    expect(out.review.status).toBe("unavailable");
    expect(out.review.held_axes).toEqual(["meaning", "grammar", "pragmatics"]);
  });

  it("does not turn a held axis into a revision task for the learner", () => {
    const reviewed = applyFeedbackReview(feedback, { meaning: pass, grammar: pass, pragmatics: { pass: false, reason_ko: "" } },
      { model: "gpt-6-astra", status: "reviewed" });
    const result = normalizeFeedbackResponse(reviewed, "您好，快递就麻烦您帮我保管一下了。", feature);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.held_axes).toEqual(["pragmatics"]);
    expect(result.feedback.revision_scope).toBe("clear");
    expect(result.feedback.verdicts.pragmatic_appropriateness.band_code).toBe("too_direct");
  });
});
