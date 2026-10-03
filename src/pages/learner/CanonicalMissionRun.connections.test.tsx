// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_MISSION_PREVIEW, type DctFeedbackQuest } from "@/lib/mission/canonicalMissionPreview";
import { CompletionActions, CompletionRecord, DctFeedbackView, MissionDissentPanel } from "@/pages/learner/CanonicalMissionRun";

afterEach(() => vi.useRealTimers());

describe("CanonicalMissionRun completion connections", () => {
  it("puts retry inside the error region before secondary navigation and blocks navigation while saving", () => {
    window.history.replaceState({}, "", "/?courseId=course&weekNo=2");
    const retry = vi.fn();
    const { rerender } = render(<MemoryRouter><CompletionActions runtime saveState="error" onRetrySave={retry} onRestart={vi.fn()} /></MemoryRouter>);
    const alert = screen.getByRole("alert");
    const button = screen.getByRole("button", { name: "학습 기록 저장 다시 시도" });
    expect(alert).toContainElement(button);
    const link = screen.getByRole("link", { name: "이번 주 학습으로 돌아가기" });
    expect(alert.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<MemoryRouter><CompletionActions runtime saveState="saving" onRetrySave={retry} onRestart={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (const nav of screen.getAllByRole("link")) expect(nav).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "처음부터 다시 보기" })).toBeDisabled();
    window.history.replaceState({}, "", "/");
  });
  it("preserves the actual feedback category when no phrase is highlighted", () => {
    render(<CompletionRecord response={{
      first: "请帮我收一下快递。", revised: "您方便帮我收一下快递吗？", reflected: true,
      evaluation: {
        available: true, highlights: [], feedback: "원문의 선택 여지를 다시 살펴보세요.",
        headline: "선택 여지 확인", body: "가능 여부를 묻는 표현을 검토하세요.",
        example: "您方便帮我收一下快递吗？", takeaway: "상대의 선택 여지 확인",
        criteria: [
          { key: "meaning", label: "의미 전달", question: "", level: "very_good", body: "핵심 내용 유지" },
          { key: "language", label: "문법적 정확성", question: "", level: "very_good", body: "문법 안정" },
          { key: "pragmatics", label: "화용적 적절성", question: "", level: "recommend", body: "선택 여지 확인" },
        ],
      },
    }} />);
    expect(screen.queryByText(/다시 살펴본 기준/)).not.toBeInTheDocument();
    expect(screen.queryByText(/원문의 핵심 내용이 빠졌습니다/)).not.toBeInTheDocument();
    // 처음(최초안)은 흐리게, 완성(최종안)은 진하게 — 두 판이 모두 남는다.
    const record = screen.getByRole("region", { name: /번역 완성본/ });
    expect(record).toHaveTextContent("请帮我收一下快递。");
    expect(record).toHaveTextContent("您方便帮我收一下快递吗？");
    expect(screen.queryByText("상황 번역하기")).not.toBeInTheDocument();
    expect(screen.queryByText("왜 고쳤나요?")).not.toBeInTheDocument();
    expect(screen.queryByText(/피드백을 반영한 최종/)).not.toBeInTheDocument();
  });

  it("shows the priority feedback once on each action screen", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    const quest = CANONICAL_MISSION_PREVIEW.quests.find((item): item is DctFeedbackQuest => item.kind === "dct_feedback")!;
    render(<DctFeedbackView quest={quest} response={{ first: "你必须改时间。", revised: "你必须改时间。", reflected: false }} onDone={vi.fn()} />);
    expect(screen.getByText("번역안을 세 기준으로 살펴보고 있습니다")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1300));
    // 세 기준이 모두 보이고, 우선 기준의 본문은 화면마다 한 번만 나온다.
    ["의미적 충실성", "문법적 정확성", "화용적 적절성"].forEach((label) => expect(screen.getByRole("heading", { name: label })).toBeInTheDocument());
    expect(screen.queryByText("언어 자연성")).not.toBeInTheDocument();
    // 판정은 가로 한 줄, 걸린 기준의 설명은 아래 상자 하나에만 있다.
    const point = screen.getByText(/^의미적 충실성 · /).nextElementSibling!.textContent!;
    expect(screen.getAllByText(point)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    expect(screen.getByRole("heading", { name: "피드백을 참고해 다시 써보세요." })).toBeInTheDocument();
    expect(screen.getAllByText(point)).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "의미적 충실성" })).not.toBeInTheDocument();
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
    const recordsLink = screen.getByRole("link", { name: "내 기록 보기" });
    expect(recordsLink).toHaveAttribute("aria-disabled", "true");
    expect(fireEvent.click(recordsLink)).toBe(false);

    view.rerender(<MemoryRouter><CompletionActions runtime saveState="saved" onRestart={onRestart} onRetrySave={onRetrySave} /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("학습 기록에 저장되었습니다.");
    expect(screen.getByRole("link", { name: "내 기록 보기" })).not.toHaveAttribute("aria-disabled");
  });

  it("collects a learner challenge while preserving the AI reference judgment", () => {
    const onSubmit = vi.fn();
    render(<MissionDissentPanel onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /내 판단 남기기/ }));
    expect(screen.getByRole("heading", { name: "AI 피드백과 내 생각이 다르다면" })).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "내 판단 남기기" });
    expect(submit).toBeDisabled();

    // 조건 선택지는 없다 — 한 줄 서술만 받는다.
    expect(screen.queryByRole("button", { name: "관계·친밀도에 대한 다른 판단" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("어떤 점에서 다르게 봤는지 한 줄로 적어 주세요."), {
      target: { value: "초면보다 이미 아는 사이에 가깝다고 보았습니다." },
    });
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      conditions: [],
      reason: "초면보다 이미 아는 사이에 가깝다고 보았습니다.",
    });
    expect(screen.getByText("내 판단을 기록했습니다.")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "이대로 확정" }));
    const confirm = screen.getByRole("button", { name: "확정" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("예: 이 관계에선 이 말투가 자연스러워요"), {
      target: { value: "이미 합의된 일정이라 더 직접적으로 말해도 된다고 판단했습니다." },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      first,
      revised: first,
      reflected: false,
      dissent: {
        conditions: [],
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

    expect(screen.getByRole("link", { name: "내 기록 보기" })).toHaveAttribute(
      "href",
      "/learner/records#correction-notes",
    );
    expect(screen.getByText(/데모에서는 답안과 의견을 저장하지 않습니다/)).toBeInTheDocument();

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

    render(<CompletionRecord response={response} alternatives={quest.feedback.alternatives} />);
    expect(screen.getByRole("region", { name: "참고 표현" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "참고 표현" })).toBeInTheDocument();
    for (const alternative of quest.feedback.alternatives) {
      expect(screen.getByText(alternative.text)).toBeInTheDocument();
    }
  });
});
