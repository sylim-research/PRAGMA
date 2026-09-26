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
const toSecondJudgment = () => {
  render(<MemoryRouter><CanonicalMissionRun /></MemoryRouter>);
  click("다소 적절"); click("답안 확인하기"); click("다음: 판단하고 이유 고르기");
};
describe("representative v6 reason / contrast rhythm", () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/learner/practice?preview=v5&pilot=free-correction&variant=reason-contrast");
  });
  afterEach(cleanup);

  it("locks the judgment without revealing it, then reveals judgment and reason together after the reason is committed", () => {
    toSecondJudgment();
    const reason = mission.mpj_items[1].reason_choice.options[1];
    expect(mission.mpj_items[1].reason_choice.accepted_id).toBe(reason.id);
    expect(screen.queryByText(reason.text)).not.toBeInTheDocument();
    expect(screen.queryByText(feedbackSentence)).not.toBeInTheDocument();
    click("매우 적절"); click("판단 확정하기");
    // 판단 확정 직후: 네 선지와 내 선택은 남고 잠기지만, 결과는 배지·색상·스크린리더 어디에도 없다.
    for (const label of ["매우 적절", "다소 적절", "다소 부적절", "매우 부적절"]) expect(screen.getByRole("button", { name: new RegExp(`^${label}`) })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^매우 적절/ }).className).toContain("ring-[#15202B]");
    for (const leak of ["내 선택", "기준 판단", "인정 범위"]) expect(screen.queryByText(leak)).not.toBeInTheDocument();
    for (const label of ["다소 적절", "다소 부적절", "매우 부적절"]) {
      const cls = screen.getByRole("button", { name: new RegExp(`^${label}`) }).className;
      expect(cls).toContain("border-[#E3DDCF]");
      expect(cls).not.toMatch(/4D8568|C86E68|E0DDD5/);
    }
    expect(screen.queryByText(/맞았습니다|기준 판단과 다릅니다/)).not.toBeInTheDocument();
    expect(screen.getByText(/^판단을 확정했습니다\. 내 선택 매우 적절\./)).toBeInTheDocument();
    expect(screen.queryByText(feedbackSentence)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "가능한 수정 예시" })).not.toBeInTheDocument();
    const reasons = screen.getByRole("radiogroup", { name: "판단 이유" });
    expect(within(reasons).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "이유 확정하기" })).toBeDisabled();
    fireEvent.click(within(reasons).getByRole("radio", { name: reason.text }));
    expect(screen.queryByText("기준 판단")).not.toBeInTheDocument();
    click("이유 확정하기");
    // 이유 확정 후: 판단과 이유의 결과·해설을 함께 공개한다.
    expect(screen.getByText(/^기준 판단과 다릅니다\. 내 선택 매우 적절\./)).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /^매우 적절/ })).getByText("내 선택")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /^다소 부적절/ })).getByText("기준 판단")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /^매우 부적절/ })).getByText("인정 범위")).toBeInTheDocument();
    expect(screen.getByText(/^핵심 이유를 골랐습니다\./)).toBeInTheDocument();
    expect(within(screen.getByRole("radio", { name: new RegExp(reason.text) })).getByText("핵심 이유")).toBeInTheDocument();
    expect(screen.getByText(feedbackSentence)).toBeInTheDocument();
    click("다음: 여러 표현 비교하기");
    expect(snapshot().responses.A2).toEqual({ pick: "very_appropriate", reasonId: reason.id });
    ["상황에 맞음", "상대의 선택권이 부족함", "우회해 요청이 흐려짐", "상황에 맞음"].forEach((band, i) => {
      fireEvent.click(within(screen.getByRole("radiogroup", { name: `표현 ${i + 1}의 위치` })).getByRole("radio", { name: band }));
    });
    click("네 표현 확인하기");
    expect(screen.getByText(/^내 판단 4개 중 \d개가 기준 판정과 같아요$/)).toBeInTheDocument();
    click("다음: 고친 표현 고르기");
    click(mission.mpj_items[2].corrections[0].text); click("교정안 확인하기");
    const acceptedCorrection = mission.mpj_items[2].corrections.find(candidate => candidate.is_valid)!;
    expect(within(screen.getByRole("button", { name: new RegExp(acceptedCorrection.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).getByText("기준 선택")).toBeInTheDocument();
    click("다음: 직접 고치고 비교하기");
    expect(screen.queryByRole("region", { name: "다른 맥락에서는?" })).not.toBeInTheDocument();
    const revisedText = "明天我下课晚，大家方便把彩排改到七点半吗？";
    fireEvent.change(screen.getByRole("textbox", { name: "내가 고친 표현" }), { target: { value: revisedText } });
    click("수정안 제출하기");
    const contrast = screen.getByRole("region", { name: "다른 맥락에서는?" });
    expect(within(contrast).getByText(mission.mpj_items[3].contrast.target)).toBeInTheDocument();
    expect(within(contrast).queryByRole("button")).not.toBeInTheDocument();
    click("다음: 핵심 정리");
    expect(snapshot().responses.A4).toEqual({ revisedText });
    const traces = buildMissionV6Responses(mission, snapshot().responses, "2026-09-14T12:00:00.000Z");
    expect(traces[1]).toMatchObject({ scale_code: "very_appropriate", reason_id: reason.id });
    expect(traces[1]).not.toHaveProperty("revised_scale_code");
    expect(traces[3].revised_text).toBe(revisedText);
    expect(traces[4].candidate_band_codes).toEqual(["appropriate", "too_direct", "too_indirect", "appropriate"]);
    expect(sessionStorage.getItem(LEARNER_UX_PILOT_STORAGE_KEY)).toBeNull();
    click("번역하기");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "您好，下周三下午三点到四点能借用研讨室吗？我们社团想和新成员开第一次见面会。" } });
    click("번역 제출하기");
    expect(screen.getByText("AI 미실행")).toBeInTheDocument();
    click("이 번역으로 확정하기");
    expect(snapshot().completed).toBe(true);
    for (const external of [fetchMissionByScenario, requestFeedback, saveMissionAttempt, appendMissionEvent]) expect(external).not.toHaveBeenCalled();
  });

  it("marks a reason that differs from the reference and names the reference reason", () => {
    toSecondJudgment();
    const [picked, accepted] = mission.mpj_items[1].reason_choice.options;
    click("다소 적절"); click("판단 확정하기");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "판단 이유" })).getByRole("radio", { name: picked.text }));
    click("이유 확정하기");
    expect(screen.getByText(`핵심 이유와 다릅니다. 핵심 이유 ${accepted.text.replace(/[.。]$/, "")}.`)).toBeInTheDocument();
    expect(screen.queryByText(/참고 이유/)).not.toBeInTheDocument();
    click("다음: 여러 표현 비교하기");
    expect(snapshot().responses.A2).toEqual({ pick: "somewhat_appropriate", reasonId: picked.id });
  });
});
