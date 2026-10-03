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
  fetchMission: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("@/lib/learningSessions", () => ({ getSessions: mocks.getSessions }));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionByScenario: mocks.fetchMission }));
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

const summaryText = () => screen.getByText(/학습 미션 \d+개 · 수행 \d+회/).textContent;
const missionCards = async () => within(await screen.findByRole("list", { name: "완료 기록" })).getAllByRole("article");
// 수행 한 번 = 「수행 기록」 목록의 바로 아래 항목(안쪽 흐름 띠의 항목은 세지 않는다).
const attempts = async () => (await screen.findAllByRole("list", { name: "수행 기록" }))
  .flatMap((list) => within(list).getAllByRole("listitem").filter((item) => item.parentElement === list));
const recordItems = attempts;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.fetchMission.mockRejectedValue(new Error("no mission"));
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
    expect(await screen.findByText("아직 완료한 학습 미션이 없습니다.")).toBeInTheDocument();
    expect(mocks.getSessions).not.toHaveBeenCalled();
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /이번 주 학습 미션으로/ })).toHaveAttribute("href", "/learner/course");
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
    expect(summaryText()).toBe("학습 미션 1개 · 수행 1회");
  });

  it("reads only the signed-in user's completed rows, even on localhost", async () => {
    vi.stubGlobal("location", new URL("http://127.0.0.1/learner/records"));
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(mocks.from).toHaveBeenCalledWith("learner_mission_logs");
    expect(mocks.eq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.eq).toHaveBeenCalledWith("mission_completed", true);
    expect(summaryText()).toBe("학습 미션 1개 · 수행 1회 · 교과목 1개");
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
    expect(within(rows[0]).getByRole("region", { name: "최초 번역" })).toHaveTextContent(`최초 번역${ownLog.first_response}`);
    expect(within(rows[0]).getByRole("region", { name: "최종 번역" })).toHaveTextContent(`최종 번역${ownLog.revised_response}`);
    expect(within(rows[1]).getByRole("region", { name: "최종 번역" })).toHaveTextContent(`최종 번역${ownLog.first_response}최초 번역을 그대로 유지했습니다.`);
    expect(cards[1]).toHaveTextContent("거절");
  });

  it("underlines only the changed part of the final expression", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    const [row] = await attempts();
    expect(within(row).getByText("如果方便，").className).toContain("underline");
  });

  it("shows no score, type or revision count — one low-key question per mission", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await recordItems();
    expect(screen.getByRole("heading", { name: "내 기록" })).toBeInTheDocument();
    expect(screen.queryByText(/고쳐 쓴 기록|시그니처|수정 노트|완료 학습 기록/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("생각해 보기")).toHaveLength(1);
    expect(screen.getByLabelText("생각해 보기")).toHaveTextContent("최종 번역에서도 원문의 의미와 화행목적이 유지되었나요?");
    expect(screen.queryByText("표현을 유지하거나 바꾼 이유는 무엇인가요?")).not.toBeInTheDocument();
    expect(screen.queryByText("다시 생각해 볼 질문")).not.toBeInTheDocument();
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
    expect(feedback).toHaveTextContent("다시 살펴볼 점 상대에게 주는 인상");
    expect(feedback).toHaveTextContent("내 의견관계·친밀도에 대한 다른 판단“같은 과 선배라서”");
    expect(within(item).getByRole("region", { name: "최종 번역" })).toHaveTextContent("최초 번역을 그대로 유지했습니다.");
    expect(within(item).queryByRole("button", { name: "자세히 보기" })).not.toBeInTheDocument();
    expect(within(item).queryByText("유지")).not.toBeInTheDocument();
    expect(item).toHaveTextContent("2026년 9월 5일");
  });

  it("maps the nine acts with counts and filters records when one is pressed", async () => {
    const refusal = { ...ownLog, id: "refusal", mission_id: "f62f9ce7-04bd-40e6-8f06-2fd2947d79a0", speech_act: "refusal" };
    mocks.order.mockResolvedValue({ data: [ownLog, refusal], error: null });
    renderReport();
    await missionCards();
    const map = within(screen.getByRole("region", { name: "화행별 학습 기록" }));
    expect(map.getByText("수행한 화행 2/9 · 화행을 선택하면 해당 기록만 볼 수 있습니다")).toBeInTheDocument();
    expect(map.getAllByRole("button")).toHaveLength(9);
    expect(map.getByRole("button", { name: /사과\s*아직/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox", { name: "교과목" })).not.toBeInTheDocument();
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
    expect(screen.queryByText("아직 완료한 학습 미션이 없습니다.")).not.toBeInTheDocument();
  });

  it("marks my place on a class distribution only after release, without a per-step strip", async () => {
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
    expect(within(item).queryByRole("list", { name: "이번 수행의 흐름" })).not.toBeInTheDocument();
    const position = await screen.findByRole("region", { name: "우리 반의 판단" });
    expect(within(position).getByRole("img", { name: "단일 표현 판단 학급 분포와 내 판단" })).toHaveTextContent("나");
    expect(mocks.rpc).toHaveBeenCalledWith("learner_get_peer_responses", { p_course_id: ownLog.course_id, p_mission_id: withMjt.mission_id });
    // 판단 비교 표는 없다. 판본을 확인할 수 없으면 기준 판단 라벨도 없다.
    expect(screen.queryByRole("region", { name: "판단 비교" })).not.toBeInTheDocument();
    expect(within(position).queryByText(/기준 판단:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "핵심 정리" })).not.toBeInTheDocument();
    // 콘텐츠 지문이 없는 기록은 미션 본문을 읽지 않는다.
    expect(mocks.fetchMission).not.toHaveBeenCalled();
  });

  it("hides the class position while the distribution is not released", async () => {
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    mocks.rpc.mockResolvedValue({ data: { state: "awaiting_release" }, error: null });
    renderReport();
    await recordItems();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("region", { name: "우리 반의 판단" })).not.toBeInTheDocument();
  });

  it("opens a labelled demo record without reading stored logs", async () => {
    renderReport("/learner/records?demo=1");
    expect(await screen.findByText("데모 · 가상 학급 20명 · 실제 학습자 자료가 아닙니다")).toBeInTheDocument();
    const classView = await screen.findByRole("region", { name: "우리 반의 판단" });
    expect(within(classView).getByRole("list", { name: "수정안 선택 학급 분포와 내 판단" })).toHaveTextContent("수정안 2나60% · 12명");
    // 판단 비교 표 대신, 각 활동 그래프 옆에 기준 판단 라벨 하나.
    expect(screen.queryByRole("region", { name: "판단 비교" })).not.toBeInTheDocument();
    expect(within(classView).getAllByText(/^기준 판단:/).map((label) => label.textContent)).toEqual([
      "기준 판단: 매우 적절",
      "기준 판단: 다소 부적절",
      "기준 판단: 수정안 2",
    ]);
    const lessons = screen.getByRole("region", { name: "핵심 정리" });
    expect(lessons).toHaveTextContent("짧아도 자연스러운 부탁");
    expect(lessons).toHaveTextContent("공손 표지와 수락은 별개");
    expect(lessons).toHaveTextContent("확인 부탁의 강도와 확정성");
    expect(lessons).not.toHaveTextContent("적절한 표현은 여러 가지");
    expect(screen.queryByText(/경향|편이다|강점|약점|민감/)).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetchMission).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
