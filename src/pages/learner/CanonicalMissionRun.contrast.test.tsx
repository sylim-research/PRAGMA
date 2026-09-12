// @vitest-environment jsdom
//
// Contrast Lens — 두 번째 판단 문항에서 직전 판단을 함께 보여 준다.
// 판단 전에는 조건 칩·참고 판정·조건 차이 설명을 노출하지 않고, 제출 뒤에만 드러낸다.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import {
  adaptRunnableMissionToCanonical,
  changedContrastDimensions,
} from "@/lib/mission/canonicalMissionRuntime";

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));
vi.mock("@/lib/mission/missionEvents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mission/missionEvents")>(),
  appendMissionEvent: vi.fn().mockResolvedValue({ ok: true, id: "event" }),
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));

import { CanonicalMissionRunner, CanonicalReviewStage } from "@/pages/learner/CanonicalMissionRun";

const runtime = {
  scenario_id: "1f0b3d64-7a52-4a1e-9c3f-2b8d5e6c7a90",
  speech_act: "request" as const,
  learner_level: "intermediate" as const,
  mission_status: "reviewed",
  release_gate_mode: "legacy_reviewed" as const,
  direction: "ko_zh" as const,
  mission: SAMPLE_MISSION_V5_NATIVE,
};
const viewModel = () => adaptRunnableMissionToCanonical(structuredClone(runtime));

describe("changedContrastDimensions", () => {
  it("returns only the axes whose stored value actually differs", () => {
    expect(changedContrastDimensions(
      { p: "equal", d: "close", r: "low" },
      { p: "equal", d: "acquaintance", r: "low" },
    )).toEqual([{ axis: "d", axisLabel: "관계의 거리", before: "친밀", after: "아는 사이" }]);
  });

  it("returns an empty list when both judgment items share the same condition", () => {
    const same = { p: "speaker_lower", d: "distant", r: "high" } as const;
    expect(changedContrastDimensions(same, same)).toEqual([]);
  });

  it("keeps every changed axis in P → D → R order", () => {
    expect(changedContrastDimensions(
      { p: "equal", d: "close", r: "low" },
      { p: "speaker_lower", d: "distant", r: "high" },
    ).map((dimension) => dimension.axis)).toEqual(["p", "d", "r"]);
  });
});

describe("mission view model", () => {
  it("computes the contrast from the first two judgment items instead of an empty list", () => {
    expect(viewModel().contrast.changedDimensions).toEqual([
      { axis: "r", axisLabel: "부탁·사안의 부담", before: "부담 낮음", after: "부담 보통" },
    ]);
  });
});

describe("Contrast Lens on the second judgment item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  const renderStage = (revealAnswers: boolean) => render(
    <MemoryRouter>
      <CanonicalReviewStage mission={viewModel()} section="mjt-1" revealAnswers={revealAnswers} onNext={() => {}} />
    </MemoryRouter>,
  );

  it("shows the prior situation, relation and utterance without any answer cue before judging", () => {
    const mission = viewModel();
    renderStage(false);
    const card = screen.getByLabelText("방금 판단한 상황");
    expect(card).toHaveTextContent(mission.quests[0].context.situation);
    expect(card).toHaveTextContent(mission.quests[0].context.relation);
    expect(within(card).getByText(mission.quests[0].kind === "scale" ? mission.quests[0].target : "")).toBeInTheDocument();
    // 판단 전에는 정답 단서를 주지 않는다.
    expect(card).not.toHaveTextContent("참고 판정");
    expect(card).not.toHaveTextContent("상대적 지위");
    expect(card).not.toHaveTextContent("부담 ·");
    expect(screen.queryByLabelText("두 상황 비교")).not.toBeInTheDocument();
    expect(screen.queryByText(/부탁·사안의 부담/)).not.toBeInTheDocument();
  });

  it("reveals the condition difference and the reference judgment only after submitting", () => {
    renderStage(true);
    const reveal = screen.getByLabelText("두 상황 비교");
    expect(reveal).toHaveTextContent("부탁·사안의 부담");
    expect(reveal).toHaveTextContent("부담 낮음 → 부담 보통");
    expect(reveal).toHaveTextContent("두 상황에서 표현의 적절성이 어떻게 달라지는지 비교해 보세요.");
    // 표현이 같다고 단정하지 않는다.
    expect(reveal).not.toHaveTextContent("같은 표현");
    expect(reveal).not.toHaveTextContent("같은 말");
    const card = screen.getByLabelText("방금 판단한 상황");
    expect(card).toHaveTextContent("참고 판정");
    expect(card).toHaveTextContent("상대적 지위");
  });

  it("carries the learner's own first choice into the locked card", () => {
    render(
      <MemoryRouter>
        <CanonicalMissionRunner mission={viewModel()} runtime={structuredClone(runtime)} isDevPreview={false} demoMode />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));
    expect(screen.queryByLabelText("방금 판단한 상황")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다소 적절" }));
    fireEvent.click(screen.getByRole("button", { name: "답안 확인하기" }));
    fireEvent.click(screen.getByRole("button", { name: "다음: 상황에 맞는지 판단하기" }));
    expect(screen.getByLabelText("방금 판단한 상황")).toHaveTextContent("내 선택 · 다소 적절");
  });

  it("does not open the lens on the first judgment item", () => {
    render(
      <MemoryRouter>
        <CanonicalReviewStage mission={viewModel()} section="mjt-0" revealAnswers onNext={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("방금 판단한 상황")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("두 상황 비교")).not.toBeInTheDocument();
  });
});
