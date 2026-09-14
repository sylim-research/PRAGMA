import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAssembly from "./AdminAssembly";
import { DASHBOARD_REVIEW_CRITERIA_VERSION } from "@/lib/admin/adminDashboardMetrics";

const mocks = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]>, selects: [] as string[] }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let from = 0, to = 999;
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "neq", "in", "is", "order", "limit"]) builder[method] = () => builder;
  builder.select = (columns: string) => { mocks.selects.push(`${table}:${columns}`); return builder; };
  builder.range = (start: number, end: number) => { from = start; to = end; return builder; };
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: (mocks.tables[table] ?? []).slice(from, to + 1), error: null }).then(resolve);
  return builder;
} } }));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/components/admin/GenerationJobsPanel", () => ({ GenerationJobsPanel: () => null }));
vi.mock("@/components/admin/ProfessorMissionWorkbench", () => ({ ProfessorMissionWorkbench: () => <div>교수자 작업대</div> }));
vi.mock("@/components/admin/ContentReviewPanel", () => ({ ContentReviewPanel: () => <div>점검 패널</div> }));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionForReview: vi.fn(async () => ({ mission: { schema_version: "mission_v6" } })) }));

const hash = "a84f21c9e0b1".padEnd(64, "0");
const scenario = (id: string, brief: string, status = "generated") => ({
  scenario_id: id, speech_act: "request", learner_level: "intermediate", domain: null, industry_sector: null,
  mode: "translation", source_modality: null, theme_code: null, topic_code: null, mission_status: status,
  generation_run_id: null, generation_item_key: null, prompt_snapshot_hash: null,
  core_content: { brief_note_ko: brief, direction: "ko_zh" }, review_status: null,
  updated_at: "2026-09-01T00:00:00Z", mission_schema_version: "mission_v6", mission_content_hash: hash,
});
const run = (id: string, overrides: Record<string, unknown> = {}) => ({
  target_id: id, kind: "mission", criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION, rules_verdict: "pass",
  openai_response_id: "o", claude_response_id: null, adjudication_response_id: null, created_at: "2026-09-02T00:00:00Z",
  approval_policy: "focused_v1", independent_review_requested: false, generation_quality_hash: null, claude_first_finding: null,
  approved_at: null, ...overrides,
});

const show = () => render(<MemoryRouter><AdminAssembly reviewMode /></MemoryRouter>);

beforeEach(() => {
  mocks.selects = [];
  mocks.tables = {
    scenarios: [scenario("m-ready", "결정할 미션"), scenario("m-rules", "규칙 검사 전 미션"), scenario("m-done", "승인한 미션", "reviewed")],
    content_review_runs: [run("m-ready")],
    curriculum_week_scenarios: [{ outline_id: "c1", week_no: 3, scenario_id: "m-ready" }],
    curriculum_outlines: [{ id: "c1", title: "비즈니스 중국어" }],
  };
});
afterEach(cleanup);

describe("professor final approval list", () => {
  it("opens on the decision queue and keeps in-progress and approved as secondary chips", async () => {
    show();
    expect(await screen.findByText("결정할 미션")).toBeInTheDocument();
    expect(screen.queryByText("규칙 검사 전 미션")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /결정 대기\s*1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /검수 진행 중\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /승인 완료\s*1/ })).toBeInTheDocument();

    const item = screen.getByText("결정할 미션").closest("li")!;
    expect(within(item).getByText("비즈니스 중국어 3주차")).toBeInTheDocument();
    expect(within(item).getByText("Mission v6")).toBeInTheDocument();
    expect(within(item).getByText("Trace a84f21c")).toBeInTheDocument();
    expect(within(item).getByText("규칙 통과 · AI 검토 완료 · 교수자 결정 대기")).toBeInTheDocument();
    // 조회는 목록 전체에 대해 표마다 한 번(페이지 단위)만 일어난다.
    expect(mocks.selects.filter((entry) => entry.startsWith("curriculum_week_scenarios")).length).toBe(1);
    expect(mocks.selects.filter((entry) => entry.startsWith("content_review_runs")).length).toBe(1);
  });

  it("sends missions that are not the professor's turn to the quality check screen", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /검수 진행 중/ }));
    const item = (await screen.findByText("규칙 검사 전 미션")).closest("li")!;
    expect(within(item).getByText("편성 전")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "품질 점검 화면에서 진행 →" }))
      .toHaveAttribute("href", "/admin/ai-review?scenarioId=m-rules");
    expect(within(item).queryByRole("button", { name: /감수하기/ })).not.toBeInTheDocument();
  });

  it("explains an empty decision queue and points to the quality check screen", async () => {
    mocks.tables.content_review_runs = [];
    show();
    expect(await screen.findByText(/지금 결정할 미션이 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /검수 진행 중인 2개는 품질 점검 화면에서 확인하세요/ }))
      .toHaveAttribute("href", "/admin/ai-review");
  });
});
