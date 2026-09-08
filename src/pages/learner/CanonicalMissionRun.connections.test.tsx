// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_MISSION_PREVIEW, type DctFeedbackQuest } from "@/lib/mission/canonicalMissionPreview";
import { CompletionActions, CompletionRecord, DctFeedbackView, MissionDissentPanel } from "@/pages/learner/CanonicalMissionRun";

afterEach(() => vi.useRealTimers());

describe("CanonicalMissionRun completion connections", () => {
  it("preserves the actual feedback category when no phrase is highlighted", () => {
    render(<CompletionRecord label="번역 실습" response={{
      first: "请帮我收一下快递。", revised: "您方便帮我收一下快递吗？", reflected: true,
      evaluation: {
        available: true, highlights: [], feedback: "원문의 선택 여지를 다시 살펴보세요.",
        headline: "선택 여지 확인", body: "가능 여부를 묻는 표현을 검토하세요.",
        example: "您方便帮我收一下快递吗？", takeaway: "상대의 선택 여지 확인",
        criteria: [
          { key: "meaning", label: "의미 전달", question: "", level: "very_good", body: "핵심 내용 유지" },
          { key: "language", label: "문법 정확성", question: "", level: "very_good", body: "문법 안정" },
          { key: "pragmatics", label: "화용 적절성", question: "", level: "recommend", body: "선택 여지 확인" },
        ],
      },
    }} />);
    expect(screen.getByText("다시 살펴본 기준: 화용 적절성")).toBeInTheDocument();
    expect(screen.queryByText(/원문의 핵심 내용이 빠졌습니다/)).not.toBeInTheDocument();
  });

  it("offers save-only retry after failure and prevents navigation while saving", () => {
    const onRestart = vi.fn();
    const onRetrySave = vi.fn();
    const view = render(<MemoryRouter><CompletionActions runtime saveState="error" onRestart={onRestart} onRetrySave={onRetrySave} /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("답안은 이 화면에 남아");
    fireEvent.click(screen.getByRole("button", { name: "학습 기록 저장 다시 시도" }));
    expect(onRetrySave).toHaveBeenCalledTimes(1);
    expect(onRestart).not.toHaveBeenCalled();

    view.rerender(<MemoryRouter><CompletionActions runtime saveState="saving" onRestart={onRestart} onRetrySave={onRetrySave} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "학습 기록 저장 다시 시도" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "처음부터 다시 보기" })).toBeDisabled();
    const recordsLink = screen.getByRole("link", { name: "나의 학습 기록 보기" });
    expect(recordsLink).toHaveAttribute("aria-disabled", "true");
    expect(fireEvent.click(recordsLink)).toBe(false);

    view.rerender(<MemoryRouter><CompletionActions runtime saveState="saved" onRestart={onRestart} onRetrySave={onRetrySave} /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("학습 기록에 저장되었습니다.");
    expect(screen.getByRole("link", { name: "나의 학습 기록 보기" })).not.toHaveAttribute("aria-disabled");
  });

  it("collects a learner challenge while preserving the AI reference judgment", () => {
    const onSubmit = vi.fn();
    render(<MissionDissentPanel onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /이의 제기하기/ }));
    expect(screen.getByRole("heading", { name: "AI 참고 판정에 대한 이의 제기" })).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "이의 제기 남기기" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "관계·친밀도에 대한 다른 판단" }));
    fireEvent.change(screen.getByPlaceholderText("한 줄 이유 (선택)"), {
      target: { value: "초면보다 이미 아는 사이에 가깝다고 보았습니다." },
    });
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      conditions: ["relationship"],
      reason: "초면보다 이미 아는 사이에 가깝다고 보았습니다.",
    });
    expect(screen.getByText(/AI 참고 판정과 나의 판단을 함께/)).toBeInTheDocument();
  });

  it("lets the learner retain the first response after recording a challenge to revision feedback", () => {
    vi.useFakeTimers();
    const quest = CANONICAL_MISSION_PREVIEW.quests.find(
      (candidate): candidate is DctFeedbackQuest => candidate.kind === "dct_feedback",
    );
    if (!quest) throw new Error("DCT feedback fixture is missing");
    const first = "你必须改时间。";
    const onDone = vi.fn();

    render(<DctFeedbackView quest={quest} response={{ first, revised: first, reflected: false }} onDone={onDone} />);
    act(() => vi.advanceTimersByTime(1300));

    const retain = screen.getByRole("button", { name: "내 번역을 유지하고 확정하기" });
    expect(retain).toBeDisabled();
    expect(screen.getByText(/첫 번역을 유지하려면/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /이의 제기하기/ }));
    fireEvent.click(screen.getByRole("button", { name: "관계·친밀도에 대한 다른 판단" }));
    fireEvent.change(screen.getByPlaceholderText("한 줄 이유 (선택)"), {
      target: { value: "이미 합의된 일정이라 더 직접적으로 말해도 된다고 판단했습니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "이의 제기 남기기" }));

    expect(retain).toBeEnabled();
    fireEvent.click(retain);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      first,
      revised: first,
      reflected: false,
      dissent: {
        conditions: ["relationship"],
        reason: "이미 합의된 일정이라 더 직접적으로 말해도 된다고 판단했습니다.",
      },
    }));
  });

  it("links the preview completion to learner records without claiming persistence", () => {
    const onRestart = vi.fn();
    render(
      <MemoryRouter>
        <CompletionActions onRestart={onRestart} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "나의 학습 기록 보기" })).toHaveAttribute(
      "href",
      "/learner/records#correction-notes",
    );
    expect(screen.getByText(/답안과 의견은 DB에 저장되지 않습니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 보기" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("withholds reference answers until the learner has finalized the revision", () => {
    vi.useFakeTimers();
    const quest = CANONICAL_MISSION_PREVIEW.quests.find(
      (candidate): candidate is DctFeedbackQuest => candidate.kind === "dct_feedback",
    );
    if (!quest) throw new Error("DCT feedback fixture is missing");
    const first = "您好，下周二的面试我不能参加，可以调整时间吗？";
    const response = { first, revised: first, reflected: false };

    const { unmount } = render(<DctFeedbackView quest={quest} response={response} onDone={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1300));
    for (const alternative of quest.feedback.alternatives) {
      expect(screen.queryByText(alternative.text)).not.toBeInTheDocument();
    }
    unmount();

    render(<CompletionRecord label="번역 실습" response={response} alternatives={quest.feedback.alternatives} />);
    for (const alternative of quest.feedback.alternatives) {
      expect(screen.getByText(alternative.text)).toBeInTheDocument();
    }
  });
});
