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

const mount = () => render(<MemoryRouter><AdminBatch /></MemoryRouter>);
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
  it("기본·본배치·중한 계획을 실제 계획 수량으로 표시하고 조건 변경 시 선택을 초기화한다", () => {
    mount();
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("72건");
    fireEvent.click(screen.getByLabelText("생성 항목 1 선택"));
    fireEvent.click(screen.getByRole("button", { name: "495건 본배치" }));
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("495건");
    expect(screen.getByLabelText("선택 항목 번호")).toHaveValue("");
    expect(screen.getByRole("button", { name: "전체 495건 생성 시작" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "중→한 · 30건 검증" }));
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("30건");
    fireEvent.click(screen.getByRole("button", { name: "기본 72건" }));
    fireEvent.change(screen.getByLabelText("중급 · 화행당 번역"), { target: { value: "4" } });
    expect(screen.getByText("총 생성 예정").parentElement).toHaveTextContent("81건");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("여러 페이지의 선택을 원래 계획 번호와 같은 재개 ID·저장 목록으로 전달한다", async () => {
    const existing = new Map([["saved-item", { scenarioId: "saved-scenario" }]]);
    mocks.existing.mockResolvedValue(existing);
    mount();
    const runId = localStorage.getItem("pragma:admin-core-batch-run:ko_zh");
    fireEvent.click(screen.getByLabelText("생성 항목 1 선택"));
    fireEvent.click(screen.getByRole("button", { name: "다음 항목" }));
    fireEvent.click(screen.getByLabelText("생성 항목 11 선택"));
    expect(screen.getByLabelText("선택 항목 번호")).toHaveValue("1, 11");
    fireEvent.click(screen.getByRole("button", { name: "선택 2건 · 현재 ID 재개" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    const plan = buildBatchPlan();
    expect(mocks.run).toHaveBeenCalledWith([plan[0], plan[10]], expect.objectContaining({
      runId, itemIndexes: [0, 10], existingItems: existing, concurrency: 3,
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
    expect(screen.getByLabelText("중급 · 화행당 번역")).toBeDisabled();
    expect(screen.getByRole("button", { name: "495건 본배치" })).toBeDisabled();
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
