import { describe, expect, it } from "vitest";
import { feedbackSentences } from "./CanonicalMissionRun";

describe("feedbackSentences", () => {
  it("does not split at punctuation inside quoted source text", () => {
    const body = "원문의 핵심 요청인 '내일 오전에 약국 가시는 길에 처방약을 대신 받아다 주실 수 있을까요?'가 '도와줄 수 있나요?'로 바뀌었습니다. 무엇을 부탁하는지 다시 넣어 주세요.";
    expect(feedbackSentences(body)).toEqual([
      "원문의 핵심 요청인 '내일 오전에 약국 가시는 길에 처방약을 대신 받아다 주실 수 있을까요?'가 '도와줄 수 있나요?'로 바뀌었습니다.",
      "무엇을 부탁하는지 다시 넣어 주세요.",
    ]);
  });

  it("handles corner brackets and keeps plain sentences split", () => {
    expect(feedbackSentences("「好吗？」는 부드럽습니다. 좋아요!")).toEqual(["「好吗？」는 부드럽습니다.", "좋아요!"]);
  });

  it("keeps the rest of the text when a quote is never closed", () => {
    expect(feedbackSentences("'열린 따옴표. 뒤 문장.")).toEqual(["'열린 따옴표. 뒤 문장."]);
  });
});
