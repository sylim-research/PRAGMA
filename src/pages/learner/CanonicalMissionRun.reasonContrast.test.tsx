// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MISSION_V6_REASON_CONTRAST as mission, REASON_CONTRAST_PILOT_STORAGE_KEY as storageKey } from "@/lib/mission/missionV6Sample";
import { LEARNER_UX_PILOT_STORAGE_KEY } from "@/lib/mission/learnerUxPilot";
import { buildMissionV6Responses } from "@/lib/mission/missionV6Responses";

const { fetchMissionByScenario, requestFeedback, saveMissionAttempt, appendMissionEvent } = vi.hoisted(() => ({
  fetchMissionByScenario: vi.fn(), requestFeedback: vi.fn(), saveMissionAttempt: vi.fn(), appendMissionEvent: vi.fn(),
}));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionByScenario }));
vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt }));
vi.mock("@/lib/mission/missionEvents", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/mission/missionEvents")>(), appendMissionEvent,
}));
vi.mock("@/components/learner/PeerResponsesPanel", () => ({ PeerResponsesPanel: () => null }));
import CanonicalMissionRun from "./CanonicalMissionRun";

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const snapshot = () => JSON.parse(sessionStorage.getItem(storageKey)!);
const feedbackSentence = mission.mpj_items[1].explanation_ko.split(". ")[1];
const reconsiderHint = "이유를 살펴본 뒤 생각이 달라졌다면 위에서 판단을 바꿀 수 있습니다.";
const toSecondJudgment = () => {
  render(<MemoryRouter><CanonicalMissionRun /></MemoryRouter>);
  click("다소 적절"); click("답안 확인하기"); click("다음: 상황에 맞는지 판단하기");
};
describe("representative v6 reason / contrast rhythm", () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/learner/practice?preview=v5&pilot=free-correction&variant=reason-contrast");
  });
  afterEach(cleanup);

  it("holds the first judgment until a reason is chosen, lets it change afterwards, and carries both into the serializer", () => {
    toSecondJudgment();
    const reason = mission.mpj_items[1].reason_choice.options[0];
    expect(screen.queryByText(reason.text)).not.toBeInTheDocument();
    expect(screen.queryByText(feedbackSentence)).not.toBeInTheDocument();
    click("매우 적절"); click("판단 확정하기");
    expect(screen.getByRole("button", { name: "매우 적절" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "다소 부적절" })).not.toBeInTheDocument();
    expect(screen.queryByText(reconsiderHint)).not.toBeInTheDocument();
    expect(screen.queryByText(feedbackSentence)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "가능한 수정 예시" })).not.toBeInTheDocument();
    const reasons = screen.getByRole("radiogroup", { name: "판단 이유" });
    expect(within(reasons).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "판단과 이유 확인하기" })).toBeDisabled();
    fireEvent.click(within(reasons).getByRole("radio", { name: reason.text }));
    expect(screen.getByText(reconsiderHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다소 부적절" })).toBeEnabled();
    expect(screen.queryByText(feedbackSentence)).not.toBeInTheDocument();
    click("다소 부적절");
    click("판단과 이유 확인하기");
    expect(screen.getByText(feedbackSentence)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "판단 이유" })).not.toBeInTheDocument();
    click("다음: 판단하고 고쳐 보기");
    expect(snapshot().responses.A2).toEqual({ pick: "very_appropriate", reasonId: reason.id, revisedPick: "somewhat_inappropriate" });
    click(mission.mpj_items[2].corrections[0].text); click("교정안 확인하기"); click("다음: 직접 고쳐 보기");
    expect(screen.queryByRole("region", { name: "다른 맥락에서는?" })).not.toBeInTheDocument();
    const revisedText = "明天我下课晚，大家方便把彩排改到七点半吗？";
    fireEvent.change(screen.getByRole("textbox", { name: "내가 고친 번역" }), { target: { value: revisedText } });
    click("수정안 제출하기");
    const contrast = screen.getByRole("region", { name: "다른 맥락에서는?" });
    expect(within(contrast).getByText(mission.mpj_items[3].contrast.target)).toBeInTheDocument();
    expect(within(contrast).queryByRole("button")).not.toBeInTheDocument();
    click("다음: 표현 비교하기");
    expect(snapshot().responses.A4).toEqual({ revisedText });
    ["상황에 맞음", "너무 직접적", "지나치게 우회적", "상황에 맞음"].forEach((band, i) => {
      fireEvent.click(within(screen.getByRole("radiogroup", { name: `표현 ${i + 1}의 위치` })).getByRole("radio", { name: band }));
    });
    click("네 표현 확인하기"); click("다음: 직접 옮겨 보기");
    const traces = buildMissionV6Responses(mission, snapshot().responses, "2026-09-14T12:00:00.000Z");
    expect(traces[1]).toMatchObject({ scale_code: "very_appropriate", reason_id: reason.id, revised_scale_code: "somewhat_inappropriate" });
    expect(traces[3].revised_text).toBe(revisedText);
    expect(traces[4].candidate_band_codes).toEqual(["appropriate", "too_direct", "too_indirect", "appropriate"]);
    expect(sessionStorage.getItem(LEARNER_UX_PILOT_STORAGE_KEY)).toBeNull();
    click("직접 옮겨 보기");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "您好，下周三下午三点到四点能借用研讨室吗？我们社团想和新成员开第一次见面会。" } });
    click("번역 제출하기");
    expect(screen.getByText("AI 미실행")).toBeInTheDocument();
    click("이 번역으로 확정하기");
    expect(snapshot().completed).toBe(true);
    for (const external of [fetchMissionByScenario, requestFeedback, saveMissionAttempt, appendMissionEvent]) expect(external).not.toHaveBeenCalled();
  });

  it("keeps only the first judgment when it is not changed after the reason", () => {
    toSecondJudgment();
    const reason = mission.mpj_items[1].reason_choice.options[1];
    click("다소 적절"); click("판단 확정하기");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "판단 이유" })).getByRole("radio", { name: reason.text }));
    click("매우 부적절"); click("다소 적절");
    click("판단과 이유 확인하기"); click("다음: 판단하고 고쳐 보기");
    expect(snapshot().responses.A2).toEqual({ pick: "somewhat_appropriate", reasonId: reason.id });
  });
});
