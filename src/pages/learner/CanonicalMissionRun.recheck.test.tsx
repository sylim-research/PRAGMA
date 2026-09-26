// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanonicalMissionRunner } from "./CanonicalMissionRun";
import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import { requestFeedback, type FeedbackRequestResult } from "@/lib/mission/missionFeedback";
import { saveMissionAttempt } from "@/lib/mission/missionLog";
import { buildMissionAttemptRow } from "@/lib/mission/missionAttemptRow";
import { appendMissionEvent } from "@/lib/mission/missionEvents";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));
vi.mock("@/lib/mission/missionEvents", async original => ({
  ...await original<typeof import("@/lib/mission/missionEvents")>(),
  appendMissionEvent: vi.fn().mockResolvedValue({ ok: true, id: "event" }),
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));

const A = "您好，这个周末我需要出门，请帮我代收快递。";
const B = "您好，这个周末我有急事需要出门，请问您方便帮我代收快递吗？";
const C = "您好，这个周末我有急事需要出门，如果您方便，能帮我代收快递吗？非常感谢。";
const hash = "bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095";
const feedback = (round: number): RuntimeFeedback => ({
  schema_version: "feedback_v1", rubric_version: "request_mitigation_optionality@1.1", revision_scope: "feature",
  verdicts: { semantic_fidelity: "preserved", grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "request_mitigation_optionality", band_code: "too_direct" } },
  blocks: { meaning_ko: `${round}차 의미 확인`, grammar: [], feature_ko: `${round}차 선택권 재검토`, alternatives: [], discourse_ko: "", offfocus_warnings: [] },
  uncertainty_flags: [], provenance: { model: "mock", prompt_version: "unchanged", content_release_id: "mock", generated_at: `round-${round}` },
});
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(saveMissionAttempt).mockResolvedValue({ ok: true, id: "saved" });
});
function openDraft() {
  const mission = structuredClone(SAMPLE_MISSION_V6_REASON_CONTRAST);
  mission.provenance = { model: "mock", prompt_version: "mock", generated_at: "2026-09-26T00:00:00Z", generation_attempt: 1, mission_content_hash: hash };
  const before = JSON.stringify(mission);
  const runtime = { scenario_id: "3da0c62d-e91f-4f68-9b74-28cd9d42f044", speech_act: "request" as const,
    learner_level: "intermediate" as const, mission_status: "reviewed", release_gate_mode: "legacy_reviewed",
    direction: "ko_zh" as const, mission };
  window.history.replaceState({}, "", "/");
  render(<StrictMode><MemoryRouter><CanonicalMissionRunner mission={adaptRunnableMissionToCanonical(runtime)}
    runtime={runtime} isDevPreview={false} /></MemoryRouter></StrictMode>);
  click(/학습 미션 시작하기/);
  click("다소 적절"); click("답안 확인하기"); click(/^다음:/);
  click("매우 적절"); click("판단 확정하기");
  fireEvent.click(screen.getByRole("radio", { name: mission.mpj_items[1].reason_choice.options[1].text }));
  click("이유 확정하기"); click(/^다음:/);
  screen.getAllByRole("radio", { name: "상황에 맞음" }).forEach(button => fireEvent.click(button));
  click("네 표현 확인하기"); click(/^다음:/);
  click(mission.mpj_items[2].corrections[1].text); click("교정안 확인하기"); click(/^다음:/);
  fireEvent.change(screen.getByRole("textbox", { name: "내가 고친 표현" }), { target: { value: "明天我下课晚，彩排能改到七点半吗？" } });
  click("수정안 제출하기"); click(/^다음:/); click("번역하기");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: A } });
  click("번역 제출하기");
  return { mission, before };
}
describe("one DCT revision recheck", () => {
  it("keeps A with dissent, one feedback request and the original save mapping", async () => {
    vi.mocked(requestFeedback).mockResolvedValue({ ok: true, feedback: feedback(1) });
    openDraft();
    await screen.findByText("1차 선택권 재검토");
    expect(screen.queryByRole("region", { name: "참고 표현" })).not.toBeInTheDocument();
    click(/내 판단 남기기/);
    fireEvent.change(screen.getByPlaceholderText("어떤 점에서 다르게 봤는지 한 줄로 적어 주세요."), { target: { value: "이 상황에서는 첫 표현을 유지하겠습니다." } });
    click("내 판단 남기기"); click("내 번역을 유지하고 확정하기");
    await waitFor(() => expect(saveMissionAttempt).toHaveBeenCalledTimes(1));
    expect(requestFeedback).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveMissionAttempt).mock.calls[0][0]).toMatchObject({ firstResponse: A, revisedResponse: A,
      feedback: feedback(1), contextJudgment: { reason_ko: "이 상황에서는 첫 표현을 유지하겠습니다.", final_decision: "retained_first_response" } });
    expect(screen.getByRole("region", { name: "참고 표현" })).toBeInTheDocument();
  });

  it.each(["success", "failure"])("evaluates B once, allows final C and preserves A/B provenance after second %s", async status => {
    let settle!: (result: FeedbackRequestResult) => void;
    vi.mocked(requestFeedback).mockResolvedValueOnce({ ok: true, feedback: feedback(1) })
      .mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
    const { mission, before } = openDraft();
    await screen.findByText("1차 선택권 재검토");
    click("한 번 다듬어보기");
    fireEvent.change(screen.getByRole("textbox", { name: "수정안" }), { target: { value: B } });
    const recheckButton = screen.getByRole("button", { name: "수정안 다시 확인하기" });
    fireEvent.click(recheckButton); fireEvent.click(recheckButton);
    await waitFor(() => expect(requestFeedback).toHaveBeenCalledTimes(2));
    expect(requestFeedback).toHaveBeenNthCalledWith(1, mission, A);
    expect(requestFeedback).toHaveBeenNthCalledWith(2, mission, B);
    expect(screen.queryByRole("button", { name: "최종안 확정하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "참고 표현" })).not.toBeInTheDocument();
    await act(async () => settle(status === "success" ? { ok: true, feedback: feedback(2) } : { ok: false, error: "offline" }));
    expect(screen.getByRole("heading", { name: "수정안 AI 피드백" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "최종안" })).toHaveValue(B);
    if (status === "failure") expect(screen.getByText(/현재 번역안을 직접 검토한 뒤 최종 결정/)).toBeInTheDocument();
    // 2차가 수정 권고여도 AI 승인을 기다리지 않는다. 최종 텍스트는 세 번째 호출을 만들지 않는다.
    fireEvent.change(screen.getByRole("textbox", { name: "최종안" }), { target: { value: C } });
    expect(screen.getByText(/추가 수정에는 AI 피드백을 다시 실행하지 않습니다/)).toBeInTheDocument();
    click("최종안 확정하기");
    await waitFor(() => expect(saveMissionAttempt).toHaveBeenCalledTimes(1));
    expect(requestFeedback).toHaveBeenCalledTimes(2);
    const saved = vi.mocked(saveMissionAttempt).mock.calls[0][0];
    expect(saved).toMatchObject({ firstResponse: A, revisedResponse: C, feedback: feedback(1) });
    const row = buildMissionAttemptRow(saved, "profile", "auth");
    expect(row).toMatchObject({ first_response: A, revised_response: C, content_hash: hash, target_feature_observed: feedback(1) });
    const event = vi.mocked(appendMissionEvent).mock.calls.find(([event]) => event.eventType === "feedback_received")![0];
    expect(event.payload?.feedback_rounds).toEqual([
      { round: 1, answer: A, result: { ok: true, feedback: feedback(1) } },
      { round: 2, answer: B, result: status === "success" ? { ok: true, feedback: feedback(2) } : { ok: false, error: "offline" } },
    ]);
    expect(screen.getByRole("region", { name: "참고 표현" })).toBeInTheDocument();
    expect(JSON.stringify(mission)).toBe(before);
  });
});
