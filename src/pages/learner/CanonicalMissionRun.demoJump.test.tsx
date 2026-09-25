// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));
vi.mock("@/lib/mission/missionEvents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mission/missionEvents")>(),
  appendMissionEvent: vi.fn().mockResolvedValue({ ok: true, id: "event" }),
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));

import CanonicalMissionRun, { CanonicalMissionRunner } from "@/pages/learner/CanonicalMissionRun";

describe("representative mission demo: free navigation", () => {
  it("jumps from the briefing to any MJT item and to the production task without answering", () => {
    window.scrollTo = vi.fn();
    render(<MemoryRouter><CanonicalMissionRun demoMode /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "적절성 판단 단계로 이동" }));
    expect(screen.getByText("1/5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3번째 문항으로 이동" }));
    expect(screen.getByText("3/5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1번째 문항으로 이동" }));
    expect(screen.getByText("1/5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "번역하기 단계로 이동" }));
    expect(screen.queryByText("1/5")).not.toBeInTheDocument();
    expect(screen.getByText(/현재 단계: 번역하기/)).toBeInTheDocument();
  });

  it("keeps the learner mission in order: unanswered items and stages are not jump targets", () => {
    window.scrollTo = vi.fn();
    const runtime = { scenario_id: "86d738b0-1891-4bfe-9b12-f8643ebbb45f", speech_act: "request" as const,
      learner_level: "intermediate" as const, mission_status: "reviewed", release_gate_mode: "legacy_reviewed",
      direction: "ko_zh" as const, mission: SAMPLE_MISSION_V6_REASON_CONTRAST };
    render(<MemoryRouter><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)} runtime={runtime}
      isDevPreview={false} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /번째 문항으로 이동/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /단계로 이동/ })).not.toBeInTheDocument();
  });
});
