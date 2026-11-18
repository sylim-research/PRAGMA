import { describe, expect, it } from "vitest";

import {
  FEEDBACK_MAX_ANSWER_CHARS,
  FEEDBACK_MAX_COMPLETION_TOKENS,
  FEEDBACK_MAX_PAYLOAD_CHARS,
  feedbackPayloadIssue,
} from "../../../supabase/functions/_shared/feedbackRequestLimits";

describe("feedback request cost boundary", () => {
  it("caps model output well below the provider defaults", () => {
    expect(FEEDBACK_MAX_COMPLETION_TOKENS).toBe(12_000);
  });

  it("accepts a normal mission feedback payload", () => {
    expect(feedbackPayloadIssue({
      answer: "如果方便的话，可以改到我们这边附近吗？",
      direction: "ko_zh",
      mode: "translation",
      situation_ko: "거래처 담당자에게 회의 장소 변경을 부탁한다.",
      relation_ko: "거래처 실무자 사이",
      pdr: { p: "equal", d: "acquaintance", r: "mid" },
      source_text: "다음 주 회의 장소를 바꿔 주실 수 있을까요?",
      invariants: ["다음 주", "회의 장소 변경 요청"],
      feature: {
        code: "request_mitigation_optionality",
        operational_definition: "상대에게 선택권을 남기는가를 본다.",
        band_schema: [{ code: "within_band", label_ko: "상황에 맞음" }],
      },
    })).toBeNull();
  });

  it("rejects missing and oversized answers", () => {
    expect(feedbackPayloadIssue(null)).toContain("feedback body required");
    expect(feedbackPayloadIssue({ answer: "   " })).toContain("answer");
    expect(feedbackPayloadIssue({ answer: "가".repeat(FEEDBACK_MAX_ANSWER_CHARS + 1) }))
      .toContain("answer too long");
  });

  it("rejects oversized context even when the answer is short", () => {
    expect(feedbackPayloadIssue({
      answer: "짧은 답",
      situation_ko: "상황".repeat(FEEDBACK_MAX_PAYLOAD_CHARS),
    })).toContain("payload too large");
  });

  it("rejects an ungrounded diagnosis request", () => {
    expect(feedbackPayloadIssue({
      answer: "可以吗？",
      direction: "ko_zh",
      mode: "translation",
    })).toContain("situation_ko");
  });
});
