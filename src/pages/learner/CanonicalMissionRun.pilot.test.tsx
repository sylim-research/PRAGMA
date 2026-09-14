// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEARNER_UX_PILOT, LEARNER_UX_PILOT_STORAGE_KEY } from "@/lib/mission/learnerUxPilot";

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

const mount = () => render(<MemoryRouter><CanonicalMissionRun /></MemoryRouter>);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const expectCompactContext = (questId: string, brief?: string) => {
  const quest = LEARNER_UX_PILOT.quests.find(q => q.id === questId)!;
  expect(screen.getByText(quest.source)).toBeInTheDocument();
  expect(screen.queryByText(quest.context.situation)).not.toBeInTheDocument();
  expect(screen.queryByText("상황", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/^(상대적 지위|친숙도|부담) · /)).not.toBeInTheDocument();
  if (brief) expect(screen.getByText(brief)).toBeInTheDocument();
};

describe("local learner UX pilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/learner/practice?preview=v5&pilot=free-correction");
  });
  afterEach(cleanup);

  it("runs five independent scenes, ungraded free correction and one new DCT without external writes or AI", () => {
    const scenes = LEARNER_UX_PILOT.quests.filter(q => q.kind !== "dct_feedback");
    expect(new Set(scenes.map(q => q.source)).size).toBe(6);
    expect(new Set(scenes.map(q => q.context.situation)).size).toBe(6);
    const view = mount();
    expect(screen.queryByRole("button", { name: /표현 판단 시작하기/ })).not.toBeInTheDocument();
    expect(screen.queryByText("미션 안내")).not.toBeInTheDocument();
    expect(screen.queryByText(/세미나실 예약 가능 여부/)).not.toBeInTheDocument();
    expectCompactContext("A1", "친한 팀플 조원이 하기로 한 일을 메신저로 다시 부탁합니다.");
    click("다소 적절"); click("답안 확인하기"); click("다음: 상황에 맞는지 판단하기");
    expectCompactContext("A2", "수업에서만 뵌 교수님께 이메일로 처음 부탁하며, 아직 수락을 받지 않았습니다.");
    expect(screen.queryByRole("region", { name: "가능한 수정 예시" })).not.toBeInTheDocument();
    for (const label of ["매우 적절", "다소 적절", "다소 부적절", "매우 부적절"]) expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    // Examples also appear when the learner judged the problematic draft appropriate.
    click("매우 적절"); click("답안 확인하기");
    const examples = screen.getByRole("region", { name: "가능한 수정 예시" });
    expect(within(examples).getByText("老师，您能帮我写一封交换生申请的推荐信吗？下周五就需要用到。")).toBeInTheDocument();
    expect(within(examples).getByText("老师，我申请交换生需要一封推荐信，下周五要用。请问您方便帮我写吗？")).toBeInTheDocument();
    click("다음: 판단하고 고쳐 보기");
    expectCompactContext("A3");
    expect(screen.queryByRole("button", { name: "판단 확인하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "원문의 뜻을 유지하면서 이 상황에 맞게 고친 표현을 골라보세요." })).toBeInTheDocument();
    expect(screen.queryByText(/가장 알맞게 고친 표현/)).not.toBeInTheDocument();
    click("助教您好，不好意思，我上周忘了签到，能帮我查一下记录吗？");
    click("교정안 확인하기");
    const inventedCause = screen.getByRole("button", { name: /助教您好，不好意思，我上周忘了签到/ });
    expect(inventedCause).toHaveTextContent("원문에 없는 ‘출석 체크를 잊었다’는 원인을 사실로 덧붙였습니다.");
    expect(inventedCause).toHaveTextContent("사과 표현이 아니라 확인되지 않은 사실의 추가가 문제입니다.");
    expect(within(inventedCause).queryByText("가능한 수정안")).not.toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /助教您好，系统显示我上周缺勤，能帮我核实一下吗/ })).getByText("가능한 수정안")).toBeInTheDocument();
    click("다음: 직접 고쳐 보기");
    expectCompactContext("A4", "같은 수업의 팀플 조원들과 나누는 메신저 대화입니다.");
    expect(screen.queryByText("이렇게도 고칠 수 있어요")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "판단 남기고 직접 고치기" })).not.toBeInTheDocument();
    // The correction field opens immediately; a non-reference answer remains the learner's answer.
    const input = screen.getByRole("textbox", { name: "내가 고친 번역" });
    expect(input).toHaveValue("我下课晚，明天的汇报彩排就从七点改到七点半吧。");
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "수정안 제출하기" })).toBeDisabled();
    const freeAnswer = "明天我下课比较晚，大家方便把彩排从七点推迟到七点半吗？";
    fireEvent.change(input, { target: { value: freeAnswer } });
    click("수정안 제출하기");
    expect(screen.getByRole("textbox", { name: "내가 고친 번역" })).toHaveValue(freeAnswer);
    expect(screen.getByText("이렇게도 고칠 수 있어요")).toBeInTheDocument();
    expect(screen.getByText(/맞음·틀림을 자동 판정한 결과가 아닙니다/)).toBeInTheDocument();
    expect(screen.queryByText(/권장 답안과 같아요|권장 답안과 달라요/)).not.toBeInTheDocument();
    click("다음: 표현 비교하기");
    const snapshot = JSON.parse(sessionStorage.getItem(LEARNER_UX_PILOT_STORAGE_KEY)!);
    expect(snapshot.responses.A3).toEqual({ correctionIds: ["apology"] });
    expect(snapshot.responses.A4).toEqual({ revisedText: freeAnswer });
    expect(snapshot.questIndex).toBe(4);
    // Only completed-step progress is restored; no full draft recovery machinery.
    view.unmount(); mount();
    expectCompactContext("A5", "활동 중 몇 번 이야기한 한 학년 위 여자 선배와의 메신저 대화입니다.");
    const bands = ["상황에 맞음", "상황에 맞음", "상황에 맞음", "너무 직접적"];
    bands.forEach((band, index) => {
      expect(screen.getByRole("button", { name: "네 표현 확인하기" })).toBeDisabled();
      fireEvent.click(within(screen.getByRole("radiogroup", { name: `표현 ${index + 1}의 위치` })).getByRole("radio", { name: band }));
    });
    click("네 표현 확인하기");
    expect(within(screen.getByRole("group", { name: "표현 2" })).getByText("참고 위치 · 상황에 맞음")).toBeInTheDocument();
    click("다음: 직접 옮겨 보기"); click("직접 옮겨 보기");
    expectCompactContext("A-DCT", "처음 연락하는 학생회관 담당 직원에게 보내는 이메일입니다.");
    const dct = screen.getByRole("textbox");
    expect(dct).toHaveValue("");
    const first = "您好，下周三下午三点到四点能借用研讨室吗？我们社团想和新成员开第一次见面会。";
    fireEvent.change(dct, { target: { value: first } }); click("번역 제출하기");
    expect(screen.getByRole("heading", { name: "번역 피드백" })).toBeInTheDocument();
    expect(screen.getByText(first)).toBeInTheDocument();
    expect(screen.getByText("AI 미실행")).toBeInTheDocument();
    expect(screen.getByText(/미리 작성한 확인 기준이며, 내 답안을 평가한 결과가 아닙니다/)).toBeInTheDocument();
    expect(screen.queryByText("보완 권장", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/AI가 생성한 참고 피드백/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 번역으로 확정하기" })).toBeEnabled();
    click("한 번 다듬어보기");
    expect(screen.getByRole("textbox")).toHaveValue(first);
    expectCompactContext("A-DCT", "처음 연락하는 학생회관 담당 직원에게 보내는 이메일입니다.");
    const final = `${first}谢谢！`;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: final } });
    click("수정안 확정하기");
    expect(screen.getByRole("heading", { name: "이번 미션에서 확정한 내 번역" })).toBeInTheDocument();
    expect(screen.getByText(first)).toBeInTheDocument();
    expect(screen.getByText(final)).toBeInTheDocument();
    const completed = JSON.parse(sessionStorage.getItem(LEARNER_UX_PILOT_STORAGE_KEY)!);
    expect(completed.responses["A-DCT"]).toEqual({ first, revised: final, reflected: true });
    expect(completed.responses["A-FEEDBACK"]).not.toHaveProperty("evaluation");
    expect(screen.queryByText("최초안에 대한 AI 피드백 보기")).not.toBeInTheDocument();
    expect(completed.responses.A4.revisedText).toBe(freeAnswer);
    expect(completed.responses.A5.candidateJudgments).toEqual({ a: "appropriate", b: "appropriate", c: "appropriate", d: "too_direct" });
    for (const external of [fetchMissionByScenario, requestFeedback, saveMissionAttempt, appendMissionEvent]) expect(external).not.toHaveBeenCalled();
    click("처음부터 다시 보기");
    expect(screen.queryByRole("button", { name: /표현 판단 시작하기/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "매우 적절" })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(LEARNER_UX_PILOT_STORAGE_KEY)!).responses).toEqual({});
  });
});
