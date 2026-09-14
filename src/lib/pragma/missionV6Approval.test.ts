import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MissionV6Schema, type MissionV6 } from "./missionV6";
import { MissionV5NativeSchema, normalizeMission } from "./missionSchema";
import { checkMission, type CheckContext } from "./missionRules";
import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildContentReviewDomain } from "./contentReviewDomain";
import { viewModelFromReview } from "./instructorExperience";
import { buildMissionLineageScope } from "./missionLineage";
import { expectedItemLineageTargetPaths } from "./itemLineage";
import { CURRENT_ITEM_LINEAGE_PROMPT_VERSION } from "../../../supabase/functions/_shared/contentRelease";
import { instructionalMission, reviewHash, type ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const at = "2026-09-14T00:00:00.000Z";
const ctx: CheckContext = { speech_act: "request", level: "intermediate", domain: "work",
  theme_code: "career_workplace", topic_code: "schedule_change", mode: "translation",
  source_modality: "written", direction: "ko_zh", planned_target_feature: "request_mitigation_optionality" };
function draft(): MissionV6 {
  return { ...structuredClone(SAMPLE_MISSION_V6_REASON_CONTRAST),
    authoring: { schema_version: "mission_authoring_v1", stage: "ai_draft", lineage_status: "pending", repair_attempts: 0 },
    quality_check: { verdict: "pass", findings: [], summary_ko: "test fixture", model: "fixture", prompt_version: "fixture", checked_at: at },
    provenance: { model: "fixture", prompt_version: "v6-fixture", generation_attempt: 1,
      generated_at: at, mission_content_hash: "a".repeat(64) } };
}
function finalized(): MissionV6 {
  const m = draft();
  const scope = buildMissionLineageScope({ direction: "ko_zh", speechAct: "request", targetFeature: ctx.planned_target_feature! });
  const paths = expectedItemLineageTargetPaths(m);
  const calls = Array.from({ length: Math.ceil(paths.length / 5) }, (_, i) => ({
    batch_index: i + 1, target_count: Math.min(5, paths.length - i * 5),
    model: "fixture", prompt_instance_hash: "fixture", attempts: 1 }));
  m.authoring = { ...m.authoring, stage: "professor_finalized", lineage_status: "complete" };
  m.hsk_lexical_audit = { status: "complete", policy_version: "fixture", source_id: "fixture", direction: "ko_zh",
    scope: "zh_target_mission", reference_ceiling: 4, distinct_token_count: 1, matched_token_count: 1,
    coverage_ratio: 1, out_of_reference_candidates: [], non_blocking: true, note: "fixture" };
  m.item_lineage = { schema_version: "mission_item_lineage_v1", claim_status: "model_attribution_pending_review",
    realization_pack_id: scope.realization_pack_id!, realization_pack_version: scope.realization_pack_version!,
    attribution_provenance: { provider: "fixture", model: "fixture", prompt_version: CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
      prompt_instance_hash: "fixture", attribution_attempts: 1, batch_count: calls.length, calls, attributed_at: at },
    coverage_summary: { total_count: paths.length, claimed_count: 0, unattributed_count: paths.length },
    claims: paths.map((target_path, i) => ({ claim_id: `claim-${i}`, target_path, attribution_status: "model_unattributed",
      rule_ids: [], risk_ids: [], evidence_ids: [], note_ko: "실제 근거 귀속 주장을 하지 않는 검사 fixture" })) };
  return m;
}
const domain = (m: MissionV6) => buildContentReviewDomain("mission", { scenario: {
  speech_act: ctx.speech_act, learner_level: ctx.level, mode: ctx.mode, source_modality: ctx.source_modality,
  domain: ctx.domain, theme_code: ctx.theme_code, topic_code: ctx.topic_code, mission_content: m } });

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("v6 normal approval compatibility", () => {
  it("reuses all four metadata contracts without requiring them on old v6 checkpoints", () => {
    expect(MissionV6Schema.safeParse(SAMPLE_MISSION_V6_REASON_CONTRAST).success).toBe(true);
    const m = finalized();
    const parsed = MissionV6Schema.parse(m);
    for (const key of ["authoring", "quality_check", "hsk_lexical_audit", "item_lineage"] as const) {
      expect(parsed[key]).toEqual(MissionV5NativeSchema.shape[key].parse(m[key]));
      expect(MissionV6Schema.safeParse({ ...m, [key]: "invalid" }).success).toBe(false);
    }
    expect(MissionV6Schema.safeParse({ ...m, invented_metadata: {} }).success).toBe(false);
  });
  it("checks the adopted structure without imposing v5 polarity, band counts or a unique suitable correction", () => {
    const m = draft();
    m.mpj_items[2].corrections.forEach(c => { c.is_valid = true; });
    m.mpj_items[4].candidates.forEach(c => { c.accepted_band_codes = ["appropriate"]; });
    expect(checkMission(m, ctx).ok).toBe(true);
    expect(checkMission({ ...m, mpj_items: m.mpj_items.slice(0, 4) }, ctx).ok).toBe(false);
    expect(checkMission({ ...m, mpj_items: m.mpj_items.map(i => i.id === 3 ? { ...i, corrections: [] } : i) }, ctx).ok).toBe(false);
  });
  it("retains direction, speech act, mode and provenance approval checks", () => {
    for (const context of [{ ...ctx, direction: "zh_ko" as const }, { ...ctx, speech_act: "apology" as const },
      { ...ctx, mode: "stt_interpreting" as const, source_modality: "spoken" as const }]) {
      expect(checkMission(draft(), context).ok).toBe(false);
    }
    const m = draft(); delete m.provenance;
    expect(checkMission(m, ctx).violations).toContainEqual(expect.objectContaining({ id: "R20", level: "fail" }));
  });
  it("requires genuine in-scope lineage at finalization and preserves unattributed review signals", () => {
    const m = finalized();
    expect(checkMission(m, ctx).ok).toBe(true);
    expect(checkMission(m, ctx).violations).toContainEqual(expect.objectContaining({ id: "R32", level: "warning" }));
    const missing = structuredClone(m); delete missing.item_lineage;
    expect(checkMission(missing, ctx).ok).toBe(false);
    const wrong = structuredClone(m); wrong.item_lineage.claims[0].rule_ids = ["invented"];
    expect(checkMission(wrong, ctx).ok).toBe(false);
  });
  it("keeps instructional hashes stable across finalization and sensitive to Reason/Contrast", async () => {
    const before = domain(draft()); const after = domain(finalized());
    expect(before.rules.verdict).not.toBe("fail");
    expect(after.rules.verdict).not.toBe("fail");
    expect(await reviewHash(before.snapshot)).toBe(await reviewHash(after.snapshot));
    const changed = draft(); changed.mpj_items[1].reason_choice.options[0].text += "변경";
    expect(await reviewHash(domain(changed).snapshot)).not.toBe(await reviewHash(before.snapshot));
    const contrast = draft(); contrast.mpj_items[3].contrast.target += "。";
    expect(await reviewHash(domain(contrast).snapshot)).not.toBe(await reviewHash(before.snapshot));
    expect(before.snapshot.criteria.mission_design).toContain("정답 이유·설명 능력 점수");
    expect(viewModelFromReview({ snapshot: before.snapshot } as unknown as ReviewInspection).quests).toHaveLength(7);
  });
  it("preserves v5 normalization and review criteria", () => {
    const original = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const result = buildContentReviewDomain("mission", { scenario: { speech_act: "request", learner_level: "intermediate",
      mode: "translation", source_modality: "written", mission_content: original } });
    expect(result.snapshot.criteria.rules_version).toBe("mission_rules_v13_professor_signal_flow");
    expect(result.snapshot.criteria.mission_design).toContain("X→A→A→A→Y→C");
    expect(normalizeMission(original)).toEqual(normalizeMission(SAMPLE_MISSION_V5_NATIVE));
    expect(instructionalMission(original)).toEqual(instructionalMission(SAMPLE_MISSION_V5_NATIVE));
  });
});

