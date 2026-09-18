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
      let requireCourse = false;
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "in", "neq"]) builder[method] = () => builder;
      builder.not = (column: string) => { if (column === "course_id") requireCourse = true; return builder; };
      builder.range = (start: number, end: number) => { from = start; to = end; return builder; };
      builder.then = (resolve: (value: unknown) => unknown) => {
        const all = mocks.tables[table] ?? [];
        const rows = requireCourse ? all.filter((row) => (row as { course_id?: string | null }).course_id) : all;
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
      // 교수자 차례 1건, 규칙 검사 전 1건, 규칙 검사 불통과 1건.
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

describe("admin dashboard", () => {
  it("shows the professor approval queue as the pending task, not the approved total", async () => {
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("교수자 승인 대기 1개"));
    // 품질 점검 대기 = 교수자 차례가 아닌 미션 중 규칙 검사 불통과를 뺀 것(규칙 검사 전 1건).
    expect(band.textContent).toContain("품질 점검 대기 1개");
    expect(band.textContent).toContain("규칙 검사 불통과 1개");
    expect(band.textContent).not.toContain("보류");
    // 제목을 되풀이하는 설명문은 두지 않는다.
    expect(band.textContent).not.toContain("기다리는 미션입니다");
    expect(within(band).getByRole("link", { name: "승인하러 가기 →" })).toHaveAttribute("href", "/admin/review");
    expect(within(band).getByRole("link", { name: "품질 점검 →" })).toHaveAttribute("href", "/admin/ai-review");

    // 승인 완료 누적 수(2)는 「교수자 승인 완료」로만 보이고, 대기·결정으로 부르지 않는다.
    const approvedLink = screen.getAllByRole("link", { name: /교수자 승인 완료/ })[0];
    expect(approvedLink.textContent).toContain("2");
    expect(approvedLink).toHaveAttribute("href", "/admin/review");
    expect(screen.queryByText("교수자 결정")).not.toBeInTheDocument();
  });

  it("keeps the number-first overall flow with accurate labels and no helper sentence", async () => {
    show();
    const inProgress = await screen.findByRole("link", { name: /검수·승인 중/ });
    await waitFor(() => expect(inProgress.textContent).toContain("3"));
    expect(inProgress).toHaveAttribute("href", "/admin/ai-review");
    expect(screen.queryByText("승인 전 미션")).not.toBeInTheDocument();
    const records = screen.getAllByRole("link", { name: /수행 기록/ })[0];
    expect(records).toHaveAttribute("href", "/admin/decision-traces");
    expect(screen.queryByText(/단계별 누적 수입니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/각 미션을 다음에 처리할 단계/)).not.toBeInTheDocument();
  });

  it("shows cumulative completions on review cards and the waiting count only in the tooltip", async () => {
    mocks.tables.content_review_runs = [
      run("ready"),
      // 같은 미션의 재실행 — 누적은 여전히 1이다.
      run("ready", { created_at: "2026-09-03T00:00:00Z", claude_response_id: "c", adjudication_response_id: "a" }),
      run("rule-fail", { rules_verdict: "fail" }),
    ];
    show();
    const stages = await screen.findByRole("group", { name: "품질 검수 단계" });
    // 카드 제목(규칙 검사 · OpenAI/Claude · 교수자)이 이미 세 층을 말하므로 묶음 머리표는 두지 않는다.
    expect(stages.textContent).not.toContain("AI 문맥 검토");
    const rules = within(stages).getByRole("link", { name: /규칙 검사 완료/ });
    // 규칙 검사를 통과한 서로 다른 미션 1건(재실행 중복·불통과 제외).
    await waitFor(() => expect(rules.textContent).toMatch(/1\s*개/));
    expect(rules.textContent).toContain("규칙 33개 자동 검사");
    // 저장 결과 재사용 같은 구현 사정은 첫 화면에 두지 않는다.
    expect(stages.textContent).not.toContain("재사용");
    expect(rules).toHaveAttribute("title", "지금 대기 2개");
    const claude = within(stages).getByRole("link", { name: /Claude 독립 검토 완료/ });
    expect(claude.textContent).toMatch(/1\s*개/);
    expect(claude).toHaveAttribute("title", "지금 대기 0개");
    const professor = within(stages).getByRole("link", { name: /교수자 승인 완료/ });
    expect(professor.textContent).toMatch(/2\s*개/);
    expect(professor).toHaveAttribute("title", "지금 대기 1개");
    expect(professor.textContent).not.toContain("보류");
  });

  it("keeps unconverted v5 missions out of the waiting counts without a separate label", async () => {
    mocks.tables.scenarios = [
      ...(mocks.tables.scenarios as unknown[]),
      // 현재 기준 run이 없는 v5 2건 — 검수 대신 v6로 전환한다.
      scenario("v5-a", { mission_schema_version: "mission_v5" }),
      scenario("v5-b", { mission_schema_version: "mission_v5" }),
      // 현재 기준 run이 있는 v5는 원래대로 센다.
      scenario("v5-ready", { mission_schema_version: "mission_v5" }),
    ];
    mocks.tables.content_review_runs = [...(mocks.tables.content_review_runs as unknown[]), run("v5-ready")];
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("교수자 승인 대기 2개"));
    expect(band.textContent).toContain("품질 점검 대기 1개");
    const stages = screen.getByRole("group", { name: "품질 검수 단계" });
    const rules = within(stages).getByRole("link", { name: /규칙 검사 완료/ });
    expect(rules).toHaveAttribute("title", "지금 대기 2개");
    expect(rules.textContent).not.toContain("v5");
  });

  it("keeps the four operation cards with account and record labels that do not imply real students", async () => {
    mocks.tables.learner_mission_logs = [{ id: "l1", course_id: "c1" }, { id: "l2", course_id: null }, { id: "l3", course_id: null }];
    mocks.tables.curriculum_week_scenarios = [
      { outline_id: "c1", week_no: 2, scenario_id: "done-1" },
      { outline_id: "c1", week_no: 3, scenario_id: "ready" },
    ];
    show();
    // 편성 건수는 전체 흐름 칸에만 두고, 운영 카드는 주차를 큰 수로 보인다.
    const assignments = await screen.findByRole("link", { name: /편성 주차/ });
    await waitFor(() => expect(assignments.textContent).toMatch(/편성 주차\s*2\s*개\s*서로 다른 미션 2개$/));
    expect(screen.queryByText("미션 배정")).not.toBeInTheDocument();
    // 게이트 이전 편성 부채는 메인 문구에 두지 않고 마우스를 올릴 때만 보인다.
    expect(assignments.textContent).not.toContain("승인");
    expect(assignments).toHaveAttribute("title", "승인 전 미션 1개 포함(게이트 이전 편성)");
    expect(screen.getByRole("link", { name: /승인 학습자 계정/ })).toHaveAttribute("href", "/admin/learners");
    const records = screen.getByRole("link", { name: /교과목 수업 기록/ });
    expect(records.textContent).toMatch(/교과목 수업 기록\s*1\s*건/);
    expect(records.textContent).toMatch(/시범 수행 2건 별도$/);
  });

  it("hides the rule-failure line when no mission failed the rule check", async () => {
    mocks.tables.content_review_runs = [run("ready")];
    mocks.tables.scenarios = mocks.tables.scenarios.filter((row) => (row as { scenario_id: string }).scenario_id !== "rule-fail");
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("품질 점검 대기 1개"));
    expect(band.textContent).not.toContain("규칙 검사 불통과");
  });

  it("routes rule and AI review stages to the quality check screen and the professor stage to final approval", async () => {
    show();
    const rulesCard = await screen.findByRole("link", { name: /규칙 검사 완료/ });
    expect(rulesCard).toHaveAttribute("href", "/admin/ai-review");
    for (const label of ["OpenAI 검토 완료", "Claude 독립 검토 완료", "OpenAI 재검토 완료"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^\\d+\\s*${label}`) })).toHaveAttribute("href", "/admin/ai-review");
    }
    const stages = screen.getByRole("group", { name: "품질 검수 단계" });
    const professorCards = within(stages).getAllByRole("link", { name: /교수자 승인 완료/ });
    expect(professorCards).toHaveLength(1);
    expect(professorCards[0]).toHaveAttribute("href", "/admin/review");
  });
});
