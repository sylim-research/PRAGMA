import { describe, expect, it } from "vitest";
import { evaluationFromRuntimeFeedback, feedbackExplanationCriteria } from "./CanonicalMissionRun";

// 설명을 하나만 열면 두 회차 동안 화용 설명을 끝내 못 볼 수 있었다 — 걸린 기준을 모두 펼친다(2026-11-15).
const runtime = {
  mission: {
    unit: { target_feature: "gratitude_calibration", closing_ko: "" },
    direction: "ko_zh",
    production_task: { mode: "translation" },
  },
} as never;
const quest = { referenceAnswer: "参考" } as never;
const feedback = (semantic: "preserved" | "minor_loss" | "distorted", grammar: "clean" | "issue", held: string[] = []) => ({
  verdicts: {
    semantic_fidelity: semantic,
    grammatical_accuracy: grammar,
    pragmatic_appropriateness: { feature_code: "gratitude_calibration", band_code: "insufficient" },
  },
  blocks: {
    meaning_ko: "의미 설명",
    grammar: grammar === "issue" ? [{ explanation_ko: "문법 설명", suggested_correction: "改正", anchor_text: "错" }] : [],
    feature_ko: "화용 설명",
    alternatives: [], discourse_ko: "", offfocus_warnings: [],
  },
  uncertainty_flags: [],
  held_axes: held,
  revision_scope: "grammar",
}) as never;
const keysOf = (semantic: "preserved" | "minor_loss" | "distorted", grammar: "clean" | "issue", held: string[] = []) =>
  feedbackExplanationCriteria(evaluationFromRuntimeFeedback(runtime, quest, feedback(semantic, grammar, held)).criteria).map(c => c.key);

describe("all flagged criteria are explained", () => {
  it("explains all three criteria, including '좋음', in fixed order (DEC-20261118-03)", () => {
    expect(keysOf("preserved", "issue")).toEqual(["meaning", "language", "pragmatics"]);
    expect(keysOf("preserved", "clean")).toEqual(["meaning", "language", "pragmatics"]);
  });
  it("explains a minor meaning loss first, then the rest", () => {
    expect(keysOf("minor_loss", "issue")).toEqual(["meaning", "language", "pragmatics"]);
  });
  it("explains grammar and pragmatics even when the meaning was not carried over (DEC-20261118-03)", () => {
    expect(keysOf("distorted", "issue")).toEqual(["meaning", "language", "pragmatics"]);
  });
  it("still lists a criterion held in older stored feedback, with the held note as its body", () => {
    expect(keysOf("preserved", "issue", ["pragmatics"])).toEqual(["meaning", "language", "pragmatics"]);
  });
});
