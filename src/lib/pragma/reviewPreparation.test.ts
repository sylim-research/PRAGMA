import { describe, expect, it, vi } from "vitest";
import { prepareContentReview } from "./reviewPreparation";
import type { ContentReviewRun, ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const target = { kind: "mission" as const, targetId: "mission-1" };
function inspection(): ReviewInspection {
  return { contentHash: "content-1", sourceHash: "source-1", snapshot: {}, run: null, history: [], dependencies: [], models: { openai: "fixture", claude: "fixture" } };
}
function run(): ContentReviewRun {
  return { id: "run-1", rules: { verdict: "pass", summary_ko: "pass", findings: [] },
    openai_review: null, claude_review: null, adjudication: null, running_stage: null, lease_until: null,
    approved_at: null, professor_decisions: [] } as ContentReviewRun;
}
function requestFor(state: ReviewInspection) {
  return vi.fn(async (_target, action: string) => {
    if (action === "rules") state.run = run();
    if (action === "openai") state.run!.openai_review = { result: { verdict: "pass", findings: [] } } as ContentReviewRun["openai_review"];
    if (action === "claude") state.run!.claude_review = { result: { verdict: "pass", findings: [] } } as ContentReviewRun["claude_review"];
    if (action === "adjudication") state.run!.adjudication = { result: { decisions: [] } } as ContentReviewRun["adjudication"];
    return structuredClone(state);
  });
}
describe("explicit AI review preparation", () => {
  it("adopts current generation evidence without an additional paid call or approval", async () => {
    const state = inspection(); state.run = run(); state.reusableGenerationQuality = null;
    const request = vi.fn(async (_target, action: string) => {
      if (action === "rules") {
        state.run!.approval_policy = "focused_v1";
        state.run!.generation_quality = { mission_content_hash: "a".repeat(64), quality_check: { verdict: "pass", summary_ko: "기존 검사", findings: [], model: "fixture", prompt_version: "fixture", checked_at: "2026-09-06", mission_content_hash: "a".repeat(64) } };
      }
      return structuredClone(state);
    });
    expect((await prepareContentReview(target, { request, stopped: () => false })).status).toBe("ready");
    expect(request.mock.calls.map(call => call[1])).toEqual(["inspect", "rules"]);
    expect(state.run.approved_at).toBeNull();
  });
  it("runs all missing stages once, pins their version, and stops before professor approval", async () => {
    const state = inspection(); const request = requestFor(state);
    const result = await prepareContentReview(target, { request, stopped: () => false });
    expect(result.status).toBe("ready");
    expect(request.mock.calls.map((call) => call[1])).toEqual(["inspect", "rules", "openai", "claude", "adjudication"]);
    for (const call of request.mock.calls.slice(1)) expect(call).toEqual([target, call[1], { contentHash: "content-1", sourceHash: "source-1" }]);
    expect(result.inspection?.run?.approved_at).toBeNull();
    request.mockClear();
    await prepareContentReview(target, { request, stopped: () => false });
    expect(request.mock.calls.map((call) => call[1])).toEqual(["inspect"]);
  });
  it("resumes after saved OpenAI without repeating a paid stage", async () => {
    const state = inspection(); state.run = run();
    const request = requestFor(state); await request(target, "openai"); request.mockClear();
    await prepareContentReview(target, { request, stopped: () => false });
    expect(request.mock.calls.map((call) => call[1])).toEqual(["inspect", "claude", "adjudication"]);
  });
  it.each(["rules", "lease", "model"])("holds %s problems without a paid call", async (problem) => {
    const state = inspection(); state.run = run();
    if (problem === "rules") state.run.rules.verdict = "fail";
    if (problem === "lease") { state.run.running_stage = "openai"; state.run.lease_until = new Date(Date.now() + 60_000).toISOString(); }
    if (problem === "model") { state.models.claude = null; state.run.openai_review = { result: { verdict: "pass", findings: [] } } as ContentReviewRun["openai_review"]; }
    const request = requestFor(state);
    expect((await prepareContentReview(target, { request, stopped: () => false })).status).toBe("held");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not continue or reinitialize a new version returned during a model call", async () => {
    const state = inspection(); state.run = run(); const base = requestFor(state);
    const request = vi.fn(async (...args: Parameters<typeof base>) => {
      const result = await base(...args);
      if (args[1] === "openai") return { ...result, sourceHash: "changed", run: null };
      return result;
    });
    expect((await prepareContentReview(target, { request, stopped: () => false })).status).toBe("held");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not retry a failed provider call", async () => {
    const state = inspection(); state.run = run();
    const request = vi.fn().mockResolvedValueOnce(state).mockRejectedValueOnce(new Error("provider timeout"));
    await expect(prepareContentReview(target, { request, stopped: () => false })).rejects.toThrow("provider timeout");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("honors stop after the in-flight call and guards against a nonadvancing response", async () => {
    const state = inspection(); state.run = run(); let stop = false;
    const request = requestFor(state);
    const result = await prepareContentReview(target, { request, stopped: () => stop, onStage: () => { stop = true; } });
    expect(result.status).toBe("stopped");
    expect(request).toHaveBeenCalledTimes(2);
    const stuck = vi.fn(async () => inspection());
    expect((await prepareContentReview(target, { request: stuck, stopped: () => false })).status).toBe("held");
    expect(stuck).toHaveBeenCalledTimes(2);
  });
});
