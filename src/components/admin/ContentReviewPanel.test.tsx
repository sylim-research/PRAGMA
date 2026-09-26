import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentReviewPanel } from "./ContentReviewPanel";
import { BULK_SIGNAL_RATIONALE, CONTENT_REVIEW_VERSION, PROFESSOR_DECISION_LABELS, type ModelReview, type ProfessorFindingDecision, type ReviewFinding, type ReviewInspection, type ReviewResult } from "../../../supabase/functions/_shared/contentReview";

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), save: vi.fn(), approve: vi.fn() }));
vi.mock("@/lib/pragma/contentReviewApi", () => ({ contentReviewRequest: mocks.inspect, saveProfessorDecisions: mocks.save, approveContentReview: mocks.approve }));

const finding = { id: "claude-1", severity: "warning" as const, where: "/content/source", quote: "请您参加活动。",
  issue_ko: "초대의 선택권 확인", reason_ko: "참여 여부를 선택할 수 있는 상황인지 확인", suggestion_ko: "관계 맥락 확인",
  problem_type_ko: "화용적 적절성", needs_professor: true, uncertainty_ko: "수업에서 가정하는 관계에 따라 달라짐" };
const rationale = "행사 참여가 자율적인 상황임을 확인했습니다.";
const metadata = <T,>(result: T): ModelReview<T> => ({ result, provider: "openai", model: "fixture-model", requested_model: "fixture-model",
  response_id: "fixture", usage: {}, checked_at: "2026-08-27", prompt_version: CONTENT_REVIEW_VERSION, input_hash: "input" });
const signal = (id: string, rule: string, severity: "warning" | "fail" = "warning"): ReviewFinding => ({
  id, severity, where: "", quote: null, issue_ko: `${rule}: 교수자가 우선 확인할 신호`, reason_ko: "자동 규칙의 신호",
  suggestion_ko: "자동 규칙의 신호입니다. 실제 위반인지 교수자가 판단하세요.", problem_type_ko: "교수자 확인 신호",
  needs_professor: true, uncertainty_ko: "정규식·집계 기반 신호이며 의미 판단이 아닙니다." });
/** 규칙 신호를 현재 run에 실어 준다. 기본 fixture는 신호 없이 Claude 지적 1건만 있다. */
function withSignals(...findings: ReviewFinding[]) {
  inspection.run!.rules = { verdict: "warning", summary_ko: "규칙 신호", findings };
}
let inspection: ReviewInspection;

beforeEach(() => {
  vi.clearAllMocks();
  const snapshot = { content: { source: finding.quote } };
  const rules: ReviewResult = { verdict: "pass", summary_ko: "규칙 통과", findings: [] };
  inspection = { contentHash: "hash-current", sourceHash: "source-current", snapshot, history: [], dependencies: [], models: { openai: "fixture", claude: "fixture" },
    run: { id: "review-1", kind: "mission", target_id: "mission-1", week_no: 0, source_hash: "source-current", content_hash: "hash-current",
      criteria_version: CONTENT_REVIEW_VERSION, snapshot, rules, openai_review: metadata(rules),
      claude_review: { ...metadata({ verdict: "warning", summary_ko: "관계 맥락 확인 필요", findings: [finding] } as ReviewResult), provider: "anthropic" },
      adjudication: metadata({ summary_ko: "원문과 상황에 따른 판정", decisions: [{ finding_id: finding.id, decision: "reject", rationale_ko: "원문 상황에 참여 자율성이 명시됨",
        proposed_change_ko: "", needs_professor: true, evidence_path: finding.where, evidence_quote: finding.quote }] }),
      running_stage: null, lease_until: null, last_error: null, approved_at: null, approved_by: null, professor_note: null, openai_fail_override: null, professor_decisions: [], created_at: "2026-08-27" } };
  mocks.inspect.mockImplementation(async () => inspection);
  mocks.save.mockImplementation(async (_id: string, _hash: string, decisions: ProfessorFindingDecision[]) => {
    inspection = { ...inspection, run: { ...inspection.run!, professor_decisions: decisions } };
  });
  mocks.approve.mockImplementation(async (approval) => {
    inspection = { ...inspection, run: { ...inspection.run!, approved_at: "2026-08-27", professor_note: "수업 사용 가능", openai_fail_override: approval.openaiFailOverride ?? null } };
  });
});
afterEach(cleanup);

const DEFAULT_RATIONALE = { no_change: "원문·장면에 맞아 이대로 사용합니다.", defer: "추가 확인이 필요해 판단을 보류합니다.", revision_required: "검토 제안대로 수정하겠습니다." } as const;
function showPanel() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ContentReviewPanel target={{ kind: "mission", targetId: "mission-1" }} /></MemoryRouter>
  </QueryClientProvider>);
}
async function enterDecision(decision: ProfessorFindingDecision["decision"]) {
  fireEvent.click(await screen.findByRole("button", { name: `${PROFESSOR_DECISION_LABELS[decision]} · claude-1` }));
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("professor finding decisions", () => {
  it("두 검토가 같은 결론이면 재서술을 접어 두고 판단할 두 줄만 남긴다", async () => {
    inspection.run!.claude_review = { ...metadata({ verdict: "warning", summary_ko: "관계 맥락 확인", findings: [{ ...finding, needs_professor: false }] } as ReviewResult), provider: "anthropic" };
    inspection.run!.adjudication = metadata({ summary_ko: "지적 수용", decisions: [{ finding_id: finding.id, decision: "accept",
      rationale_ko: "상황문·원문과 대조한 결과 같은 결론에 이르렀습니다.", proposed_change_ko: "해설의 책임 주체를 화자로 맞추십시오.",
      needs_professor: false, evidence_path: finding.where, evidence_quote: finding.quote }] });
    showPanel();
    expect(await screen.findByText("AI 검토 일치")).toBeInTheDocument();
    // 재서술은 지우지 않고 근거 안으로 접는다.
    const details = screen.getByText("검토 의견 전문·근거").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("같은 결론에 이르렀습니다.");
    // 판단에 필요한 제안은 펼치지 않아도 보인다.
    expect(screen.getByText("해설의 책임 주체를 화자로 맞추십시오.")).toBeInTheDocument();
  });
  it("결정 버튼만 누르면 입력 칸 없이 기본 근거로 저장된다", async () => {
    showPanel();
    fireEvent.click(await screen.findByRole("button", { name: `${PROFESSOR_DECISION_LABELS.defer} · claude-1` }));
    fireEvent.click(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · claude-1` }));
    expect(screen.queryByRole("textbox", { name: "교수자 판단 근거 · claude-1" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("review-1", "hash-current", [{ finding_id: "claude-1", decision: "no_change", rationale_ko: "원문·장면에 맞아 이대로 사용합니다." }]), { timeout: 3000 });
  });
  it("allows explicit human approval with primary evidence and keeps extra model review optional", async () => {
    inspection.run!.approval_policy = "focused_v1";
    inspection.run!.claude_review = null;
    inspection.run!.adjudication = null;
    inspection.models.claude = null;
    showPanel();
    const approve = await screen.findByRole("button", { name: "교수자 최종 승인" });
    expect(approve).toBeDisabled();
    expect(mocks.approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    expect(mocks.inspect.mock.calls.every(call => call.length === 1)).toBe(true);
  });
  it.each(["revision_required", "defer"] as const)("preserves rejected Claude findings and saves %s without approval", async (decision) => {
    showPanel();
    await enterDecision(decision);
    expect(screen.getByText("원문 · 화용적 적절성")).toBeInTheDocument();
    expect(screen.getByText(/의견 대조 · 기각/)).toBeInTheDocument();
    expect(screen.getAllByText(/불확실성: 수업에서/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    expect(mocks.save).toHaveBeenCalledWith("review-1", "hash-current", [{ finding_id: "claude-1", decision, rationale_ko: DEFAULT_RATIONALE[decision] }]);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("approves with a recorded default rationale when the professor types nothing", async () => {
    showPanel();
    fireEvent.click(await screen.findByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · claude-1` }));
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    // 승인 근거를 비워 둔 채 확인 체크만 하고 승인한다 — 타이핑 없이 승인이 열려야 한다.
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    const approve = screen.getByRole("button", { name: "교수자 최종 승인" });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(expect.objectContaining({ professorNote: "이 학습 미션을 수업에 사용합니다." })));
  });

  it("requires saved clear decisions and then locks the approved decision", async () => {
    showPanel();
    await enterDecision("no_change");
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "교수자 최종 승인" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    await screen.findByText("교수자 · 수정 없이 사용 가능");
    expect(screen.queryByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · claude-1` })).not.toBeInTheDocument();
    expect(screen.getByText("원문 · 화용적 적절성")).toBeInTheDocument();
  });

  it("does not carry professor decisions into changed content", async () => {
    inspection = { ...inspection, run: { ...inspection.run!, professor_decisions: [{ finding_id: finding.id, decision: "no_change", rationale_ko: rationale }] } };
    showPanel();
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    inspection = { ...inspection, contentHash: "hash-revised", sourceHash: "source-revised", run: null,
      history: [{ id: "review-1", content_hash: "hash-current", approved_at: null, created_at: "2026-08-27" }] };
    fireEvent.click(screen.getByRole("button", { name: "결과 새로고침" }));
    await screen.findByText(/내용이나 점검 기준이 바뀌어 다시 점검이 필요합니다/);
    expect(screen.getByRole("button", { name: "규칙 검사 시작" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · claude-1` })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "교수자 최종 승인" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("requires a separate rationale and confirmation for OpenAI fail even when Claude has no findings", async () => {
    inspection.run!.openai_review = metadata({ verdict: "fail", summary_ko: "중대 지적", findings: [{ ...finding, id: "openai-1", severity: "fail" }] });
    inspection.run!.claude_review!.result = { verdict: "pass", summary_ko: "지적 없음", findings: [] };
    inspection.run!.adjudication!.result.decisions = [];
    showPanel();
    await screen.findByRole("button", { name: "교수자 최종 승인" });
    // Display labels change, while historical model output remains verbatim.
    expect(screen.getByText("중대 지적")).toBeInTheDocument();
    expect(screen.getByText("지적 없음")).toBeInTheDocument();
    expect(screen.getAllByText(/보고된 문제 항목 없음/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "AI 검토의 중대 문제 항목 사용 근거" }), { target: { value: rationale } });
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /AI 검토의 중대 문제 항목을 확인했으며/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    fireEvent.click(screen.getByRole("button", { name: "교수자 최종 승인" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(expect.objectContaining({ openaiFailOverride: rationale })));
    expect(await screen.findByText(`AI 검토의 중대 문제 항목 사용 근거: ${rationale}`)).toBeVisible();
  });
});

describe("automated quality signals", () => {
  const bundleButton = (count: number) => screen.findByRole("button", { name: `미결 자동 품질 점검 신호 ${count}건 확인 · 현재 버전 그대로 사용` });
  const setDecision = (id: string, decision: ProfessorFindingDecision["decision"]) => {
    fireEvent.click(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS[decision]} · ${id}` }));
  };

  it("bundles pending signals in one decision but still blocks approval on the AI finding", async () => {
    withSignals(signal("rule-1", "R30"), signal("rule-2", "R30"), signal("rule-3", "R32"));
    showPanel();
    // 요약은 규칙 번호로 묶어서 보여 준다.
    expect(await screen.findByText(/R30 ×2 · R32 ×1/)).toBeInTheDocument();
    fireEvent.click(await bundleButton(3));
    await screen.findByText("모든 신호에 교수자 결정이 있습니다.");
    // AI 의미 지적이 미결이라 저장도 승인도 되지 않는다.
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText("남은 항목을 판단하면 자동 저장됩니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
  });

  it("approves once the bundled signals and the AI finding are both decided", async () => {
    withSignals(signal("rule-1", "R32"));
    showPanel();
    fireEvent.click(await bundleButton(1));
    await waitFor(() => expect(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · claude-1` })).toBeInTheDocument());
    setDecision("claude-1", "no_change");
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    expect(mocks.save).toHaveBeenLastCalledWith("review-1", "hash-current", [
      { finding_id: "rule-1", decision: "no_change", rationale_ko: BULK_SIGNAL_RATIONALE, mode: "bulk_signal" },
      { finding_id: "claude-1", decision: "no_change", rationale_ko: DEFAULT_RATIONALE.no_change },
    ]);
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    fireEvent.click(screen.getByRole("button", { name: "교수자 최종 승인" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/교수자 · 수정 없이 사용 가능 \(묶음 확인\)/)).toBeInTheDocument();
  });

  it("lets a bundled signal be reopened as an individual decision that blocks approval", async () => {
    withSignals(signal("rule-1", "R30"), signal("rule-2", "R32"));
    showPanel();
    fireEvent.click(await bundleButton(2));
    await screen.findByText("모든 신호에 교수자 결정이 있습니다.");
    setDecision("rule-2", "defer");
    setDecision("claude-1", "no_change");
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.", undefined, { timeout: 3000 });
    // 되돌린 항목은 묶음 표식 없이 개별 판정으로 저장된다.
    expect(mocks.save).toHaveBeenLastCalledWith("review-1", "hash-current", expect.arrayContaining([
      { finding_id: "rule-2", decision: "defer", rationale_ko: DEFAULT_RATIONALE.defer },
    ]));
    fireEvent.click(screen.getByRole("checkbox", { name: "학습자 화면과 품질 점검 결과를 확인했습니다." }));
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("keeps a blocking rule finding out of the bundle", async () => {
    withSignals(signal("rule-1", "R30"), signal("rule-2", "R31", "fail"));
    showPanel();
    fireEvent.click(await screen.findByRole("button", { name: "미결 자동 품질 점검 신호 1건 확인 · 현재 버전 그대로 사용" }));
    await screen.findByText("모든 신호에 교수자 결정이 있습니다.");
    // 계약 위반은 묶이지 않고 개별 판정 자리에 남는다.
    expect(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · rule-2` })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
  });

  it("never overwrites a decision the professor already made", async () => {
    withSignals(signal("rule-1", "R30"), signal("rule-2", "R32"));
    inspection.run!.professor_decisions = [{ finding_id: "rule-1", decision: "defer", rationale_ko: "현장 확인 뒤 판단합니다." }];
    showPanel();
    // 이미 결정된 1건은 대상에서 빠진다.
    fireEvent.click(await screen.findByRole("button", { name: "미결 자동 품질 점검 신호 1건 확인 · 현재 버전 그대로 사용" }));
    await screen.findByText("모든 신호에 교수자 결정이 있습니다.");
    expect(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS.defer} · rule-1` })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: `${PROFESSOR_DECISION_LABELS.no_change} · rule-2` })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("professor approval screen (experiential)", () => {
  function showApprovalScreen() {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ContentReviewPanel target={{ kind: "weekly_material", targetId: "course-1", weekNo: 3 }} experiential /></MemoryRouter>
    </QueryClientProvider>);
  }
  beforeEach(() => {
    inspection.run!.approval_policy = "focused_v1";
    inspection.run!.claude_review = null;
    inspection.run!.adjudication = null;
  });
  it("shows one plain button, no stage names or costs, when automated checks are unfinished", async () => {
    inspection.run!.openai_review = null;
    showApprovalScreen();
    expect(await screen.findByRole("button", { name: "자동 점검 마치기" })).toBeInTheDocument();
    expect(screen.getByText("이 버전은 자동 점검이 아직 끝나지 않았습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /실행 · 유료/ })).toBeNull();
    expect(screen.queryByText(/추가 모델 검토 선택/)).toBeNull();
    expect(screen.queryByText(/유료로 실행/)).toBeNull();
  });
  it("marks checks complete and moves isolated grounding failures out of the main findings", async () => {
    const isolated: ReviewFinding = { id: "generation-1", severity: "warning", where: "", quote: null, issue_ko: "현재 표현 인용이 없습니다: mpj_items[2].corrections[2]",
      reason_ko: "", suggestion_ko: "", problem_type_ko: "critic_grounding_failure", needs_professor: false, uncertainty_ko: "" };
    inspection.run!.openai_review = metadata({ verdict: "warning", summary_ko: "격리", findings: [isolated] } as ReviewResult);
    showApprovalScreen();
    expect(await screen.findByRole("button", { name: "교수자 최종 승인" })).toBeInTheDocument();
    // 최종 승인 화면은 점검 요약 줄을 두지 않는다.
    expect(screen.queryByText("자동 점검 결과")).toBeNull();
    expect(screen.queryByText(/^AI 검토 · /)).toBeNull();
    // 판정에 쓰이지 않는 격리 지적과 세부 추적 정보는 최종 승인 화면에 두지 않는다.
    expect(screen.queryAllByText(isolated.issue_ko)).toHaveLength(0);
    expect(screen.queryByText(/추가 모델 검토 선택/)).toBeNull();
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeInTheDocument();
  });
});
