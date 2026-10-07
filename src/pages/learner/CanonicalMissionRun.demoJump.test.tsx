// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import { demoQuestIndex, demoStepForQuest, parseDemoStep } from "@/lib/demo/demoStepNavigation";

vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionByScenario: vi.fn().mockResolvedValue({
  scenario_id: "1b44d36e-c1bc-4bc3-98f3-cbc74a7ac3ea", speech_act: "request", learner_level: "intermediate",
  mission_status: "reviewed", release_gate_mode: "legacy_reviewed", direction: "ko_zh", mission: SAMPLE_MISSION_V6_REASON_CONTRAST,
}) }));

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));
vi.mock("@/lib/mission/missionEvents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mission/missionEvents")>(),
  appendMissionEvent: vi.fn().mockResolvedValue({ ok: true, id: "event" }),
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));

import { CanonicalMissionRunner } from "@/pages/learner/CanonicalMissionRun";
import RepresentativeMissionDemo from "@/pages/RepresentativeMissionDemo";

const MJT_LABELS = ["단일 표현 판단", "판단과 근거", "복수 표현 비교", "수정안 선택", "직접 수정"];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderDemo(search: string) {
  window.scrollTo = vi.fn();
  return render(<MemoryRouter initialEntries={[`/demo/mission${search}`]}>
    <Routes><Route path="/demo/mission" element={<><RepresentativeMissionDemo /><LocationProbe /></>} /></Routes>
  </MemoryRouter>);
}

const currentStep = () => new URLSearchParams(screen.getByTestId("location").textContent ?? "").get("step");

describe("demo step mapping", () => {
  it("maps manuscript MJT numbers to stored quest IDs without renaming them", () => {
    const quests = ["A1", "A2", "A5", "A3", "A4"].map(id => ({ id, kind: "scale" })).concat({ id: "D1", kind: "dct" });
    expect(["mjt1", "mjt2", "mjt3", "mjt4", "mjt5"].map(step => quests[demoQuestIndex(quests, parseDemoStep(`?step=${step}`))].id))
      .toEqual(["A1", "A2", "A5", "A3", "A4"]);
    expect(quests[demoQuestIndex(quests, "dct")].id).toBe("D1");
    expect(demoStepForQuest({ id: "A5", kind: "spectrum" })).toBe("mjt3");
    expect(demoStepForQuest({ id: "D1F", kind: "dct_feedback" })).toBe("dct");
    expect(parseDemoStep("?step=mjt6")).toBeUndefined();
  });
});

describe("representative mission demo: free navigation", () => {
  it.each([
    ["ko_zh", "translation", "번역"],
    ["ko_zh", "interpreting", "통역"],
    ["zh_ko", "translation", "번역"],
    ["zh_ko", "interpreting", "통역"],
  ] as const)("opens every step directly for %s %s", async (direction, mode, outputName) => {
    for (const [number, label] of MJT_LABELS.entries()) {
      const view = renderDemo(`?direction=${direction}&mode=${mode}&step=mjt${number + 1}`);
      const selected = await screen.findByRole("button", { name: `MJT ${number + 1} · ${label}` });
      expect(selected).toHaveAttribute("aria-current", "step");
      expect(currentStep()).toBe(`mjt${number + 1}`);
      view.unmount();
    }
    renderDemo(`?direction=${direction}&mode=${mode}&step=dct`);
    expect(await screen.findByText(new RegExp(`현재 단계: ${outputName}하기`))).toBeInTheDocument();
    expect(currentStep()).toBe("dct");
  });

  it("starts from the briefing then jumps without answering and preserves the step in mode links", async () => {
    const view = renderDemo("?direction=ko_zh&mode=translation");
    expect(screen.queryByRole("button", { name: "번역하기 단계로 이동" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "한 → 중 번역 시작하기" }));
    fireEvent.click(await screen.findByRole("button", { name: "번역하기 단계로 이동" }));
    expect(screen.getByText(/현재 단계: 번역하기/)).toBeInTheDocument();
    expect(currentStep()).toBe("dct");
    // Moving alone must not mark skipped stages as done.
    expect(view.container.querySelector('[class*="F3D248"]')).toBeNull();
    expect(screen.getByRole("link", { name: "한 → 중 통역 미션" })).toHaveAttribute("href", "/demo/mission?direction=ko_zh&mode=interpreting&step=dct");
    expect(screen.getByRole("link", { name: "중 → 한 번역 미션" })).toHaveAttribute("href", "/demo/mission?direction=zh_ko&mode=translation&step=dct");

    fireEvent.click(screen.getByRole("button", { name: "MJT 3 · 복수 표현 비교" }));
    expect(currentStep()).toBe("mjt3");
    fireEvent.click(screen.getByRole("button", { name: "MJT 1 · 단일 표현 판단" }));
    expect(currentStep()).toBe("mjt1");
    expect(view.container.querySelector('[class*="F3D248"]')).toBeNull();
    expect(screen.queryByText("학습 미션 완료")).not.toBeInTheDocument();
  });

  it("keeps the learner mission in order: unanswered items and stages are not jump targets", () => {
    window.scrollTo = vi.fn();
    const runtime = { scenario_id: "86d738b0-1891-4bfe-9b12-f8643ebbb45f", speech_act: "request" as const,
      learner_level: "intermediate" as const, mission_status: "reviewed", release_gate_mode: "legacy_reviewed",
      direction: "ko_zh" as const, mission: SAMPLE_MISSION_V6_REASON_CONTRAST };
    render(<MemoryRouter initialEntries={["/learner/mission/x?step=dct"]}><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)} runtime={runtime}
      isDevPreview={false} /><LocationProbe /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /번째 문항으로 이동/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /단계로 이동/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^MJT \d/ })).not.toBeInTheDocument();
    // step= is ignored outside the demo: the learner still starts at the briefing.
    expect(screen.getByText(/현재 단계: 미션 안내/)).toBeInTheDocument();
  });
});
