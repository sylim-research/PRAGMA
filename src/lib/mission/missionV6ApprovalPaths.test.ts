// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "./missionV6Sample";
import { SAMPLE_MISSION_V5_NATIVE } from "./missionV4Sample";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
import { fetchMissionForReview } from "./missionDb";
import { reviewMission, type PromotableCore } from "@/lib/pragma/promoteMission";
import { listCoreScenarios } from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";

function query(data: unknown, paged = false) {
  const q: Record<string, any> = {};
  for (const name of ["select", "eq", "is", "order"]) q[name] = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  q.range = vi.fn().mockResolvedValue({ data: paged ? data : [], error: null });
  from.mockReturnValue(q);
  return q;
}
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ error: null }); });

describe("normal v6 approval entry points", () => {
  it("loads v6 only for opted-in review callers and preserves the v5 parser", async () => {
    query({ mission_content: SAMPLE_MISSION_V6_REASON_CONTRAST, mission_status: "generated" });
    await expect(fetchMissionForReview("scenario", { includeV6: true })).resolves.toMatchObject({
      mission: { schema_version: "mission_v6" }, mission_status: "generated" });
    await expect(fetchMissionForReview("scenario")).rejects.toThrow("스키마 불일치");
    query({ mission_content: SAMPLE_MISSION_V5_NATIVE, mission_status: "reviewed" });
    const legacy = await fetchMissionForReview("scenario");
    expect(await fetchMissionForReview("scenario", { includeV6: true })).toEqual(legacy);
  });
  it("passes the exact prepared v6 artifact to the existing approval RPC", async () => {
    const artifact = { ...structuredClone(SAMPLE_MISSION_V6_REASON_CONTRAST),
      authoring: { schema_version: "mission_authoring_v1", stage: "professor_finalized", lineage_status: "complete",
        repair_attempts: 0, item_lineage_coverage: "not_covered" } };
    const q = query({ prepared_finalization: artifact });
    const approval = { reviewId: "review", contentHash: "a".repeat(64), professorNote: "현재 콘텐츠와 검수 결과를 확인한 fixture 승인" };
    const result = await reviewMission({ scenario_id: "scenario" } as PromotableCore, [], approval);
    expect(result.ok).toBe(true);
    expect(q.eq).toHaveBeenCalledWith("content_hash", approval.contentHash);
    expect(q.is).toHaveBeenCalledWith("superseded_by", null);
    expect(rpc).toHaveBeenCalledWith("finalize_reviewed_mission", expect.objectContaining({
      p_scenario_id: "scenario", p_payload: expect.objectContaining({ mission_content: artifact, review_id: "review" }) }));
    expect(rpc.mock.calls[0][1].p_payload.mission_content).toBe(artifact);
  });
  it("still blocks approval without a current prepared artifact", async () => {
    query(null);
    expect((await reviewMission({ scenario_id: "scenario" } as PromotableCore, [],
      { reviewId: "review", contentHash: "a".repeat(64), professorNote: "fixture" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("exposes complete v6 composition candidates without granting generated missions release eligibility", async () => {
    const row = (version: string, count: number, status: string) => ({
      scenario_id: `${version}-${count}-${status}`, speech_act: "request", learner_level: "intermediate",
      mode: "translation", source_modality: "written", mission_schema_version: version,
      mission_mpj_items: Array.from({length: count}, () => ({})), mission_status: status,
      core_content: { generation: { content_release_id: CURRENT_CONTENT_RELEASE_ID } } });
    query([row("mission_v5", 5, "reviewed"), row("mission_v6", 5, "reviewed"),
      row("mission_v6", 5, "generated"), row("mission_v5", 4, "reviewed"), row("mission_v7", 5, "reviewed")], true);
    const candidates = await listCoreScenarios();
    expect(candidates.map(c => c.is_native_mpj5)).toEqual([true, true, true, false, false]);
    expect(candidates.filter(c => c.is_native_mpj5 && isReviewedMission(c)).map(c => c.scenario_id))
      .toEqual(["mission_v5-5-reviewed", "mission_v6-5-reviewed"]);
  });
});

