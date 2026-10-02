import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearnerRecords from "./LearnerRecords";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  getSessions: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc },
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

function renderReport(entry = "/learner/records") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><LearnerRecords /></MemoryRouter></QueryClientProvider>);
}

const summaryText = () => screen.getByText(/미션 \d+개 · 수행 \d+회/).textContent;
const missionCards = async () => within(await screen.findByRole("list", { name: "완료 기록" })).getAllByRole("article");
// 수행 한 번 = 「수행 기록」 목록의 바로 아래 항목(안쪽 흐름 띠의 항목은 세지 않는다).
const attempts = async () => (await screen.findAllByRole("list", { name: "수행 기록" }))
  .flatMap((list) => within(list).getAllByRole("listitem").filter((item) => item.parentElement === list));
const recordItems = attempts;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
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
    expect(summaryText()).toBe("미션 1개 · 수행 1회");
  });

  it("reads only the signed-in user's completed rows, even on localhost", async () => {
    vi.stubGlobal("location", new URL("http://127.0.0.1/learner/records"));
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(mocks.from).toHaveBeenCalledWith("learner_mission_logs");
    expect(mocks.eq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.eq).toHaveBeenCalledWith("mission_completed", true);
    expect(summaryText()).toBe("미션 1개 · 수행 1회 · 수업 1개");
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

  it("groups attempts by mission with the source shown once and marks kept or revised", async () => {
    const withSource = { ...ownLog, source_text: "시간 확인 부탁드립니다." };
    const unchanged = { ...withSource, id: "same", revised_response: ownLog.first_response, completed_at: "2026-09-04T10:00:00Z" };
    const other = { ...ownLog, id: "other", mission_id: "f62f9ce7-04bd-40e6-8f06-2fd2947d79a0", speech_act: "refusal", source_text: "자료 보내 주세요." };
    mocks.order.mockResolvedValue({ data: [withSource, unchanged, other], error: null });
    renderReport();
    const cards = await missionCards();
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("AI 한중 화용 통번역 · 2주차 · 요청 · 번역");
    expect(within(cards[0]).getAllByText("시간 확인 부탁드립니다.")).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("수행 2회");
    const list = within(cards[0]).getByRole("list", { name: "수행 기록" });
    const rows = within(list).getAllByRole("listitem").filter((row) => row.parentElement === list);
    expect(within(rows[0]).getAllByText("수정").length).toBeGreaterThan(0);
    expect(within(rows[0]).getByRole("region", { name: "최초 번역" })).toHaveTextContent(`최초 번역${ownLog.first_response}`);
    expect(within(rows[0]).getByRole("region", { name: "최종 번역" })).toHaveTextContent(`최종 번역${ownLog.revised_response}`);
    expect(within(rows[1]).getByText("유지")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("region", { name: "최종 번역" })).toHaveTextContent(`최종 번역${ownLog.first_response}최초 번역을 그대로 결정`);
    expect(cards[1]).toHaveTextContent("거절");
  });

  it("underlines only the changed part of the final expression", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    const [row] = await attempts();
    expect(within(row).getByText("如果方便，").className).toContain("underline");
  });

  it("shows no score, type, revision count or act map — only a shared reflection question", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(screen.getByRole("heading", { name: "내 기록" })).toBeInTheDocument();
    expect(screen.queryByText(/고쳐 쓴 기록|시그니처|수정 노트|완료 학습 기록/)).not.toBeInTheDocument();
    expect(screen.getByText(/다시 볼 때 · 모든 학습자에게 같은 질문입니다/)).toBeInTheDocument();
  });

  it("shows the change map — first, stored AI feedback with my opinion, final — without a toggle", async () => {
    const detailed = {
      ...ownLog,
      target_feature_observed: { verdicts: { semantic_fidelity: "preserved", grammatical_accuracy: "clean" }, revision_scope: "feature" },
      context_judgment: { kind: "learner_dissent", conditions: ["relationship"], reason_ko: "같은 과 선배라서", final_decision: "retained_first_response" },
    };
    mocks.order.mockResolvedValue({ data: [detailed], error: null });
    renderReport();
    const [item] = await recordItems();
    const feedback = within(item).getByRole("region", { name: "AI 피드백" });
    expect(feedback).toHaveTextContent("다시 볼 곳 상대에게 주는 인상");
    expect(feedback).toHaveTextContent("내 의견관계·친밀도에 대한 다른 판단“같은 과 선배라서”");
    expect(within(item).getByRole("region", { name: "최종 번역" })).toHaveTextContent("최초 번역을 그대로 결정");
    expect(within(item).queryByRole("button", { name: "자세히 보기" })).not.toBeInTheDocument();
    expect(within(item).getByText("유지")).toBeInTheDocument();
  });

  it("maps the nine acts with counts and filters records when one is pressed", async () => {
    const refusal = { ...ownLog, id: "refusal", mission_id: "f62f9ce7-04bd-40e6-8f06-2fd2947d79a0", speech_act: "refusal" };
    mocks.order.mockResolvedValue({ data: [ownLog, refusal], error: null });
    renderReport();
    await missionCards();
    const map = within(screen.getByRole("region", { name: "9개 화행 지도" }));
    expect(map.getByText("2/9 화행 수행 · 누르면 아래 기록을 거릅니다")).toBeInTheDocument();
    expect(map.getAllByRole("button")).toHaveLength(9);
    expect(map.getByRole("button", { name: /사과\s*아직/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox", { name: "수업" })).not.toBeInTheDocument();
    fireEvent.click(map.getByRole("button", { name: /거절\s*1회/ }));
    const cards = await missionCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("거절");
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(await missionCards()).toHaveLength(2);
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

  it("draws this attempt as a flow and marks my place on a class distribution only after release", async () => {
    const withMjt = {
      ...ownLog,
      feature_id: "request_mitigation_optionality",
      context_judgment: {
        schema_version: "mpj_response_v2",
        responses: [
          { item_id: 1, item_type: "scale4", scale_code: "somewhat_inappropriate" },
          { item_id: 2, item_type: "scale4", scale_code: "somewhat_appropriate", reason_id: "r1", revised_scale_code: "very_inappropriate" },
          { item_id: 5, item_type: "multi_judge", candidate_band_codes: ["appropriate", "too_direct", "appropriate", "too_indirect"] },
        ],
        learner_dissent: null,
      },
    };
    mocks.order.mockResolvedValue({ data: [withMjt], error: null });
    mocks.rpc.mockResolvedValue({
      data: {
        state: "released", learnerCount: 6, releasedAt: null,
        pattern: { missionId: withMjt.mission_id, learners: 6, dissents: 0, items: [
          { itemId: 1, title: "판단 1", targetPreview: null, groups: [{ heading: "적절성 판단", total: 6, choices: [
            { key: "somewhat_inappropriate", label: "다소 부적절", count: 4 }, { key: "very_appropriate", label: "매우 적절", count: 2 },
          ] }] },
        ] },
      },
      error: null,
    });
    renderReport();
    const [item] = await recordItems();
    const flow = within(within(item).getByRole("list", { name: "이번 수행의 흐름" }));
    expect(flow.getAllByRole("listitem").map((step) => step.textContent)).toEqual([
      "1단일 표현 판단다소 부적절",
      "2판단과 이유다소 적절매우 부적절",
      expect.stringContaining("3복수 표현 비교"),
      expect.stringContaining("4번역 · 최종 결정"),
    ]);
    const position = await screen.findByRole("region", { name: "학급 속 내 위치" });
    expect(within(position).getByRole("img", { name: "단일 표현 판단 학급 분포와 내 판단" })).toHaveTextContent("나");
    expect(mocks.rpc).toHaveBeenCalledWith("learner_get_peer_responses", { p_course_id: ownLog.course_id, p_mission_id: withMjt.mission_id });
  });

  it("hides the class position while the distribution is not released", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    mocks.rpc.mockResolvedValue({ data: { state: "awaiting_release" }, error: null });
    renderReport();
    await recordItems();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("region", { name: "학급 속 내 위치" })).not.toBeInTheDocument();
  });

  it("opens a labelled demo record without reading stored logs", async () => {
    renderReport("/learner/records?demo=1");
    expect(await screen.findByText("데모 · 가상 학급 20명 중 한 명 · 실제 학습자 자료 아님")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "학급 속 내 위치" })).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
