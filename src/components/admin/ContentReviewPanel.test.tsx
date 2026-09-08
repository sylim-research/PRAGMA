import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentReviewPanel } from "./ContentReviewPanel";
import { CONTENT_REVIEW_VERSION, type ModelReview, type ProfessorFindingDecision, type ReviewInspection, type ReviewResult } from "../../../supabase/functions/_shared/contentReview";

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), save: vi.fn(), approve: vi.fn() }));
vi.mock("@/lib/pragma/contentReviewApi", () => ({ contentReviewRequest: mocks.inspect, saveProfessorDecisions: mocks.save, approveContentReview: mocks.approve }));

const finding = { id: "claude-1", severity: "warning" as const, where: "/content/source", quote: "请您参加活动。",
  issue_ko: "초대의 선택권 확인", reason_ko: "참여 여부를 선택할 수 있는 상황인지 확인", suggestion_ko: "관계 맥락 확인",
  problem_type_ko: "화용적 적절성", needs_professor: true, uncertainty_ko: "수업에서 가정하는 관계에 따라 달라짐" };
const rationale = "행사 참여가 자율적인 상황임을 확인했습니다.";
const metadata = <T,>(result: T): ModelReview<T> => ({ result, provider: "openai", model: "fixture-model", requested_model: "fixture-model",
  response_id: "fixture", usage: {}, checked_at: "2026-08-27", prompt_version: CONTENT_REVIEW_VERSION, input_hash: "input" });
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

function showPanel() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ContentReviewPanel target={{ kind: "mission", targetId: "mission-1" }} /></MemoryRouter>
  </QueryClientProvider>);
}
async function enterDecision(decision: ProfessorFindingDecision["decision"]) {
  fireEvent.change(await screen.findByRole("combobox", { name: "교수자 결정 · claude-1" }), { target: { value: decision } });
  fireEvent.change(screen.getByRole("textbox", { name: "교수자 판단 근거 · claude-1" }), { target: { value: rationale } });
  fireEvent.change(screen.getByRole("textbox", { name: "교수자 승인 근거" }), { target: { value: "원본과 양쪽 의견을 확인하여 수업 사용을 판단함" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("professor finding decisions", () => {
  it("allows explicit human approval with primary evidence and keeps extra model review optional", async () => {
    inspection.run!.approval_policy = "focused_v1";
    inspection.run!.claude_review = null;
    inspection.run!.adjudication = null;
    inspection.models.claude = null;
    showPanel();
    const approve = await screen.findByRole("button", { name: "교수자 최종 승인" });
    expect(approve).toBeDisabled();
    expect(mocks.approve).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "교수자 승인 근거" }), { target: { value: rationale } });
    fireEvent.click(screen.getByRole("checkbox", { name: "현재 원본과 저장된 품질점검·미해결 쟁점을 확인했습니다." }));
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    expect(mocks.inspect.mock.calls.every(call => call.length === 1)).toBe(true);
  });
  it.each(["revision_required", "defer"] as const)("preserves rejected Claude findings and saves %s without approval", async (decision) => {
    showPanel();
    await enterDecision(decision);
    expect(screen.getByText("AI 독립 검토 · 초대의 선택권 확인")).toBeInTheDocument();
    expect(screen.getByText(/AI 재검토 · 기각/)).toBeInTheDocument();
    expect(screen.getAllByText(/불확실성: 수업에서/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "교수자 판단 저장 · 무료" }));
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.");
    expect(mocks.save).toHaveBeenCalledWith("review-1", "hash-current", [{ finding_id: "claude-1", decision, rationale_ko: rationale }]);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("requires saved clear decisions and then locks the approved decision", async () => {
    showPanel();
    await enterDecision("no_change");
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "교수자 판단 저장 · 무료" }));
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "교수자 최종 승인" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    await screen.findByText("교수자 · 수정 없이 사용 가능");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("AI 독립 검토 · 초대의 선택권 확인")).toBeInTheDocument();
  });

  it("does not carry professor decisions into changed content", async () => {
    inspection = { ...inspection, run: { ...inspection.run!, professor_decisions: [{ finding_id: finding.id, decision: "no_change", rationale_ko: rationale }] } };
    showPanel();
    await screen.findByText("교수자 판단이 현재 버전에 저장되어 있습니다.");
    inspection = { ...inspection, contentHash: "hash-revised", sourceHash: "source-revised", run: null,
      history: [{ id: "review-1", content_hash: "hash-current", approved_at: null, created_at: "2026-08-27" }] };
    fireEvent.click(screen.getByRole("button", { name: "결과 새로고침" }));
    await screen.findByText(/내용 또는 기준이 달라져 재검토가 필요합니다/);
    expect(screen.getByRole("button", { name: "규칙 검사 시작 · 무료" })).toBeEnabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "교수자 최종 승인" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("requires a separate rationale and confirmation for OpenAI fail even when Claude has no findings", async () => {
    inspection.run!.openai_review = metadata({ verdict: "fail", summary_ko: "중대 지적", findings: [{ ...finding, id: "openai-1", severity: "fail" }] });
    inspection.run!.claude_review!.result = { verdict: "pass", summary_ko: "지적 없음", findings: [] };
    inspection.run!.adjudication!.result.decisions = [];
    showPanel();
    fireEvent.change(await screen.findByRole("textbox", { name: "교수자 승인 근거" }), { target: { value: rationale } });
    // Display labels change, while historical model output remains verbatim.
    expect(screen.getByText("중대 지적")).toBeInTheDocument();
    expect(screen.getByText("지적 없음")).toBeInTheDocument();
    expect(screen.getAllByText(/보고된 문제 항목 없음/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "현재 원본과 저장된 품질점검·미해결 쟁점을 확인했습니다." }));
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "AI 검토의 중대 문제 항목 사용 근거" }), { target: { value: rationale } });
    expect(screen.getByRole("button", { name: "교수자 최종 승인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /AI 검토의 중대 문제 항목을 확인했으며/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "현재 원본과 저장된 품질점검·미해결 쟁점을 확인했습니다." }));
    fireEvent.click(screen.getByRole("button", { name: "교수자 최종 승인" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(expect.objectContaining({ openaiFailOverride: rationale })));
    expect(await screen.findByText(`AI 검토의 중대 문제 항목 사용 근거: ${rationale}`)).toBeVisible();
  });
});
