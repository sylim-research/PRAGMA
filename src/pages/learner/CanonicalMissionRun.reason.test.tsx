// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CANONICAL_MISSION_PREVIEW, type ReasonQuest } from "@/lib/mission/canonicalMissionPreview";
import { ReasonView } from "@/pages/learner/CanonicalMissionRun";

function reasonQuest(): ReasonQuest {
  const quest = CANONICAL_MISSION_PREVIEW.quests.find(
    (candidate): candidate is ReasonQuest => candidate.kind === "reason",
  );
  if (!quest) throw new Error("Reason preview quest is missing");
  return quest;
}

describe("CanonicalMissionRun reason flow", () => {
  it("keeps the canonical three-choice diagnostic contract", () => {
    const quest = reasonQuest();

    expect(quest.reasons).toHaveLength(3);
    expect(quest.reasons.map((reason) => reason.kind).sort()).toEqual([
      "meaning_grammar_context",
      "pragmatic_misconception",
      "primary",
    ]);
    expect(quest.reasons.find((reason) => reason.id === quest.acceptedReasonId)?.kind).toBe("primary");
  });

  it("asks for the reason directly and stores only the selected reason", () => {
    const quest = reasonQuest();
    const onDone = vi.fn();
    render(<ReasonView quest={quest} onDone={onDone} />);

    expect(screen.queryByRole("radiogroup", { name: "표현의 적절성 판단" })).not.toBeInTheDocument();
    expect(screen.getByText("이 표현이 상황에 맞지 않는 가장 큰 이유는 무엇일까요?")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /가장 큰 이유 하나/ })).toBeInTheDocument();

    const acceptedReason = quest.reasons.find((reason) => reason.id === quest.acceptedReasonId);
    if (!acceptedReason) throw new Error("Accepted reason is missing");
    fireEvent.click(screen.getByRole("radio", { name: acceptedReason.text }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));

    expect(screen.getByText("핵심 이유를 찾았어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다음: 표현 비교하기/ }));

    expect(onDone).toHaveBeenCalledWith({
      reasonId: quest.acceptedReasonId,
    });
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("initialJudgment");
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("reasonNote");
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("confidence");
  });

  it("shows corrective feedback for a non-primary reason", () => {
    const quest = reasonQuest();
    render(<ReasonView quest={quest} onDone={vi.fn()} />);

    const reason = quest.reasons.find((candidate) => candidate.id !== quest.acceptedReasonId);
    if (!reason) throw new Error("Reason fixture is missing");
    fireEvent.click(screen.getByRole("radio", { name: reason.text }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));
    expect(screen.getByText("핵심 이유를 다시 확인해요")).toBeInTheDocument();
  });
});
