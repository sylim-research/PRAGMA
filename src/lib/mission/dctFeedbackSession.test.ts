import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createDctFeedbackSession } from "./dctFeedbackSession";
import { requestFeedback, type FeedbackRequestResult } from "./missionFeedback";

vi.mock("./missionFeedback", () => ({ requestFeedback: vi.fn() }));
const mission = {} as Parameters<typeof requestFeedback>[0];
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });

describe("DCT feedback call budget", () => {
  it("shares in-flight requests, keeps A/B provenance and never calls a third time", async () => {
    let finish!: (value: FeedbackRequestResult) => void;
    vi.mocked(requestFeedback).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ ok: false, error: "second failed" });
    const session = createDctFeedbackSession("attempt-1");
    const a = session.request(1, mission, "A");
    expect(session.request(1, mission, "A")).toBe(a);
    await Promise.resolve();
    finish({ ok: false, error: "first failed" });
    await a;
    await session.request(2, mission, "A");
    expect(requestFeedback).toHaveBeenCalledTimes(1);
    await session.request(2, mission, "B");
    await session.request(2, mission, "B");
    await session.request(2, mission, "C");
    await session.request(3 as 2, mission, "C");
    expect(requestFeedback).toHaveBeenCalledTimes(2);
    expect(vi.mocked(requestFeedback).mock.calls.map(call => call[1])).toEqual(["A", "B"]);
    expect(session.snapshot().map(({ round, answer, result }) => [round, answer, result.error]))
      .toEqual([[1, "A", "first failed"], [2, "B", "second failed"]]);
    const reloaded = createDctFeedbackSession("attempt-1");
    await reloaded.request(1, mission, "A");
    await reloaded.request(2, mission, "B");
    expect(requestFeedback).toHaveBeenCalledTimes(2);
  });

  it("does not retry an interrupted request after reload or a thrown transport error", async () => {
    vi.mocked(requestFeedback).mockRejectedValue(new Error("offline"));
    sessionStorage.setItem("interrupted", JSON.stringify({ 1: { answer: "A" } }));
    const session = createDctFeedbackSession("interrupted");
    expect((await session.request(1, mission, "A")).ok).toBe(false);
    expect(requestFeedback).not.toHaveBeenCalled();
    expect((await session.request(2, mission, "B")).ok).toBe(false);
    await session.request(2, mission, "B");
    expect(requestFeedback).toHaveBeenCalledTimes(1);
  });

  it.each([400, 404])("keeps provider fallback after HTTP %s inside the same learner feedback round", async status => {
    const edge = readFileSync("supabase/functions/generate-scenario/index.ts", "utf8");
    const action = edge.split("if (input.action === 'feedback') {")[1].split("// ──")[0];
    // Deno 엔트리 전체나 유료 API 대신 실제 action의 호출 구간을 mock 공급자로 실행한다.
    const calls = action.slice(action.indexOf("let model = FEEDBACK_PRIMARY_MODEL"), action.indexOf("      if (!att.ok) {"));
    expect(edge).toContain("const FEEDBACK_FALLBACK_MODEL = OPENAI_MODEL_ROUTES.feedback.fallback");
    const callOpenAI = vi.fn(async (model: string, _key: string, _sys: string, _usr: string, _temp: number, _options: unknown) =>
      model === "primary" ? { ok: false, status, raw: "model unavailable" } : { ok: true, status: 200, raw: "feedback" });
    const telemetryFor = (_operation: string, _billable: boolean, context: object) => context;
    const dependencies = { callOpenAI, FEEDBACK_PRIMARY_MODEL: "primary", FEEDBACK_FALLBACK_MODEL: "fallback",
      apiKey: "mock", sys: "unchanged system prompt", FEEDBACK_MAX_COMPLETION_TOKENS: 1200,
      telemetryFor, feedbackPromptVersion: "unchanged" };
    const runProviderCalls = new Function(...Object.keys(dependencies), "usr", `return (async () => { ${calls}; return { model, att }; })();`);
    vi.mocked(requestFeedback).mockImplementation(async (_mission, answer) => {
      const { model, att } = await runProviderCalls(...Object.values(dependencies), answer);
      expect(model).toBe("fallback");
      return { ok: att.ok };
    });
    const session = createDctFeedbackSession(`fallback-${status}`);
    expect((await session.request(1, mission, "A")).ok).toBe(true);
    expect(requestFeedback).toHaveBeenCalledTimes(1);
    expect(callOpenAI).toHaveBeenCalledTimes(2);
    expect(session.snapshot().map(({ round, answer }) => [round, answer])).toEqual([[1, "A"]]);
    expect((await session.request(2, mission, "B")).ok).toBe(true);
    await session.request(2, mission, "B");
    await session.request(3 as 2, mission, "C");
    expect(requestFeedback).toHaveBeenCalledTimes(2);
    expect(callOpenAI.mock.calls.map(([model, , , answer]) => [model, answer])).toEqual([
      ["primary", "A"], ["fallback", "A"], ["primary", "B"], ["fallback", "B"],
    ]);
    expect(callOpenAI.mock.calls[3][5]).toMatchObject({ telemetry: {
      invocationAttempt: 2, isModelFallback: true, fallbackFrom: "primary", promptVersion: "unchanged",
    } });
    expect(session.snapshot().map(({ round, answer }) => [round, answer])).toEqual([[1, "A"], [2, "B"]]);
  });
});
