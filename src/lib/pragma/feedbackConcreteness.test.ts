import { describe, expect, it } from "vitest";
import { concretenessHeldAxes, concretenessRetryNote, findConcretenessIssues } from "../../../supabase/functions/_shared/feedbackConcreteness";
import { applyFeedbackReview } from "../../../supabase/functions/_shared/feedbackReview";

const answer = "麻烦您帮我保管一下了，谢谢。";
const source = "번거로우시겠지만 가능하시면 보관해 주실 수 있을까요?";
const withBlocks = (blocks: Record<string, unknown>) => ({ verdicts: {}, blocks: { grammar: [], alternatives: [], ...blocks } });

describe("learner feedback concreteness", () => {
  it("accepts an explanation that quotes the learner's Chinese and names one action", () => {
    const feedback = withBlocks({
      meaning_ko: "원문 내용이 모두 전달되었습니다.",
      feature_ko: "'麻烦您帮我保管一下了'의 了 때문에 이미 맡아 주기로 한 일처럼 들릴 수 있습니다. 가능한지 묻는 형태로 바꿔 보세요.",
    });
    expect(findConcretenessIssues(feedback, answer, source)).toEqual([]);
  });

  it("flags generic advice and Chinese that is not in the answer or the source", () => {
    const feedback = withBlocks({
      meaning_ko: "의미는 잘 전달되었습니다.",
      feature_ko: "좀 더 완화적인 표현을 검토할 필요가 있습니다. 方便的话를 넣어 보세요.",
    });
    const issues = findConcretenessIssues(feedback, answer, source);
    expect(issues.map((issue) => [issue.axis, issue.kind, issue.detail])).toEqual([
      ["pragmatics", "generic_phrase", "검토할 필요"],
      ["pragmatics", "new_target_text", "方便的话"],
    ]);
    expect(concretenessHeldAxes(issues)).toEqual(["pragmatics"]);
    expect(concretenessRetryNote(issues)).toContain("方便的话");
  });

  it("allows quoting the Chinese source in the zh→ko direction", () => {
    const feedback = withBlocks({ meaning_ko: "원문의 '下周三'에 해당하는 날짜가 빠졌습니다. 날짜를 넣어 보세요." });
    expect(findConcretenessIssues(feedback, "다음 주에 빌릴 수 있을까요?", "请问下周三可以借用研讨室吗？")).toEqual([]);
  });

  it("holds the axis that still fails after the retry, even when the reviewer passed it", () => {
    const pass = { pass: true, reason_ko: "" };
    const out = applyFeedbackReview(
      withBlocks({ meaning_ko: "의미 보존", feature_ko: "더 자연스러운 표현을 고려해 보세요." }),
      { meaning: pass, grammar: pass, pragmatics: pass },
      { model: "gpt-6-astra", status: "reviewed" },
      { heldAxes: ["pragmatics"], retried: true, issues: ["feature_ko:generic_phrase:고려해 보"] },
    ) as { blocks: Record<string, unknown>; review: { held_axes: string[]; concreteness: { retried: boolean } } };
    expect(out.review.held_axes).toEqual(["pragmatics"]);
    expect(out.blocks.feature_ko).toBe("");
    expect(out.blocks.meaning_ko).toBe("의미 보존");
    expect(out.review.concreteness.retried).toBe(true);
  });
});
