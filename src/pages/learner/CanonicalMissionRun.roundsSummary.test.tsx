// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackRoundsSummary } from "./CanonicalMissionRun";

// 완료 화면의 회차별 AI 피드백 정리 — 저장된 회차 결과만 모으고, 2차가 없으면 없다고 밝힌다(2026-11-15).
const runtime = {
  mission: {
    unit: { target_feature: "gratitude_calibration", closing_ko: "" },
    direction: "ko_zh",
    production_task: { mode: "translation" },
  },
} as never;
const quest = { referenceAnswer: "参考" } as never;
const feedback = (band: string) => ({
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "gratitude_calibration", band_code: band },
  },
  blocks: { meaning_ko: "", grammar: [], feature_ko: "화용 설명 문장", alternatives: [], discourse_ko: "", offfocus_warnings: [] },
  uncertainty_flags: [],
  revision_scope: "feature",
});

describe("feedback rounds summary", () => {
  it("shows the first round against the draft and says when there was no second round", () => {
    render(<FeedbackRoundsSummary runtime={runtime} quest={quest}
      rounds={[{ round: 1, answer: "初稿", result: { ok: true, feedback: feedback("insufficient") as never } }]} />);
    expect(screen.getByText("AI 피드백 정리")).toBeTruthy();
    expect(screen.getByText(/최종안을 다시 평가한 것이 아닙니다/)).toBeTruthy();
    expect(screen.getByText("화용 설명 문장")).toBeTruthy();
    expect(screen.getAllByText("2차 피드백 없음")).toHaveLength(3);
  });

  it("marks a failed second round instead of hiding it", () => {
    render(<FeedbackRoundsSummary runtime={runtime} quest={quest}
      rounds={[
        { round: 1, answer: "初稿", result: { ok: true, feedback: feedback("insufficient") as never } },
        { round: 2, answer: "修改稿", result: { ok: false, error: "timeout" } },
      ]} />);
    expect(screen.getAllByText("2차 피드백을 불러오지 못했습니다.")).toHaveLength(3);
  });

  it("renders nothing when there is no feedback round at all", () => {
    const { container } = render(<FeedbackRoundsSummary runtime={runtime} quest={quest} rounds={[]} />);
    expect(container.textContent).toBe("");
  });
});
