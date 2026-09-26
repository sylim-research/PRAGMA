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

  it("keeps the feedback endpoint to one provider invocation per round", () => {
    const edge = readFileSync("supabase/functions/generate-scenario/index.ts", "utf8");
    const action = edge.split("if (input.action === 'feedback') {")[1].split("// ──")[0];
    expect(action.match(/await callOpenAI\(/g)).toHaveLength(1);
    expect(action).not.toContain("FEEDBACK_FALLBACK_MODEL");
  });
});
