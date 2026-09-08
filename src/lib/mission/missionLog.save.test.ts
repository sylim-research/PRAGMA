import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MISSION_V5_NATIVE } from "./missionV4Sample";
import { saveMissionAttempt } from "./missionLog";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from },
}));

const input = {
  mission: SAMPLE_MISSION_V5_NATIVE,
  scenarioId: "f8de3f59-cd86-4636-b516-a8ead78ac0ac",
  speechAct: "request", level: "intermediate",
  firstResponse: "请帮我收一下快递。", revisedResponse: "如果方便，能帮我收一下快递吗？",
  startedAtIso: "2026-09-08T00:00:00Z",
};
const logId = "e9c87265-20b8-4f7b-93c5-c3c55d641b95";
function query(result: unknown) {
  const q = { select: vi.fn(), eq: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.insert.mockReturnValue(q);
  return q;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "own-user" } } } });
  mocks.from.mockReturnValueOnce(query({ data: { id: "own-profile" }, error: null }));
});

describe("completion save retry", () => {
  it("uses the same supplied row ID after a lost response", async () => {
    const write = query({ data: null, error: { message: "Failed to fetch" } });
    mocks.from.mockReturnValueOnce(write);
    expect(await saveMissionAttempt(input, logId)).toMatchObject({ ok: false });
    const retry = query({ data: { id: logId }, error: null });
    mocks.from.mockReturnValueOnce(query({ data: { id: "own-profile" } })).mockReturnValueOnce(retry);
    expect(await saveMissionAttempt(input, logId)).toEqual({ ok: true, id: logId });
    for (const q of [write, retry]) {
      expect(q.insert).toHaveBeenCalledWith(expect.objectContaining({
        id: logId, auth_user_id: "own-user", first_response: input.firstResponse, revised_response: input.revisedResponse,
      }));
    }
  });

  it("recovers an already committed row without updating or duplicating it", async () => {
    mocks.from.mockReturnValueOnce(query({ data: null, error: { code: "23505" } }));
    const lookup = query({ data: { id: logId }, error: null });
    mocks.from.mockReturnValueOnce(lookup);
    expect(await saveMissionAttempt(input, logId)).toEqual({ ok: true, id: logId });
    expect(lookup.eq.mock.calls).toEqual([
      ["id", logId], ["auth_user_id", "own-user"], ["mission_id", input.scenarioId],
      ["first_response", input.firstResponse], ["revised_response", input.revisedResponse],
    ]);
    expect(lookup.insert).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "lookup failed" } },
  ])("keeps an unrelated conflict or failed lookup as a save failure: %j", async (result) => {
    mocks.from.mockReturnValueOnce(query({ data: null, error: { code: "23505", message: "conflict" } }))
      .mockReturnValueOnce(query(result));
    expect(await saveMissionAttempt(input, logId)).toMatchObject({ ok: false, reason: "error" });
  });
});
