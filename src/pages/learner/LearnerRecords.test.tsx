import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearnerRecords from "./LearnerRecords";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from },
}));
vi.mock("@/lib/learningSessions", () => ({ getSessions: mocks.getSessions }));
vi.mock("@/components/learner/LearnerJourneyShell", () => ({
  LearnerJourneyShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/learner/LearnerBottomNav", () => ({ LearnerBottomNav: () => <nav /> }));

const ownLog = {
  id: "own-log", mission_id: "3cde65a4-173c-4bc2-b5af-85d806c1bacb", speech_act: "request", task_type: "translation",
  first_response: "请确认时间。", revised_response: "如果方便，请确认时间。",
  course_id: "915fec24-cc38-4b00-a2a0-c3628abcd3f7", week_no: 2,
  completed_at: "2026-09-05T10:00:00Z", created_at: "2026-09-05T10:00:00Z",
};

function renderReport() {
  return render(<MemoryRouter><LearnerRecords /></MemoryRouter>);
}

const summaryText = () => screen.getByText(/완료한 미션 \d+건/).textContent;
const recordItems = async () => within(await screen.findByRole("list", { name: "완료 기록" })).getAllByRole("listitem");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("location", new URL("https://pragma.up.railway.app/learner/records"));
  localStorage.clear();
  localStorage.setItem("dev-learner-id", "local");
  localStorage.setItem("learner-progress:local:v1", JSON.stringify({ practiceCount: 7 }));
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "current-user" } } }, error: null });
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.order.mockResolvedValue({ data: [], error: null });
  mocks.getSessions.mockReturnValue([{
    session_id: "local-preview", speech_act: "request", mode: "translation",
    selected_translation: "A", ai_translations: { A: "请确认。", B: "", C: "" },
    final_translation: "请确认时间。", timestamp: "2026-09-01T00:00:00Z",
  }]);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("learner records", () => {
  it("shows the empty state despite an old browser practice counter", async () => {
    renderReport();
    expect(await screen.findByText("아직 완료한 미션이 없습니다.")).toBeInTheDocument();
    expect(mocks.getSessions).not.toHaveBeenCalled();
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /이번 주 미션 하러 가기/ })).toHaveAttribute("href", "/learner/course");
  });

  it("waits for the remote result before showing any localhost preview", async () => {
    vi.stubGlobal("location", new URL("http://localhost/learner/records"));
    let complete!: (value: { data: never[]; error: null }) => void;
    mocks.order.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderReport();
    expect(screen.getByRole("status")).toHaveTextContent("학습 기록을 불러오는 중");
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { complete({ data: [], error: null }); });
    expect(screen.getByText("localhost 시연 데이터")).toBeInTheDocument();
    expect(summaryText()).toBe("완료한 미션 1건");
  });

  it("reads only the signed-in user's completed rows, even on localhost", async () => {
    vi.stubGlobal("location", new URL("http://127.0.0.1/learner/records"));
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(mocks.from).toHaveBeenCalledWith("learner_mission_logs");
    expect(mocks.eq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.eq).toHaveBeenCalledWith("mission_completed", true);
    expect(summaryText()).toBe("완료한 미션 1건 · 수업 1개");
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
  });

  it("excludes prototype rows without a mission or speech act, keeping v5 rows", async () => {
    const prototype = { ...ownLog, id: "proto", mission_id: "sample:request_mitigation_optionality", speech_act: null };
    const noAct = { ...ownLog, id: "no-act", speech_act: null };
    const v5 = { ...ownLog, id: "v5", mission_id: "f62f9ce7-04bd-40e6-8f06-2fd2947d79a0", revised_response: ownLog.first_response };
    mocks.order.mockResolvedValue({ data: [ownLog, prototype, noAct, v5], error: null });
    renderReport();
    expect(await recordItems()).toHaveLength(2);
  });

  it("lists every record with course, week, source, first and final expressions", async () => {
    const withSource = { ...ownLog, source_text: "시간 확인 부탁드립니다." };
    const unchanged = { ...ownLog, id: "same", speech_act: "refusal", source_text: "자료 보내 주세요.", revised_response: ownLog.first_response };
    mocks.order.mockResolvedValue({ data: [withSource, unchanged], error: null });
    renderReport();
    const items = await recordItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("AI 한중 화용 통번역 · 2주차 · 요청 · 번역");
    expect(items[0]).toHaveTextContent("원문시간 확인 부탁드립니다.");
    expect(items[0]).toHaveTextContent(`최초 번역${ownLog.first_response}`);
    expect(items[0]).toHaveTextContent(`최종 번역${ownLog.revised_response}`);
    expect(within(items[0]).getByText("수정")).toBeInTheDocument();
    expect(within(items[1]).getByText("유지")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent(`최종 번역${ownLog.first_response}`);
  });

  it("shows no score, type, revision count or act map — only a shared reflection question", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(screen.getByRole("heading", { name: "내 기록" })).toBeInTheDocument();
    expect(screen.queryByText(/고쳐 쓴 기록|\/9|시그니처|수정 노트|화행 학습 지도/)).not.toBeInTheDocument();
    expect(screen.getByText(/다시 볼 때 · 모든 학습자에게 같은 질문입니다/)).toBeInTheDocument();
  });

  it("opens stored AI feedback, my decision and my opinion under 자세히 보기", async () => {
    const detailed = {
      ...ownLog,
      target_feature_observed: { verdicts: { semantic_fidelity: "preserved", grammatical_accuracy: "clean" }, revision_scope: "feature" },
      context_judgment: { kind: "learner_dissent", conditions: ["relationship"], reason_ko: "같은 과 선배라서", final_decision: "retained_first_response" },
    };
    mocks.order.mockResolvedValue({ data: [detailed], error: null });
    renderReport();
    const [item] = await recordItems();
    expect(item).not.toHaveTextContent("AI 피드백");
    fireEvent.click(within(item).getByRole("button", { name: "자세히 보기" }));
    expect(item).toHaveTextContent("AI 피드백뜻이 그대로 전달됩니다 · 이해를 막는 오류 없음 · 다시 볼 곳: 상대에게 주는 인상");
    expect(item).toHaveTextContent("내 결정AI 피드백을 본 뒤 최초 번역을 유지함");
    expect(item).toHaveTextContent("내 의견관계·친밀도에 대한 다른 판단“같은 과 선배라서”");
    expect(within(item).getByText("유지")).toBeInTheDocument();
  });

  it("filters by speech act and hides the course filter for a single course", async () => {
    const refusal = { ...ownLog, id: "refusal", speech_act: "refusal" };
    mocks.order.mockResolvedValue({ data: [ownLog, refusal], error: null });
    renderReport();
    await recordItems();
    expect(screen.queryByRole("combobox", { name: "수업" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "화행" }), { target: { value: "refusal" } });
    const items = await recordItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("거절");
  });

  it("keeps a failed query distinct from no records and allows retry", async () => {
    vi.stubGlobal("location", new URL("http://localhost/learner/records"));
    mocks.order.mockResolvedValueOnce({ data: null, error: { message: "network error" } });
    renderReport();
    expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 불러오지 못했습니다");
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await recordItems();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["response", "rejection"])("shows an auth %s failure without inventing an empty report", async (kind) => {
    if (kind === "response") mocks.getSession.mockResolvedValue({ data: { session: null }, error: { message: "auth error" } });
    else mocks.getSession.mockRejectedValue(new Error("auth unavailable"));
    renderReport();
    await screen.findByRole("alert");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.queryByText("아직 완료한 미션이 없습니다.")).not.toBeInTheDocument();
  });
});
