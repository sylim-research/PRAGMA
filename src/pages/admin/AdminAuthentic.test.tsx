import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminAuthentic from "./AdminAuthentic";
import { AUTHENTIC_USAGE_TYPES, canMakeScenarioFromAuthentic } from "@/lib/admin/authenticUsage";
import type { StoredAnalysis, StoredCandidate } from "@/lib/admin/authenticStore";

const store = vi.hoisted(() => ({
  list: vi.fn(),
  setStatus: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/admin/authenticStore", () => ({
  AUTHENTIC_STORE_PENDING: "",
  getAnalysisById: vi.fn(),
  listAuthenticAnalyses: store.list,
  saveAuthenticAnalysis: store.save,
  setCandidateStatus: store.setStatus,
  storedCandidateToApply: () => ({}),
}));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("./AuthenticImportPanel", () => ({
  default: ({ history }: { history?: React.ReactNode }) => <div>{history}</div>,
}));

const candidate = (id: string, usage_type: string, label: string): StoredCandidate => ({
  id, analysis_id: "a1", ordinal: Number(id.slice(1)), usage_type, label_ko: label,
  source_text: "请帮我看看这个文件。", preceding_turn: null, situation_seed_ko: null,
  source_usage_note_ko: null, ai_adaptation_note_ko: null, conditions: {} as StoredCandidate["conditions"],
  expression: null, status: "stored", used_scenario_id: null,
});
const CANDIDATES = [
  candidate("c1", "translation_source", "출발 후보"),
  candidate("c2", "preceding_turn", "선행 후보"),
  candidate("c3", "response_task", "응답 후보"),
];
const ANALYSIS: StoredAnalysis = {
  id: "a1", created_at: "2026-09-27T00:00:00Z", source_type: "text", source_ref: null,
  source_original: "原文", extraction_confidence: null, scene_ko: null, linguistic_features_ko: null,
  recommendation_reason_ko: null, recommended_uses: null, connectable_speech_acts: null,
  candidates: CANDIDATES,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.list.mockResolvedValue({ rows: [ANALYSIS], pending: false, error: null });
  store.setStatus.mockResolvedValue(undefined);
});
afterEach(cleanup);

const cardOf = (label: string) => screen.getByText(label).closest("div.flex.flex-col") as HTMLElement;

describe("실제 자료 활용 분석 · 참고 자료 gate", () => {
  it("출발 텍스트 후보에는 「시나리오 만들기」가 보인다", async () => {
    render(<MemoryRouter><AdminAuthentic /></MemoryRouter>);
    await screen.findByText("출발 후보");
    const card = cardOf("출발 후보");
    expect(within(card).getByText("출발 텍스트")).toBeVisible();
    expect(within(card).getByRole("button", { name: "시나리오 만들기" })).toBeVisible();
  });

  it("상황 맥락 참고·응답 맥락 참고에는 생성 버튼이 없다", async () => {
    render(<MemoryRouter><AdminAuthentic /></MemoryRouter>);
    await screen.findByText("선행 후보");
    for (const [label, tag] of [["선행 후보", "상황 맥락 참고"], ["응답 후보", "응답 맥락 참고"]]) {
      const card = cardOf(label);
      expect(within(card).getByText(tag)).toBeVisible();
      expect(within(card).queryByRole("button", { name: "시나리오 만들기" })).not.toBeInTheDocument();
    }
    expect(canMakeScenarioFromAuthentic("preceding_turn", "有原文")).toBe(false);
    expect(canMakeScenarioFromAuthentic("response_task", "有原文")).toBe(false);
    expect(canMakeScenarioFromAuthentic("translation_source", "有原文")).toBe(true);
  });

  it("내부 분류값과 저장 기록은 바꾸지 않는다", async () => {
    render(<MemoryRouter><AdminAuthentic /></MemoryRouter>);
    await screen.findByText("출발 후보");
    expect(AUTHENTIC_USAGE_TYPES).toEqual([
      "scenario_seed", "preceding_turn", "translation_source", "response_task", "expression_resource", "unsuitable",
    ]);
    expect(CANDIDATES.map((c) => c.usage_type)).toEqual(["translation_source", "preceding_turn", "response_task"]);
    expect(store.save).not.toHaveBeenCalled();
    expect(store.setStatus).not.toHaveBeenCalled();
    fireEvent.click(within(cardOf("출발 후보")).getByRole("button", { name: "시나리오 만들기" }));
    await waitFor(() => expect(store.setStatus).toHaveBeenCalledWith("c1", "used"));
    expect(store.setStatus).toHaveBeenCalledTimes(1);
  });
});
