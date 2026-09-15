// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
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
  it("opens an actual v6 runtime with no responses and keeps save validation strict", () => {
    window.scrollTo = vi.fn();
    const runtime = { scenario_id: scenarioId, speech_act: "request" as const, learner_level: "intermediate" as const,
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed", direction: "ko_zh" as const,
      mission: SAMPLE_MISSION_V6_REASON_CONTRAST };
    render(<MemoryRouter><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)}
      runtime={runtime} isDevPreview={false} /></MemoryRouter>);
    // v6 learners see the six-activity briefing first; no item content is shown before starting.
    const briefing = screen.getByRole("list", { name: "이번 미션의 활동" });
    expect(within(briefing).getAllByRole("listitem")).toHaveLength(6);
    expect(within(briefing).getByText("6. 새 상황 직접 번역")).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_MISSION_V6_REASON_CONTRAST.mpj_items[0].source)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /미션 안내, 표현 판단/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));
    expect(screen.getByRole("button", { name: "답을 선택해 주세요" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "매우 적절" }));
    fireEvent.click(screen.getByRole("button", { name: "답안 확인하기" }));
    fireEvent.click(screen.getByRole("button", { name: /^다음:/ }));
    expect(screen.getByRole("button", { name: "답을 선택해 주세요" })).toBeDisabled();
    expect(saveMissionAttempt).not.toHaveBeenCalled();
    expect(() => buildRuntimeMpjTraces(runtime, {})).toThrow();
  });
  it("runs a v6 runtime from the DCT draft through feedback, revision and final confirmation, then saves both responses", async () => {
    window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
    const mission = SAMPLE_MISSION_V6_REASON_CONTRAST;
    const runtime = { scenario_id: scenarioId, speech_act: "request" as const, learner_level: "intermediate" as const,
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed", direction: "ko_zh" as const, mission };
    vi.mocked(requestFeedback).mockResolvedValue({ ok: false, error: "test feedback unavailable" });
    vi.mocked(saveMissionAttempt).mockResolvedValue({ ok: true, id: "log-1" });
    render(<MemoryRouter><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)} runtime={runtime} isDevPreview={false} /></MemoryRouter>);
    const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
    click(/표현 판단 시작하기/);
    click("다소 적절"); click("답안 확인하기"); click(/^다음:/);
    const reason = mission.mpj_items[1].reason_choice.options[1];
    click("매우 적절"); click("판단 확정하기");
    fireEvent.click(screen.getByRole("radio", { name: reason.text }));
    click("다소 부적절"); click("판단과 이유 확인하기"); click(/^다음:/);
    click(mission.mpj_items[2].corrections[1].text); click("교정안 확인하기"); click(/^다음:/);
    fireEvent.change(screen.getByRole("textbox", { name: "내가 고친 번역" }), { target: { value: "明天我下课晚，彩排能改到七点半吗？" } });
    click("수정안 제출하기"); click(/^다음:/);
    ["상황에 맞음", "너무 직접적", "지나치게 우회적", "상황에 맞음"].forEach((band, i) => {
      fireEvent.click(within(screen.getByRole("radiogroup", { name: `표현 ${i + 1}의 위치` })).getByRole("radio", { name: band }));
    });
    click("네 표현 확인하기"); click(/^다음:/);
    click("직접 옮겨 보기");
    const first = "您好，请问下周三下午三点到四点可以借用研讨室吗？";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: first } });
    click("번역 제출하기");
    // Stage 2: feedback for the submitted draft (live request, not a preview).
    expect(await screen.findByRole("heading", { name: "번역 피드백" })).toBeInTheDocument();
    expect(requestFeedback).toHaveBeenCalledWith(mission, first);
    await screen.findByText("자동 피드백을 확인하지 못했습니다.");
    // Stage 3: revision.
    click("다른 표현도 시도해보기");
    const revised = "您好，我们想在下周三下午三点到四点借用研讨室，请问可以吗？";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: revised } });
    // Stage 4: final confirmation and save.
    click("수정안 확정하기");
    expect(await screen.findByRole("heading", { name: /이번 미션에서 확정한 내/ })).toBeInTheDocument();
    await waitFor(() => expect(saveMissionAttempt).toHaveBeenCalledTimes(1));
    const [input] = vi.mocked(saveMissionAttempt).mock.calls[0];
    expect(input).toMatchObject({ firstResponse: first, revisedResponse: revised });
    expect(input.mpjResponses?.[1]).toMatchObject({ scale_code: "very_appropriate", reason_id: reason.id, revised_scale_code: "somewhat_inappropriate" });
    expect(requestFeedback).toHaveBeenCalledTimes(1);
  });
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

  it.each(["translation", "interpreting"] as const)("fills the live %s demo through completion without storing responses or repeating feedback", async (mode) => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.production_task.mode = mode;
    const runtime = {
      scenario_id: scenarioId, speech_act: "request" as const, learner_level: "intermediate" as const,
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed" as const,
      direction: "ko_zh" as const, mission,
    };
    const viewModel = adaptRunnableMissionToCanonical(runtime);
    vi.mocked(requestFeedback).mockResolvedValue({ ok: false, error: "test feedback unavailable" });
    Element.prototype.scrollIntoView = vi.fn();
    render(<MemoryRouter><CanonicalMissionRunner mission={viewModel} runtime={runtime} isDevPreview={false} demoMode /></MemoryRouter>);
    const fill = () => fireEvent.click(screen.getByRole("button", { name: "데모 답안 채워넣기" }));
    expect(screen.queryByRole("button", { name: "데모 답안 채워넣기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));
    expect(screen.getByRole("button", { name: "답을 선택해 주세요" })).toBeDisabled();
    for (const [confirm, next] of [
      ["답안 확인하기", "다음: 상황에 맞는지 판단하기"],
      ["답안 확인하기", "다음: 판단하고 고쳐 보기"],
      ["교정안 확인하기", "다음: 부적절한 이유 찾기"],
      ["이유 확인하기", "다음: 표현 비교하기"],
      ["두 표현 확인하기", "다음: 직접 옮겨 보기"],
    ]) {
      fill();
      const confirmButton = screen.getByRole("button", { name: confirm });
      expect(confirmButton).toBeEnabled();
      fireEvent.click(confirmButton);
      fireEvent.click(screen.getByRole("button", { name: next }));
    }
    expect(screen.queryByRole("button", { name: "데모 답안 채워넣기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "직접 옮겨 보기" }));
    fill();
    const reference = mission.production_task.reference_alternatives[0].text;
    if (mode === "translation") {
      const draft = screen.getByRole("textbox", { name: /상황에 맞게 중국어로/ });
      expect(draft).toHaveValue(reference);
      fireEvent.change(draft, { target: { value: "직접 고친 임시 답안" } });
      fill();
      expect(screen.getByRole("textbox", { name: /상황에 맞게 중국어로/ })).toHaveValue(reference);
      expect(requestFeedback).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "번역 제출하기" }));
    } else {
      expect(screen.getByText("시연용 전사 예시입니다. 실제 녹음한 내용이 아닙니다.")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("통역한 중국어 문장")).toHaveValue(reference);
      expect(screen.queryByLabelText("내 통역 녹음")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "확인한 전사로 제출" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "말한 내용과 같아요" }));
      fireEvent.click(screen.getByRole("button", { name: "확인한 전사로 제출" }));
    }
    await screen.findByText("자동 피드백을 확인하지 못했습니다.");
    fill();
    const revision = screen.getByRole("textbox");
    const alternate = mission.production_task.reference_alternatives.find(item => item.text !== reference)?.text ?? reference;
    expect(revision).toHaveValue(alternate);
    fireEvent.change(revision, { target: { value: "다시 고친 임시 답안" } });
    fill();
    expect(screen.getByRole("textbox")).toHaveValue(alternate);
    expect(requestFeedback).toHaveBeenCalledTimes(1);
    expect(requestFeedback).toHaveBeenCalledWith(mission, reference);
    fireEvent.click(screen.getByRole("button", { name: alternate === reference ? `이 ${mode === "translation" ? "번역" : "통역"}으로 확정하기` : "수정안 확정하기" }));
    expect(await screen.findByRole("heading", { name: /이번 미션에서 확정한 내/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "데모 답안 채워넣기" })).not.toBeInTheDocument();
    expect(saveMissionAttempt).not.toHaveBeenCalled();
    expect(appendMissionEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 보기" }));
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));
    expect(screen.getByRole("button", { name: "답을 선택해 주세요" })).toBeDisabled();
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
    fireEvent.change(screen.getByRole("textbox", { name: /상황에 맞게 중국어로/ }), { target: { value: first } });
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
    expect(screen.queryByRole("button", { name: "데모 답안 채워넣기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "상황에 맞는 표현 판단하기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));

    expect(await screen.findByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_MISSION_V5.mpj_items[0].situation_ko)).toBeInTheDocument();
    expect(screen.getByText(/^상대적 지위 · /)).toBeInTheDocument();
    expect(screen.getByText(/^친숙도 · /)).toBeInTheDocument();
    expect(screen.getByText(/^부담 · /)).toBeInTheDocument();
    expect(fetchMissionByScenario).toHaveBeenCalledWith(scenarioId, { includeV6: true });
  });

  it.each([
    ["translation", "start=dct"], ["interpreting", "start=dct"],
    ["translation", "step=A-DCT"], ["interpreting", "step=A-DCT"],
  ] as const)("keeps the live %s intro when the URL contains %s", async (mode, query) => {
    const mission = structuredClone(SAMPLE_MISSION_V5);
    mission.production_task.mode = mode;
    fetchMissionByScenario.mockResolvedValueOnce({
      scenario_id: scenarioId, speech_act: "request", learner_level: "intermediate",
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed", direction: "ko_zh", mission,
    });
    window.history.replaceState({}, "", `/?${query}`);
    render(
      <MemoryRouter initialEntries={[`/learner/practice/${scenarioId}?${query}`]}>
        <Routes><Route path="/learner/practice/:scenarioId" element={<CanonicalMissionRun />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: mission.production_task.situation_ko })).toBeInTheDocument();
    expect(screen.queryByText("통역 수행 콘솔")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /상황에 맞게 중국어로/ })).not.toBeInTheDocument();
    expect(appendMissionEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "mission_session_opened", taskMode: mode, payload: { entry_mode: "full_mission" },
    }));
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));
    expect(screen.getByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeInTheDocument();
    expect(saveMissionAttempt).not.toHaveBeenCalled();
  });

  it("keeps DCT step navigation in the development preview without saving learner records", () => {
    window.history.replaceState({}, "", "/?preview=v5&step=A-DCT");
    render(<MemoryRouter><CanonicalMissionRun /></MemoryRouter>);
    expect(screen.getByRole("textbox", { name: /상황에 맞게 중국어로/ })).toBeInTheDocument();
    expect(fetchMissionByScenario).not.toHaveBeenCalled();
    expect(saveMissionAttempt).not.toHaveBeenCalled();
    expect(appendMissionEvent).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: /표현 판단 시작하기/ }));

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
