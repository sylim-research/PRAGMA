// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import { requestFeedback } from "@/lib/mission/missionFeedback";
import { saveMissionAttempt } from "@/lib/mission/missionLog";
import { appendMissionEvent } from "@/lib/mission/missionEvents";

const scenarioId = "86d738b0-1891-4bfe-9b12-f8643ebbb45f";
const { fetchMissionByScenario } = vi.hoisted(() => ({
  fetchMissionByScenario: vi.fn(),
}));

vi.mock("@/lib/mission/missionDb", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mission/missionDb")>();
  return { ...original, fetchMissionByScenario };
});

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));
vi.mock("@/lib/mission/missionEvents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mission/missionEvents")>(),
  appendMissionEvent: vi.fn().mockResolvedValue({ ok: true, id: "event" }),
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));

import CanonicalMissionRun, {
  CanonicalMissionRunner,
  buildRuntimeMpjTraces,
  feedbackNeedsRevision,
  primaryFeedbackCriterion,
  shouldPersistMissionAttempt,
} from "@/pages/learner/CanonicalMissionRun";

describe("CanonicalMissionRun live CTA route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    window.history.replaceState({}, "", "/");
    fetchMissionByScenario.mockResolvedValue({
      scenario_id: scenarioId,
      speech_act: "request",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "legacy_reviewed",
      direction: "ko_zh",
      mission: SAMPLE_MISSION_V5,
    });
  });

  it.each(["error", "rejection"])("retries a %s without repeating the mission, feedback, or completion event", async (failure) => {
    const runtime = {
      scenario_id: scenarioId, speech_act: "request" as const, learner_level: "intermediate" as const,
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed" as const,
      direction: "ko_zh" as const, mission: SAMPLE_MISSION_V5_NATIVE,
    };
    const courseContext = {
      courseId: "915fec24-cc38-4b00-a2a0-c3628abcd3f7", weekNo: 2,
      assignmentId: "1b7b468e-d47b-46ab-ba16-642ad8be5bc5",
    };
    // Seed earlier judgments through the existing development helper; exercise the real DCT/save UI.
    window.history.replaceState({}, "", "/?step=A-DCT");
    vi.mocked(requestFeedback).mockResolvedValue({ ok: false, error: "test feedback unavailable" });
    const save = vi.mocked(saveMissionAttempt);
    if (failure === "error") save.mockResolvedValueOnce({ ok: false, reason: "error" });
    else save.mockRejectedValueOnce(new Error("connection lost"));
    let finishSave!: (result: { ok: true; id: string }) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    render(<MemoryRouter><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)} runtime={runtime} courseContext={courseContext} isDevPreview /></MemoryRouter>);
    const first = "请问方便把报告的原文件再发给我吗？";
    fireEvent.change(screen.getByPlaceholderText("중국어 번역을 작성하세요."), { target: { value: first } });
    fireEvent.click(screen.getByRole("button", { name: "번역 제출하기" }));
    fireEvent.click(await screen.findByRole("button", { name: "이 번역으로 확정하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 저장하지 못했습니다");
    expect(save).toHaveBeenCalledTimes(1);
    const [originalInput, originalId] = save.mock.calls[0];
    expect(originalInput).toMatchObject({ firstResponse: first, revisedResponse: first, courseContext });
    expect(originalInput.mpjResponses).toHaveLength(5);
    expect(originalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(vi.mocked(appendMissionEvent).mock.calls.filter(([event]) => event.eventType === "mission_completed")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "학습 기록 저장 다시 시도" }));
    expect(screen.getByRole("button", { name: "처음부터 다시 보기" })).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toBe(originalInput);
    expect(save.mock.calls[1][1]).toBe(originalId);
    await act(async () => finishSave({ ok: true, id: originalId! }));
    await waitFor(() => expect(screen.getByText("학습 기록에 저장되었습니다.")).toBeInTheDocument());
    expect(requestFeedback).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendMissionEvent).mock.calls.filter(([event]) => event.eventType === "mission_completed")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "나의 학습 기록 보기" })).toHaveAttribute("href", "/learner/records#correction-notes");
  });

  it("shows the live scenario intro before entering the five-judgment screen", async () => {
    render(
      <MemoryRouter initialEntries={[`/learner/practice/${scenarioId}`]}>
        <Routes>
          <Route path="/learner/practice/:scenarioId" element={<CanonicalMissionRun />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: SAMPLE_MISSION_V5.production_task.situation_ko })).toBeInTheDocument();
    expect(screen.getByText("요청 표현 · 한국어 → 중국어")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "상황에 맞는 표현 판단하기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /장면 속 단서 보기/ }));
    expect(screen.getByText(/채널은 위챗이고/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /내가 할 일 확인/ }));
    expect(screen.getByRole("heading", { name: "어떤 중국어 요청 표현이 이 장면에 어울릴까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /5개 장면으로 감 잡기/ }));

    expect(await screen.findByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_MISSION_V5.mpj_items[0].situation_ko)).toBeInTheDocument();
    expect(screen.getByText(/^P · /)).toBeInTheDocument();
    expect(screen.getByText(/^D · /)).toBeInTheDocument();
    expect(screen.getByText(/^R · /)).toBeInTheDocument();
    expect(fetchMissionByScenario).toHaveBeenCalledWith(scenarioId);
  });

  it("opens an interpreting DCT directly and labels the skipped judgments", async () => {
    const interpretingMission = structuredClone(SAMPLE_MISSION_V5);
    interpretingMission.production_task.mode = "interpreting";
    fetchMissionByScenario.mockResolvedValueOnce({
      scenario_id: scenarioId,
      speech_act: "request",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "legacy_reviewed",
      direction: "ko_zh",
      mission: interpretingMission,
    });

    window.history.replaceState({}, "", "/?start=dct");
    render(
      <MemoryRouter initialEntries={[`/learner/practice/${scenarioId}?start=dct`]}>
        <Routes>
          <Route path="/learner/practice/:scenarioId" element={<CanonicalMissionRun />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("통역 수행 콘솔")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("앞의 표현 판단 활동은 수행 기록에 포함되지 않습니다.");
    expect(screen.queryByRole("heading", { name: "상황에 맞는 표현 판단하기" })).not.toBeInTheDocument();
  });

  it("does not render a native MPJ5 preceding-turn card even for a response act", async () => {
    const mission = JSON.parse(
      JSON.stringify(SAMPLE_MISSION_V5_NATIVE)
        .split("request_mitigation_optionality").join("refusal_softening")
        .split("too_direct").join("too_blunt")
        .split("too_indirect").join("over_elaborate"),
    ) as typeof SAMPLE_MISSION_V5_NATIVE;
    mission.mpj_items[0].preceding_turn = "UI에 표시하면 안 되는 legacy 값";
    fetchMissionByScenario.mockResolvedValueOnce({
      scenario_id: scenarioId,
      speech_act: "refusal",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "authoritative_release",
      direction: "ko_zh",
      mission,
    });

    render(
      <MemoryRouter initialEntries={[`/learner/practice/${scenarioId}`]}>
        <Routes>
          <Route path="/learner/practice/:scenarioId" element={<CanonicalMissionRun />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: mission.production_task.situation_ko });
    fireEvent.click(screen.getByRole("button", { name: /장면 속 단서 보기/ }));
    fireEvent.click(screen.getByRole("button", { name: /내가 할 일 확인/ }));
    fireEvent.click(screen.getByRole("button", { name: /5개 장면으로 감 잡기/ }));

    expect(await screen.findByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeInTheDocument();
    expect(screen.queryByText("상대의 말")).not.toBeInTheDocument();
    expect(screen.queryByText("UI에 표시하면 안 되는 legacy 값")).not.toBeInTheDocument();
  });

  it("does not force a revision when automatic feedback is unavailable", () => {
    expect(feedbackNeedsRevision({
      available: false,
      criteria: [
        { key: "meaning", label: "의미 전달", question: "", level: "recommend", body: "판정 불가" },
      ],
    })).toBe(false);
  });

  it("학습자 원포인트는 심각도와 무관하게 의미→언어→화용 순서의 첫 보완 항목이다", () => {
    expect(primaryFeedbackCriterion([
      { key: "meaning", label: "의미 전달", question: "", level: "recommend", body: "의미 먼저" },
      { key: "language", label: "문법 정확성", question: "", level: "very_good", body: "언어" },
      { key: "pragmatics", label: "화용 적절성", question: "", level: "required", body: "화용" },
    ])).toMatchObject({ key: "meaning", body: "의미 먼저" });

    expect(primaryFeedbackCriterion([
      { key: "meaning", label: "의미 전달", question: "", level: "very_good", body: "의미" },
      { key: "language", label: "문법 정확성", question: "", level: "required", body: "언어 먼저" },
      { key: "pragmatics", label: "화용 적절성", question: "", level: "required", body: "화용" },
    ])).toMatchObject({ key: "language", body: "언어 먼저" });
  });

  it("stores five native MPJ items as five independent traces", () => {
    const traces = buildRuntimeMpjTraces({
      scenario_id: scenarioId,
      speech_act: "request",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "authoritative_release",
      direction: "ko_zh",
      mission: SAMPLE_MISSION_V5_NATIVE,
    }, {
      A1: { pick: "somewhat_appropriate" },
      A2: { pick: "too_direct" },
      A3: { judgment: "too_direct", correctionIds: ["A3-0"] },
      A4: { initialJudgment: "appropriate", reasonId: "r2" },
      A5: { best: "A5-1", worst: "A5-4" },
    } as Parameters<typeof buildRuntimeMpjTraces>[1]);

    expect(traces).toMatchObject([
      { item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" },
      { item_id: 2, item_type: "judge3", band_code: "too_direct" },
      { item_id: 3, item_type: "fix_choice", band_code: "too_direct", correction_indexes: [0] },
      { item_id: 4, item_type: "reason", initial_judgment: "appropriate", reason_id: "r2", reason_kind: "primary" },
      { item_id: 5, item_type: "multi_judge", best_candidate_index: 1, worst_candidate_index: 4 },
    ]);
  });

  it("keeps the representative demo on the live runtime without saving an attempt", () => {
    const runtime = {
      scenario_id: scenarioId,
      speech_act: "request" as const,
      learner_level: "intermediate" as const,
      mission_status: "reviewed",
      release_gate_mode: "legacy_reviewed",
      direction: "ko_zh" as const,
      mission: SAMPLE_MISSION_V5,
    };

    expect(shouldPersistMissionAttempt(runtime, "dct_feedback", false)).toBe(true);
    expect(shouldPersistMissionAttempt(runtime, "dct_feedback", true)).toBe(false);
    expect(shouldPersistMissionAttempt(runtime, "scale", false)).toBe(false);
  });
});
