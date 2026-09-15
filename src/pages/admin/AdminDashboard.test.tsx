import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";
import { DASHBOARD_REVIEW_CRITERIA_VERSION } from "@/lib/admin/adminDashboardMetrics";

const mocks = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: false, error: null })),
    from: (table: string) => {
      let from = 0, to = 999;
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "in", "neq"]) builder[method] = () => builder;
      builder.range = (start: number, end: number) => { from = start; to = end; return builder; };
      builder.then = (resolve: (value: unknown) => unknown) => {
        const rows = mocks.tables[table] ?? [];
        return Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null }).then(resolve);
      };
      return builder;
    },
  },
}));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/components/admin/ServiceHealthPanel", () => ({ ServiceHealthPanel: () => null }));
vi.mock("@/lib/auth/useProfile", () => ({ IS_DEV: false }));

const scenario = (id: string, overrides: Record<string, unknown> = {}) => ({
  scenario_id: id, content_format: "scenario_core_v1", review_status: null, mission_status: "generated",
  updated_at: "2026-09-01T00:00:00Z", mission_schema_version: "mission_v6", authoring_stage: null, ...overrides,
});
const run = (id: string, overrides: Record<string, unknown> = {}) => ({
  target_id: id, kind: "mission", criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION, rules_verdict: "pass",
  openai_response_id: "o", claude_response_id: null, adjudication_response_id: null, created_at: "2026-09-02T00:00:00Z",
  approval_policy: "focused_v1", independent_review_requested: false, approved_at: null,
  generation_quality_hash: null, claude_first_finding: null, ...overrides,
});

beforeEach(() => {
  mocks.tables = {
    scenarios: [
      // 교수자 승인 완료 2건 — 누적 완료 수이지 할 일이 아니다.
      scenario("done-1", { mission_status: "reviewed", authoring_stage: "professor_finalized" }),
      scenario("done-2", { mission_status: "released", authoring_stage: "professor_finalized" }),
      // 교수자 차례 1건, 규칙 검사 전 1건, 규칙 오류 1건.
      scenario("ready"),
      scenario("no-run"),
      scenario("rule-fail"),
    ],
    content_review_runs: [run("ready"), run("rule-fail", { rules_verdict: "fail" })],
    curriculum_week_scenarios: [],
    curriculum_outlines: [],
    profiles: [],
    learner_mission_logs: [],
  };
});
afterEach(cleanup);

const show = () => render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

describe("admin dashboard task-first counts", () => {
  it("shows the professor approval queue as the pending task, not the approved total", async () => {
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("교수자 승인 대기 · 학습 미션 1개"));
    // 품질 점검 대기 = 교수자 차례가 아닌 미션 중 규칙 검사 불통과를 뺀 것(규칙 검사 전 1건).
    expect(band.textContent).toContain("품질 점검 대기 · 학습 미션 1개");
    expect(band.textContent).toContain("규칙 검사 불통과 · 1개");
    expect(band.textContent).not.toContain("보류");
    expect(within(band).getByRole("link", { name: "승인하러 가기 →" })).toHaveAttribute("href", "/admin/review");
    expect(within(band).getByRole("link", { name: "품질 점검 화면 →" })).toHaveAttribute("href", "/admin/ai-review");

    // 승인 완료 누적 수(2)는 「교수자 승인 완료」로만 보이고, 대기·결정으로 부르지 않는다.
    const approvedLink = screen.getByRole("link", { name: /교수자 승인 완료/ });
    expect(approvedLink.textContent).toContain("2");
    expect(approvedLink).toHaveAttribute("href", "/admin/review");
    expect(screen.queryByText("교수자 결정")).not.toBeInTheDocument();
    expect(band.textContent).not.toContain("교수자 승인 대기 2개");
  });

  it("shows the review stages as a subset that adds up to the pending-approval count", async () => {
    show();
    const stages = await screen.findByRole("group", { name: "승인 전 미션의 검수 단계" });
    // 승인 전 3 = 규칙 검사 대기 2(검사 전 1 + 불통과 1) + 교수자 승인 대기 1.
    await waitFor(() => expect(within(stages).getByRole("link", { name: /규칙 검사 대기/ }).textContent).toContain("2"));
    expect(within(stages).getByRole("link", { name: /교수자 승인 대기/ }).textContent).toContain("1");
    const reviewLayer = screen.getByRole("region", { name: "품질 검수·승인" });
    expect(within(reviewLayer).getByRole("link", { name: /승인 전 미션/ }).textContent).toContain("3");
    expect(reviewLayer.textContent).toContain("수정·옛 상태");
    expect(screen.queryByText(/보류/)).not.toBeInTheDocument();
    // 편성된 미션이 모두 승인 완료면 「승인 전 미션 포함」을 붙이지 않는다.
    expect(screen.getByRole("region", { name: "수업 운영·학습 수행" }).textContent).not.toContain("포함");
  });

  it("notes unapproved missions inside assignments only when there are some", async () => {
    mocks.tables.curriculum_week_scenarios = [
      { outline_id: "c1", week_no: 2, scenario_id: "done-1" },
      { outline_id: "c1", week_no: 3, scenario_id: "ready" },
    ];
    show();
    const operations = screen.getByRole("region", { name: "수업 운영·학습 수행" });
    await waitFor(() => expect(operations.textContent).toContain("승인 전 미션 1개 포함"));
  });

  it("hides the rule-failure line when no mission failed the rule check", async () => {
    mocks.tables.content_review_runs = [run("ready")];
    mocks.tables.scenarios = mocks.tables.scenarios.filter((row) => (row as { scenario_id: string }).scenario_id !== "rule-fail");
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("품질 점검 대기 · 학습 미션 1개"));
    expect(band.textContent).not.toContain("규칙 검사 불통과");
  });

  it("routes rule and AI review stages to the quality check screen and the professor stage to final approval", async () => {
    show();
    const rulesCard = await screen.findByRole("link", { name: /규칙 검사 대기/ });
    expect(rulesCard).toHaveAttribute("href", "/admin/ai-review");
    for (const label of ["OpenAI 검토 대기", "Claude 독립 검토 대기", "OpenAI 재검토 대기"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^\\d+\\s*${label}`) })).toHaveAttribute("href", "/admin/ai-review");
    }
    const professorCards = screen.getAllByRole("link", { name: /교수자 승인 대기/ });
    expect(professorCards).toHaveLength(1);
    expect(professorCards[0]).toHaveAttribute("href", "/admin/review");
  });
});
