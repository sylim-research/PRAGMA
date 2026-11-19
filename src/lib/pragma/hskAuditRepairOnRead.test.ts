import { describe, expect, it, vi } from "vitest";
import { repairAuditsOnRead } from "./hskAuditRepairOnRead";
import type { AuditSnapshot } from "./hskAuditSnapshot";

const DICT: Record<string, number> = { 您: 1, 好: 1, 我: 1, 只: 1, 周: 2, 五: 1, 保管: 6, 保: 5, 管: 4 };
const lookup = vi.fn(async (tokens: string[]) =>
  tokens.filter((t) => DICT[t] !== undefined).map((headword) => ({ headword, intro_level: DICT[headword] })));

const snap = (over: Partial<AuditSnapshot>): AuditSnapshot => ({
  status: "complete", direction: "ko_zh", createdAt: "2026-10-02T00:00:00Z", contentKind: "mission",
  title: "택배", learnerLevel: "intermediate", mode: "translation", speechAct: "request", speechActText: null,
  referenceCeiling: 5, distinctTokenCount: 10, matchedTokenCount: 6, candidates: ["您好", "我只", "保管", "助教"],
  rawMatchedTokenCount: null, repairedTokenCount: null, repairedExamples: [], repairSource: null, ...over,
});

describe("repairAuditsOnRead", () => {
  it("repairs v1 records on read without splitting real higher-level headwords", async () => {
    const [out] = await repairAuditsOnRead([snap({})], lookup);
    expect(out.repairSource).toBe("on_read");
    expect(out.rawMatchedTokenCount).toBe(6);
    expect(out.matchedTokenCount).toBe(8);
    expect(out.candidates).toEqual(["保管", "助教"]);
    expect(out.repairedExamples).toEqual(["您好→您+好", "我只→我+只"]);
  });

  it("leaves records alone when the stored candidate list was truncated or already repaired", async () => {
    const truncated = snap({ matchedTokenCount: 2 });
    const stored = snap({ repairSource: "stored", rawMatchedTokenCount: 6, repairedTokenCount: 2 });
    const out = await repairAuditsOnRead([truncated, stored], lookup);
    expect(out[0]).toBe(truncated);
    expect(out[1]).toBe(stored);
  });
});
