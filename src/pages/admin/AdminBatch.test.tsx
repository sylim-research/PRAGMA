import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { buildBatchPlan } from "@/lib/pragma/batchPlan";
import type { CoreCellResult, CoreRunOptions } from "@/lib/pragma/coreBatchRun";
import AdminBatch from "./AdminBatch";

const mocks = vi.hoisted(() => ({
  preflight: vi.fn(), existing: vi.fn(), run: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/pragma/adminBatchPreflight", () => ({ preflightAdminBatch: mocks.preflight }));
vi.mock("@/lib/pragma/coreBatchRun", () => ({ loadExistingCoreRunItems: mocks.existing, runCoreBatch: mocks.run }));
vi.mock("@/lib/pragma/coreQualityAudit", () => ({
  runCoreQualityPilot: mocks.audit, CORE_AXIS_LABEL: {}, CORE_QUALITY_AXES: [],
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const setNumber = (name: string, value: number) => fireEvent.change(screen.getByLabelText(name), { target: { value: String(value) } });
const enterExample = () => {
  for (const [level, total, percent] of [["입문", 18, 50], ["중급", 36, 25], ["고급", 18, 50]] as const) {
    setNumber(level + " · 총 생성 건수", total);
    setNumber(level + " · 통역 비율", percent);
  }
};
const mount = (withExample = true) => {
  const result = render(<MemoryRouter><AdminBatch /></MemoryRouter>);
  if (withExample) enterExample();
  return result;
};
const start = () => screen.getByRole("button", { name: "전체 72건 생성 시작" });
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.preflight.mockResolvedValue({ ok: true });
  mocks.existing.mockResolvedValue(new Map());
  mocks.run.mockResolvedValue([]);
});
afterEach(cleanup);

describe("배치 생성 작업 화면", () => {
  it("전체 계획이 실패 없이 끝나면 다음 실행 번호로 넘기고, 실패가 남으면 번호를 유지한다", async () => {
    mocks.run.mockImplementation(async (cells: unknown[]) => cells.map((cell, index) => ({ ok: true, cell, index })));
    mount();
    const first = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    fireEvent.click(start());
    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    await waitFor(() => expect(localStorage.getItem("pragma:admin-core-batch-run:ko_zh")).not.toBe(first));
    const second = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    mocks.run.mockImplementation(async (cells: unknown[]) => cells.map((cell, index) => ({ ok: index !== 0, cell, index, error: index === 0 ? "실패" : undefined })));
    await waitFor(() => expect(start()).toBeEnabled());
    fireEvent.click(start());
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(start()).toBeEnabled());
    expect(localStorage.getItem("pragma:admin-core-batch-run:ko_zh")).toBe(second);
  });

  it("과거 프리셋 없이 양방향 모두 입력한 수량으로 계획하고 방향 변경 시 선택을 초기화한다", async () => {
    mount(false);
    expect(screen.queryByRole("button", { name: /기본 72건|495건 본배치|30건 검증/ })).not.toBeInTheDocument();
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("45건");
    enterExample();
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("72건");
    fireEvent.click(screen.getByLabelText("생성 항목 1 선택"));
    fireEvent.click(screen.getByRole("button", { name: "중→한" }));
    expect(screen.getByRole("button", { name: /^전체 \d+건 생성 시작$/ })).toBeInTheDocument();
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("72건");
    setNumber("중급 · 총 생성 건수", 45);
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("81건");
    fireEvent.click(screen.getByRole("button", { name: "전체 81건 생성 시작" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    expect(mocks.run.mock.calls[0][0]).toHaveLength(81);
    expect(mocks.run.mock.calls[0][0].every((cell: { direction: string }) => cell.direction === "zh_ko")).toBe(true);
    expect(mocks.run.mock.calls[0][1].runId).toMatch(/^core_zh_ko_/);
    await waitFor(() => expect(screen.getByRole("button", { name: "한→중" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "한→중" }));
    expect(screen.getByLabelText("중급 · 총 생성 건수")).toHaveValue(45);
  });

  it("일반 제작 수량을 과거의 정확히 495건 조건에 묶지 않는다", () => {
    mount();
    setNumber("입문 · 총 생성 건수", 168);
    setNumber("중급 · 총 생성 건수", 168);
    setNumber("고급 · 총 생성 건수", 168);
    expect(screen.getByRole("button", { name: "전체 504건 생성 시작" })).toBeEnabled();
    expect(screen.queryByText(/495/)).not.toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("수준별 0·25·100%로 지정한 절대 수량을 실제 실행기에 전달한다", async () => {
    mount();
    setNumber("입문 · 통역 비율", 0);
    setNumber("고급 · 통역 비율", 100);
    fireEvent.click(start());
    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    const cells = mocks.run.mock.calls[0][0] as Array<{ level: string; mode: string; theme_code: string }>;
    expect(cells).toHaveLength(72);
    expect(cells.filter(cell => cell.level === "beginner_intermediate").every(cell => cell.mode === "translation")).toBe(true);
    expect(cells.filter(cell => cell.level === "advanced").every(cell => cell.mode === "stt_interpreting")).toBe(true);
    expect(cells.filter(cell => cell.level === "intermediate" && cell.mode === "stt_interpreting")).toHaveLength(9);
    expect(cells.some(cell => cell.theme_code === "travel_mobility")).toBe(false);
    await waitFor(() => expect(start()).toBeEnabled());
  });

  it("여러 페이지의 선택을 원래 계획 번호와 같은 재개 ID·저장 목록으로 전달한다", async () => {
    const existing = new Map([["saved-item", { scenarioId: "saved-scenario" }]]);
    mocks.existing.mockResolvedValue(existing);
    mount();
    const runId = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    fireEvent.click(screen.getByLabelText("생성 항목 1 선택"));
    fireEvent.click(screen.getByRole("button", { name: "다음 항목" }));
    fireEvent.click(screen.getByLabelText("생성 항목 21 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 2건 생성 시작" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    const plan = buildBatchPlan();
    expect(mocks.run).toHaveBeenCalledWith([plan[0], plan[20]], expect.objectContaining({
      runId, itemIndexes: [0, 20], existingItems: existing, concurrency: 3,
    }));
    await waitFor(() => expect(start()).toBeEnabled());
  });

  it("실행 준비 중 중복 요청·조건 변경을 막고 권한 확인 실패 후 다시 사용할 수 있다", async () => {
    let finish!: (value: { ok: false; message: string }) => void;
    mocks.preflight.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount();
    const button = start();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.preflight).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("중급 · 총 생성 건수")).toBeDisabled();
    expect(screen.getByLabelText("입문 · 통역 비율")).toBeDisabled();
    expect(screen.getByRole("button", { name: "중→한" })).toBeDisabled();
    await act(async () => finish({ ok: false, message: "관리자 세션 확인 필요" }));
    expect(screen.getByRole("alert")).toHaveTextContent("관리자 세션 확인 필요");
    expect(start()).toBeEnabled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("배치 조회 및 실행 오류 뒤 같은 ID로 재시도할 수 있다", async () => {
    mocks.existing.mockRejectedValueOnce(new Error("저장 목록 조회 실패"));
    mount();
    const runId = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    fireEvent.click(start());
    await screen.findByText("저장 목록 조회 실패");
    expect(start()).toBeEnabled();
    mocks.run.mockRejectedValueOnce(new Error("실행 연결 실패"));
    fireEvent.click(start());
    await screen.findByText("실행 연결 실패");
    expect(start()).toBeEnabled();
    expect(localStorage.getItem("pragma:admin-core-batch-run:ko_zh")).toBe(runId);
  });

  it("중단은 실행기의 AbortSignal에 전달되고 재개 ID를 유지한다", async () => {
    mocks.run.mockImplementation((_cells, options: CoreRunOptions) => new Promise(resolve => {
      options.signal?.addEventListener("abort", () => resolve([]), { once: true });
    }));
    mount();
    const runId = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    fireEvent.click(start());
    fireEvent.click(await screen.findByRole("button", { name: "생성 중단" }));
    await waitFor(() => expect(start()).toBeEnabled());
    expect(mocks.run.mock.calls[0][1].signal.aborted).toBe(true);
    expect(screen.getByText("중단된 실행")).toBeVisible();
    expect(localStorage.getItem("pragma:admin-core-batch-run:ko_zh")).toBe(runId);
  });

  it("AI 비평 기능을 유지하고 오류 뒤 생성·비평 제어를 복구한다", async () => {
    const result: CoreCellResult = { index: 0, cell: buildBatchPlan()[0], ok: true, scenarioId: "saved-1", coreContent: { situation_ko: "확인용 상황" } };
    mocks.run.mockResolvedValue([result]);
    mocks.audit.mockRejectedValue(new Error("비평 연결 실패"));
    mount();
    fireEvent.click(start());
    fireEvent.click(await screen.findByRole("button", { name: "1건 비평 실행" }));
    await screen.findByText("비평 연결 실패");
    expect(start()).toBeEnabled();
    expect(screen.getByRole("button", { name: "1건 비평 실행" })).toBeEnabled();
  });
});
