import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAssembly from "./AdminAssembly";
import { DASHBOARD_REVIEW_CRITERIA_VERSION } from "@/lib/admin/adminDashboardMetrics";

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  selects: [] as string[],
  reviewMission: vi.fn(),
  promoteCore: vi.fn(),
  promoteCoreV6: vi.fn(),
  toastSuccess: vi.fn(),
  fetchMission: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let from = 0, to = 999;
  let single: string | null = null;
  const builder: Record<string, unknown> = {};
  for (const method of ["neq", "in", "is", "order", "limit"]) builder[method] = () => builder;
  builder.eq = (column: string, value: string) => { if (column === "scenario_id") single = value; return builder; };
  builder.select = (columns: string) => { mocks.selects.push(`${table}:${columns}`); return builder; };
  builder.range = (start: number, end: number) => { from = start; to = end; return builder; };
  builder.maybeSingle = () => Promise.resolve({ data: (mocks.tables[table] ?? []).find((row) => (row as { scenario_id: string }).scenario_id === single) ?? null, error: null });
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: (mocks.tables[table] ?? []).slice(from, to + 1), error: null }).then(resolve);
  return builder;
} } }));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/components/admin/GenerationJobsPanel", () => ({ GenerationJobsPanel: () => null }));
vi.mock("@/components/admin/ProfessorMissionWorkbench", () => ({
  ProfessorMissionWorkbench: ({ onReview, approvalHref }: { onReview: (o: unknown[], a: unknown) => Promise<void>; approvalHref?: string }) => (
    <div>
      <p>교수자 작업대</p>
      {approvalHref && <a href={approvalHref}>품질 점검 화면에서 이 미션 열기 →</a>}
      <button type="button" onClick={() => void onReview([], { reviewId: "r", contentHash: "h", professorNote: "수업 사용 가능 판단" })}>승인 실행</button>
    </div>
  ),
}));
vi.mock("@/components/admin/ContentReviewPanel", () => ({ ContentReviewPanel: ({ handoffHref }: { handoffHref?: string }) => <div>점검 패널 {handoffHref}</div> }));
vi.mock("@/components/admin/MissionPreview", () => ({ MissionPreview: () => <div>미리보기</div> }));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionForReview: mocks.fetchMission }));
vi.mock("@/lib/pragma/promoteMission", () => ({
  promoteCore: mocks.promoteCore, reviewMission: mocks.reviewMission, reviseMissionDraft: vi.fn(), supersedeMissionForRework: vi.fn(),
}));
vi.mock("@/lib/pragma/promoteMissionV6", () => ({ promoteCoreV6: mocks.promoteCoreV6 }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

const hash = "a84f21c9e0b1".padEnd(64, "0");
const scenario = (id: string, brief: string, status: string | null = "generated", updated = "2026-09-01T00:00:00Z") => ({
  scenario_id: id, speech_act: "request", learner_level: "intermediate", domain: null, industry_sector: null,
  mode: "translation", source_modality: null, theme_code: null, topic_code: null, mission_status: status,
  generation_run_id: null, generation_item_key: null, prompt_snapshot_hash: null,
  core_content: { brief_note_ko: brief, situation_ko: `${brief} 상황`, direction: "ko_zh" }, review_status: null,
  updated_at: updated, mission_schema_version: "mission_v6", mission_content_hash: hash,
});
const run = (id: string, overrides: Record<string, unknown> = {}) => ({
  target_id: id, kind: "mission", criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION, rules_verdict: "pass",
  openai_response_id: "o", claude_response_id: null, adjudication_response_id: null, created_at: "2026-09-10T00:00:00Z",
  approval_policy: "focused_v1", independent_review_requested: false, generation_quality_hash: null, claude_first_finding: null,
  approved_at: null, ...overrides,
});

const show = (props: { reviewMode?: boolean; aiReview?: boolean } = { reviewMode: true }, path = "/admin/review") =>
  render(<MemoryRouter initialEntries={[path]}><AdminAssembly {...props} /></MemoryRouter>);
const workbench = () => screen.getByRole("region", { name: "작업대" });
const queue = () => screen.getByRole("list", { name: "미션 목록" });

beforeEach(() => {
  mocks.selects = [];
  mocks.fetchMission.mockReset().mockResolvedValue({ mission: { schema_version: "mission_v6" } });
  mocks.reviewMission.mockReset().mockResolvedValue({ ok: true });
  mocks.promoteCore.mockReset();
  mocks.promoteCoreV6.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.tables = {
    scenarios: [
      scenario("m-ready-new", "나중에 올라온 결정 미션", "generated", "2026-09-05T00:00:00Z"),
      scenario("m-ready", "결정할 미션", "generated", "2026-09-01T00:00:00Z"),
      scenario("m-rules", "규칙 검사 전 미션"),
      scenario("m-fail", "규칙 오류 미션"),
      scenario("m-done", "승인한 미션", "reviewed"),
    ],
    content_review_runs: [run("m-ready"), run("m-ready-new"), run("m-fail", { rules_verdict: "fail" })],
    curriculum_week_scenarios: [{ outline_id: "c1", week_no: 3, scenario_id: "m-ready" }],
    curriculum_outlines: [{ id: "c1", title: "비즈니스 중국어" }],
  };
});
afterEach(cleanup);

describe("professor final approval workbench", () => {
  it("opens the longest-waiting decision on the workbench without an extra click", async () => {
    show();
    const bench = await screen.findByRole("region", { name: "작업대" });
    expect(await within(bench).findByRole("heading", { name: "결정할 미션" })).toBeInTheDocument();
    expect(await within(bench).findByText("교수자 작업대")).toBeInTheDocument();
    // 머리에는 편성 위치만 둔다(버전·수정 시각·Trace는 세부 추적 정보로).
    expect(within(bench).getByText("비즈니스 중국어 3주차")).toBeInTheDocument();
    expect(within(bench).queryByText(/Trace a84f21c/)).toBeNull();
    expect(within(bench).queryByText(/규칙 통과|AI 검토 완료|교수자 결정 대기/)).not.toBeInTheDocument();
    // 교수자 최종 승인은 대기열을 옆에 두지 않는다. 목록은 머리의 버튼으로 연다.
    expect(screen.queryByRole("list", { name: "미션 목록" })).not.toBeInTheDocument();
    fireEvent.click(within(bench).getByRole("button", { name: "미션 목록 열기" }));
    expect(screen.getByRole("button", { name: /승인 대기\s*2/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /점검 진행 중\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /검토 완료 상태\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "정렬" })).toHaveValue("oldest");

    const cards = within(queue()).getAllByRole("listitem");
    expect(within(cards[0]).getByText("결정할 미션")).toBeInTheDocument();
    expect(within(cards[0]).getByText("비즈니스 중국어 3주차 · Mission v6 · Trace a84f21c")).toBeInTheDocument();
    expect(within(cards[1]).getByText("편성 전 · Mission v6 · Trace a84f21c")).toBeInTheDocument();
    // 편성·검수 이력은 표마다 한 번(페이지 단위)만 읽는다.
    expect(mocks.selects.filter((entry) => entry.startsWith("curriculum_week_scenarios")).length).toBe(1);
    expect(mocks.selects.filter((entry) => entry.startsWith("content_review_runs")).length).toBe(1);
  });

  it("moves with previous/next and keeps the approved mission open until the professor moves on", async () => {
    show();
    await within(await screen.findByRole("region", { name: "작업대" })).findByText("교수자 작업대");
    fireEvent.click(within(workbench()).getByRole("button", { name: "승인 실행" }));
    await waitFor(() => expect(mocks.reviewMission).toHaveBeenCalledTimes(1));
    // 승인 후에도 같은 미션이 남고, 결과(승인 이력 패널)를 보여 준다.
    expect(await within(workbench()).findByText(/점검 패널/)).toBeInTheDocument();
    expect(within(workbench()).getByRole("heading", { name: "결정할 미션" })).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole("button", { name: "다음" }));
    expect(await within(workbench()).findByRole("heading", { name: "나중에 올라온 결정 미션" })).toBeInTheDocument();
    expect(within(workbench()).getByRole("button", { name: "이전" })).toBeDisabled();
  });

  it("opens the queue drawer, switches missions from a card and returns to the wide review", async () => {
    show();
    const bench = await screen.findByRole("region", { name: "작업대" });
    await within(bench).findByRole("heading", { name: "결정할 미션" });
    fireEvent.click(within(bench).getByRole("button", { name: "미션 목록 열기" }));
    fireEvent.click(within(queue()).getByText("나중에 올라온 결정 미션"));
    expect(await within(workbench()).findByRole("heading", { name: "나중에 올라온 결정 미션" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "미션 목록" })).not.toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole("button", { name: "미션 목록 열기" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("list", { name: "미션 목록" })).not.toBeInTheDocument();
  });

  it("shows the quality-check handoff for missions that are not the professor's turn", async () => {
    show();
    await within(await screen.findByRole("region", { name: "작업대" })).findByRole("heading", { name: "결정할 미션" });
    fireEvent.click(within(workbench()).getByRole("button", { name: "미션 목록 열기" }));
    fireEvent.click(await screen.findByRole("button", { name: /점검 진행 중/ }));
    const bench = workbench();
    expect(await within(bench).findByRole("link", { name: "품질 점검 화면에서 이 미션 열기 →" }))
      .toHaveAttribute("href", expect.stringMatching(/^\/admin\/ai-review\?scenarioId=m-(rules|fail)$/));
    expect(within(bench).queryByText("교수자 작업대")).not.toBeInTheDocument();
  });

  it("opens a linked mission selected inside its own chip", async () => {
    show({ reviewMode: true }, "/admin/review?scenarioId=m-rules");
    expect(await within(await screen.findByRole("region", { name: "작업대" })).findByRole("heading", { name: "규칙 검사 전 미션" })).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole("button", { name: "미션 목록 열기" }));
    expect(screen.getByRole("button", { name: /점검 진행 중/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(queue()).getByText("규칙 검사 전 미션").closest("button")).toHaveAttribute("aria-current", "true");
  });

  it("explains an empty decision queue", async () => {
    mocks.tables.content_review_runs = [];
    show();
    expect(await screen.findByText(/지금 결정할 미션이 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /점검 진행 중인 4개는 품질 점검 화면에서 확인하세요/ }))
      .toHaveAttribute("href", "/admin/ai-review");
  });
});

describe("quality check workbench", () => {
  it("splits generated missions into needs-check, rule-error and awaiting-professor chips", async () => {
    show({ reviewMode: true, aiReview: true }, "/admin/ai-review");
    const bench = await screen.findByRole("region", { name: "작업대" });
    expect(screen.getByRole("button", { name: /품질 점검 대기\s*1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /점검 실패\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /교수자 승인 대기\s*2/ })).toBeInTheDocument();
    expect(within(bench).getByRole("heading", { name: "규칙 검사 전 미션" })).toBeInTheDocument();
    expect(within(bench).getByText("점검 패널 /admin/review?scenarioId=m-rules")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0건 자동 점검 실행" })).toBeDisabled();
  });
});

describe("assembly workbench", () => {
  it("opens on generatable scenarios with the draft button, leaving legacy cores out", async () => {
    mocks.tables.scenarios = [
      scenario("v6-new", "새 v6 미션"),
      { ...scenario("core-new", "생성할 시나리오", null), core_content: { brief_note_ko: "생성할 시나리오", situation_ko: "상황", direction: "ko_zh", focal_segments: [{ role: "head", text: "원문" }] } },
      scenario("core-legacy", "옛 코어", null),
    ];
    show({}, "/admin/assembly");
    const bench = await screen.findByRole("region", { name: "작업대" });
    expect(screen.getByRole("button", { name: /초안 생성 대기\s*1/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(bench).getByRole("heading", { name: "생성할 시나리오" })).toBeInTheDocument();
    expect(within(bench).getByRole("button", { name: "미션 자동 생성" })).toBeEnabled();
    expect(within(queue()).queryByText("옛 코어")).not.toBeInTheDocument();
    let finish!: (result: unknown) => void;
    mocks.promoteCoreV6.mockImplementation((_core, onStage) => {
      onStage("quality");
      return new Promise(resolve => { finish = resolve; });
    });
    fireEvent.click(within(bench).getByRole("button", { name: "미션 자동 생성" }));
    expect(await screen.findByText("AI 검토 중")).toBeInTheDocument();
    finish({ ok: true, ruleResult: "pass", qualityVerdict: "pass", repaired: false });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("초안 저장 · 자동 품질 점검 통과 · AI 검토 의견 저장 — 품질 점검 단계에서 확인해 주세요"));
    expect(mocks.promoteCoreV6).toHaveBeenCalledTimes(1);
  });

  it("hides superseded drafts and legacy scenario-only rows from the v6 lists", async () => {
    mocks.tables.scenarios = [
      { ...scenario("v6-new", "새 v6 미션"), supersedes_scenario_id: "v6-old" },
      scenario("v6-old", "옛 v6 초안"),
      scenario("core", "시나리오만", null),
    ];
    show({}, "/admin/assembly");
    const bench = await screen.findByRole("region", { name: "작업대" });
    // 기본 칩(초안 생성 대기)이 비어 있으면 화면이 채워진 칩으로 넘어간다 — 그 전환을 기다린다.
    expect(await within(bench).findByRole("heading", { name: "새 v6 미션" })).toBeInTheDocument();
    expect(within(bench).getByRole("region", { name: "제작 워크플로우" })).toBeInTheDocument();
    expect(within(bench).queryByRole("button", { name: "미션 조립" })).not.toBeInTheDocument();
    expect(within(queue()).queryByText("옛 v6 초안")).not.toBeInTheDocument();
    expect(within(queue()).queryByText("시나리오만")).not.toBeInTheDocument();
    expect(mocks.promoteCore).not.toHaveBeenCalled();
  });
});
