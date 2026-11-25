import { describe, expect, it } from "vitest";
import { feedbackVerdictLevels, reconcilePragmaticScale, type FeedbackVerdicts } from "@/lib/pragma/feedbackSchema";
import { buildFeedbackHintReferences } from "@/lib/mission/feedbackHintReferences";
import { normalizeFeedbackResponse } from "@/lib/mission/normalizeFeedback";
import { handRaiseReasonIssue, handRaiseTargetLabel } from "@/lib/mission/handRaise";
import { sanitizeHintPattern } from "../../../supabase/functions/_shared/feedbackConcreteness";
import type { MissionQuest } from "@/lib/mission/canonicalMissionPreview";

const verdicts = (band: string, scale?: FeedbackVerdicts["pragmatic_appropriateness"]["scale_code"]): FeedbackVerdicts => ({
  semantic_fidelity: "preserved",
  grammatical_accuracy: "clean",
  pragmatic_appropriateness: { feature_code: "f", band_code: band, ...(scale ? { scale_code: scale } : {}) },
});

describe("verdict scheme v2 (2026-11-25)", () => {
  it("maps pragmatics onto the MJT four-level scale", () => {
    expect(feedbackVerdictLevels(verdicts("within_band", "very_appropriate"), "within_band").pragmatics).toBe("very_good");
    expect(feedbackVerdictLevels(verdicts("within_band", "somewhat_appropriate"), "within_band").pragmatics).toBe("recommend");
    expect(feedbackVerdictLevels(verdicts("too_direct", "somewhat_inappropriate"), "within_band").pragmatics).toBe("required");
    expect(feedbackVerdictLevels(verdicts("too_direct", "very_inappropriate"), "within_band").pragmatics).toBe("required");
  });

  it("reads records without a scale by the old mapping, never adding 수정 필요 retroactively", () => {
    expect(feedbackVerdictLevels(verdicts("within_band"), "within_band").pragmatics).toBe("very_good");
    expect(feedbackVerdictLevels(verdicts("too_direct"), "within_band").pragmatics).toBe("recommend");
  });

  it("maps meaning and grammar", () => {
    const v = { ...verdicts("within_band"), semantic_fidelity: "minor_loss" as const, grammatical_accuracy: "impeding_errors" as const };
    expect(feedbackVerdictLevels(v, "within_band")).toMatchObject({ meaning: "recommend", grammar: "required" });
    expect(feedbackVerdictLevels({ ...v, semantic_fidelity: "distorted" }, "within_band").meaning).toBe("required");
  });

  it("aligns scale to band direction", () => {
    const inside = verdicts("within_band", "very_inappropriate");
    expect(reconcilePragmaticScale(inside, "within_band")).toHaveLength(1);
    expect(inside.pragmatic_appropriateness.scale_code).toBe("somewhat_appropriate");
    const outside = verdicts("too_direct", "very_appropriate");
    reconcilePragmaticScale(outside, "within_band");
    expect(outside.pragmatic_appropriateness.scale_code).toBe("somewhat_inappropriate");
  });
});

describe("hint references", () => {
  const quests = [
    { id: "A1", kind: "scale", target: "把PPT发群里吧。", referenceAnswer: "somewhat_inappropriate", revisionExamples: ["能把PPT发群里吗？"] },
    { id: "A2", kind: "scale", target: "想麻烦您帮我写一封推荐信，可以吗？", referenceAnswer: "very_appropriate" },
    { id: "A5", kind: "spectrum", candidates: [
      { id: "c0", text: "请您务必帮我写。", acceptedAnswers: ["too_direct"] },
      { id: "c1", text: "您方便帮我写一封吗？", acceptedAnswers: ["appropriate"] },
    ] },
    { id: "A3", kind: "fix_choice", corrections: [{ id: "x", text: "错的", valid: false }, { id: "y", text: "能不能请您帮我看一下？", valid: true }] },
    { id: "A4", kind: "free_correction", references: ["可以麻烦您吗？"] },
    { id: "D", kind: "dct", referenceAnswer: "THE DCT ANSWER" },
  ] as unknown as MissionQuest[];

  it("keeps only approved appropriate MJT expressions and never the DCT answer", () => {
    const refs = buildFeedbackHintReferences(quests, ["within_band", "appropriate"]);
    const texts = refs.map((ref) => ref.text);
    expect(texts).toEqual(["能把PPT发群里吗？", "想麻烦您帮我写一封推荐信，可以吗？", "您方便帮我写一封吗？", "能不能请您帮我看一下？", "可以麻烦您吗？"]);
    expect(texts).not.toContain("把PPT发群里吧。");
    expect(texts).not.toContain("请您务必帮我写。");
    expect(texts).not.toContain("THE DCT ANSWER");
    expect(refs[0]).toMatchObject({ id: "H1", source_label: "판단 1" });
  });

  it("fills the shown text from the request list, not from the model", () => {
    const raw = {
      verdicts: verdicts("too_direct", "somewhat_inappropriate"),
      blocks: { feature_ko: "‘把…吧’가 지시처럼 들릴 수 있습니다.", hint: { reference_id: "H2", reference_text: "MODEL REWRITE", reference_note_ko: "가능 여부를 묻는다", pattern_ko: "" } },
    };
    const feature = { code: "f", band_schema: [{ code: "too_direct", label_ko: "" }, { code: "within_band", label_ko: "" }], within_band_code: "within_band" };
    const result = normalizeFeedbackResponse(raw, "把PPT发群里吧。", feature, [{ id: "H2", text: "想麻烦您…可以吗？", source_label: "판단 2" }]);
    expect(result.ok && result.feedback.blocks.hint).toMatchObject({ reference_text: "想麻烦您…可以吗？", reference_label: "판단 2" });
    const unknown = normalizeFeedbackResponse({ ...raw, blocks: { ...raw.blocks, hint: { reference_id: "H9" } } }, "把PPT发群里吧。", feature, []);
    expect(unknown.ok && unknown.feedback.blocks.hint?.reference_text).toBe("");
  });

  it("drops pattern hints that carry a long new target-language run", () => {
    const fb = { blocks: { hint: { pattern_ko: "‘能不能麻烦您帮我保管一下’처럼 바꿔 보세요" } } };
    expect(sanitizeHintPattern(fb, ["原文"])).toHaveLength(1);
    expect((fb.blocks.hint as { pattern_ko: string }).pattern_ko).toBe("");
    const short = { blocks: { hint: { pattern_ko: "가능 여부를 묻는 ‘能不能’ 같은 문형이 있습니다." } } };
    expect(sanitizeHintPattern(short, [])).toHaveLength(0);
  });
});

describe("hand raise", () => {
  it("requires a reason of at least ten characters", () => {
    expect(handRaiseReasonIssue("이상해요")).not.toBeNull();
    expect(handRaiseReasonIssue("왜 다소 부적절인지 모르겠어요")).toBeNull();
  });

  it("labels items in the learner's presentation order", () => {
    expect(handRaiseTargetLabel("mjt5", [1, 2, 5, 3, 4])).toBe("판단 3");
    expect(handRaiseTargetLabel("dct_feedback_2", [1, 2, 5, 3, 4])).toBe("통번역 과제 · 2차 AI 피드백");
  });
});
