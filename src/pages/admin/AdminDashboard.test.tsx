import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";
import { DASHBOARD_REVIEW_CRITERIA_VERSION } from "@/lib/admin/adminDashboardMetrics";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

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
  it("keeps the action bar to the professor queue and the quality-check queue", async () => {
    show();
    const band = screen.getByRole("region", { name: "지금 할 일" });
    await waitFor(() => expect(band.textContent).toContain("교수자 승인 대기 · 학습 미션 1개"));
    // 품질 점검 대기 = 교수자 차례가 아닌 미션 중 규칙 검사 불통과를 뺀 것(규칙 검사 전 1건).
    expect(band.textContent).toContain("품질 점검 대기 · 학습 미션 1개");
    expect(band.textContent).toContain("규칙 검사 불통과 · 1개");
    expect(band.textContent).not.toContain("보류");
    expect(within(band).getByRole("link", { name: "승인하러 가기 →" })).toHaveAttribute("href", "/admin/review");
    expect(within(band).getByRole("link", { name: "품질 점검 화면 →" })).toHaveAttribute("href", "/admin/ai-review");
    expect(screen.queryByText("교수자 결정")).not.toBeInTheDocument();
  });

  it("shows the five lifecycle steps in sidebar order with their destinations", async () => {
    show();
    const spine = screen.getByRole("list", { name: "PRAGMA 운영 워크플로우" });
    const links = within(spine).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/prompt-harness", "/admin/library", "/admin/assembly", "/admin/composer", "/admin/decision-traces",
    ]);
    expect(links[0].textContent).toMatch(/생성 기준.*규칙\s*33개/);
    await waitFor(() => expect(links[2].textContent).toMatch(/학습 미션\s*5개/));
  });

  it("splits learning missions into in-progress, approved and other states that add up", async () => {
    mocks.tables.scenarios.push(
      scenario("revise", { review_status: "revise_required" }),
      scenario("legacy", { mission_status: "reviewed" }),
    );
    show();
    const quality = screen.getByRole("region", { name: "학습 미션 제작·품질 관리" });
    await waitFor(() => expect(quality.textContent).toMatch(/학습 미션\s*7개\s*=/));
    expect(within(quality).getByRole("link", { name: /검수 진행 중/ }).textContent).toContain("3");
    const approved = within(quality).getByRole("link", { name: /교수자 승인 완료/ });
    expect(approved.textContent).toContain("2");
    expect(approved).toHaveAttribute("href", "/admin/review");
    expect(quality.textContent).toMatch(/기타 상태\s*2\s*\(수정 요청 1 · 승인 기록 없는 옛 미션 1\)/);
  });

  it("groups the five review stages as rules, AI review and professor gate with queues adding up", async () => {
    show();
    const stages = await screen.findByRole("group", { name: "품질 검수 단계" });
    expect(stages.textContent).toMatch(/결정론 검사.*AI 문맥 검토.*교수자 승인/);
    // 진행 중 3 = 결정론 규칙 검사 대기 2(검사 전 1 + 불통과 1) + 교수자 최종 승인 대기 1.
    await waitFor(() => expect(within(stages).getByRole("link", { name: /결정론 규칙 검사/ }).textContent).toMatch(/현재 대기\s*2/));
    expect(within(stages).getByRole("link", { name: /교수자 최종 승인/ }).textContent).toMatch(/현재 대기\s*1/);
    expect(within(stages).getByRole("link", { name: /OpenAI 품질 검토/ }).textContent).toContain("대기 없음");
    expect(stages.textContent).toMatch(/현재 대기 합계\s*3개/);
    expect(screen.queryByText(/보류/)).not.toBeInTheDocument();
  });

  it("counts cumulative completions per distinct mission, not per run, and never counts a failed rule check", async () => {
    mocks.tables.content_review_runs = [
      run("ready"),
      // 같은 미션의 재실행 — 누적은 여전히 1이다.
      run("ready", { created_at: "2026-09-03T00:00:00Z", claude_response_id: "c", adjudication_response_id: "a" }),
      // 규칙 검사 실패 run의 AI 응답은 완료로 세지 않는다.
      run("rule-fail", { rules_verdict: "fail" }),
      // warning은 다음 단계로 넘어가므로 완료다.
      run("done-1", { rules_verdict: "warning", openai_response_id: null, generation_quality_hash: "h" }),
    ];
    show();
    const stages = await screen.findByRole("group", { name: "품질 검수 단계" });
    const card = (name: RegExp) => within(stages).getByRole("link", { name });
    await waitFor(() => expect(card(/결정론 규칙 검사/).textContent).toMatch(/누적 완료\s*2/));
    expect(card(/OpenAI 품질 검토/).textContent).toMatch(/누적 완료\s*2/);
    expect(card(/Claude 독립 검토/).textContent).toMatch(/누적 완료\s*1.*대기 없음.*선택형/);
    expect(card(/OpenAI 재검토/).textContent).toMatch(/누적 완료\s*1.*대기 없음.*선택형/);
    expect(card(/교수자 최종 승인/).textContent).toMatch(/승인 완료\s*2/);
    expect(card(/결정론 규칙 검사/).textContent).toMatch(/규칙 33개/);
  });

  it("shows the approved-to-classroom gate with the library's composer-ready count", async () => {
    mocks.tables.scenarios.push(scenario("ready-v5", {
      mission_status: "reviewed", authoring_stage: "professor_finalized", mission_schema_version: "mission_v5",
      content_release_id: CURRENT_CONTENT_RELEASE_ID, mpj_item_5_type: "scale4", mpj_item_6_type: null,
    }));
    show();
    const operations = screen.getByRole("region", { name: "수업 운영" });
    await waitFor(() => expect(within(operations).getByRole("link", { name: /편성 가능 미션/ }).textContent).toContain("1"));
    expect(within(operations).getByRole("link", { name: /교수자 승인/ }).textContent).toContain("3");
    expect(operations.textContent).not.toContain("포함");
  });

  it("notes unapproved missions inside assignments only when there are some", async () => {
    mocks.tables.curriculum_week_scenarios = [
      { outline_id: "c1", week_no: 2, scenario_id: "done-1" },
      { outline_id: "c1", week_no: 3, scenario_id: "ready" },
    ];
    show();
    const operations = screen.getByRole("region", { name: "수업 운영" });
    await waitFor(() => expect(operations.textContent).toContain("승인 전 미션 1개 포함"));
  });

  it("closes the workflow at research data export", async () => {
    show();
    const records = screen.getByRole("region", { name: "학습 기록·연구 자료" });
    expect(within(records).getByRole("link", { name: /학습 수행 기록/ })).toHaveAttribute("href", "/admin/decision-traces");
    expect(within(records).getByRole("link", { name: "연구 데이터 내보내기" })).toHaveAttribute("href", "/admin/export");
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
    const rulesCard = await screen.findByRole("link", { name: /결정론 규칙 검사/ });
    expect(rulesCard).toHaveAttribute("href", "/admin/ai-review");
    for (const label of ["OpenAI 품질 검토", "Claude 독립 검토", "OpenAI 재검토"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^\\d+\\s*${label}`) })).toHaveAttribute("href", "/admin/ai-review");
    }
    const professorCards = screen.getAllByRole("link", { name: /교수자 최종 승인/ });
    expect(professorCards).toHaveLength(1);
    expect(professorCards[0]).toHaveAttribute("href", "/admin/review");
  });
});
