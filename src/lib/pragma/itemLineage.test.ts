import { describe, expect, it } from "vitest";

import {
  ITEM_LINEAGE_PENDING_STATUS,
  ITEM_LINEAGE_SCHEMA_VERSION,
  expectedItemLineageTargetPaths,
  validateItemLineage,
  type ItemLineageMissionShape,
} from "./itemLineage";
import { buildMissionLineageScope } from "./missionLineage";
import { normalizeMission } from "./missionSchema";
import { checkMission, type CheckContext } from "./missionRules";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import {
  CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
  CURRENT_MISSION_PROMPT_VERSIONS,
} from "../../../supabase/functions/_shared/contentRelease";

function baseMission(): ItemLineageMissionShape {
  return {
    mpj_items: [
      { type: "scale4", target: "请帮我看一下。", recommended_example: "方便的话，请帮我看一下。" },
      { type: "judge3", target: "可以帮我看一下吗？", recommended_example: "可以帮我看一下吗？" },
      {
        type: "fix_choice",
        target: "你现在看。",
        corrections: [{}, {}, {}, {}],
        recommended_example: "方便的话，可以帮我看一下吗？",
      },
      { type: "reason_conf", target: "麻烦您务必立刻看一下。", recommended_example: "方便的话，麻烦您看一下。" },
      {
        type: "multi_judge",
        candidates: [{}, {}, {}, {}, {}],
        recommended_example: "您方便的时候帮我看一下，可以吗？",
      },
    ],
    production_task: { reference_alternatives: [{}] },
  };
}

function coveredMission(): ItemLineageMissionShape {
  const mission = baseMission();
  const scope = buildMissionLineageScope({
    direction: "ko_zh",
    speechAct: "request",
    targetFeature: "request_mitigation_optionality",
  });
  const rule = scope.rules[0];
  mission.item_lineage = {
    schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
    claim_status: ITEM_LINEAGE_PENDING_STATUS,
    realization_pack_id: scope.realization_pack_id!,
    realization_pack_version: scope.realization_pack_version!,
    claims: expectedItemLineageTargetPaths(mission).map((targetPath, index) => ({
      claim_id: `ILC-${String(index + 1).padStart(3, "0")}`,
      target_path: targetPath,
      attribution_status: "model_claimed",
      rule_ids: [rule.rule_id],
      risk_ids: [],
      evidence_ids: [...rule.evidence_ids].sort(),
      note_ko: "요청 완화 자원을 사용했다는 모델 주장",
    })),
  };
  return mission;
}

describe("item-level realization lineage", () => {
  const scope = buildMissionLineageScope({
    direction: "ko_zh",
    speechAct: "request",
    targetFeature: "request_mitigation_optionality",
  });

  it("covers all 19 target, correction, candidate, recommendation, and reference paths", () => {
    const mission = coveredMission();
    expect(expectedItemLineageTargetPaths(mission)).toHaveLength(19);
    expect(validateItemLineage(mission, scope)).toEqual([]);
    expect(mission.item_lineage?.claim_status).toBe("model_claimed_pending_review");
  });

  it("rejects a missing target path and a cross-act rule instead of treating claims as verified", () => {
    const mission = coveredMission();
    mission.item_lineage!.claims.pop();
    mission.item_lineage!.claims[0] = {
      ...mission.item_lineage!.claims[0],
      rule_ids: ["RR-KOZH-REF-HEDGE"],
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL"],
    };
    const issues = validateItemLineage(mission, scope);
    expect(issues.some((issue) => issue.code === "missing_target_path")).toBe(true);
    expect(issues.some((issue) => issue.code === "unknown_rule_id")).toBe(true);
    expect(issues.some((issue) => issue.code === "evidence_mismatch")).toBe(true);
  });

  it("does not attach the ko→zh pack outside the audited direction", () => {
    const uncoveredScope = buildMissionLineageScope({
      direction: "zh_ko",
      speechAct: "request",
      targetFeature: "request_mitigation_optionality",
    });
    expect(validateItemLineage(baseMission(), uncoveredScope)).toEqual([]);
    expect(validateItemLineage(coveredMission(), uncoveredScope)[0]?.code).toBe("unexpected_lineage");
  });

  it("preserves pending lineage without claiming that mission v5 already hard-gates attribution", () => {
    const mission = normalizeMission(SAMPLE_MISSION_V1).data!;
    const context: CheckContext = {
      speech_act: "request",
      level: "intermediate",
      domain: "work",
      theme_code: "career_workplace",
      topic_code: "schedule_change",
      mode: "translation",
      source_modality: "written",
      direction: "ko_zh",
    };
    const rule = scope.rules[0];
    const targetPaths = expectedItemLineageTargetPaths(mission);
    mission.item_lineage = {
      schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
      claim_status: "model_attribution_pending_review",
      realization_pack_id: scope.realization_pack_id!,
      realization_pack_version: scope.realization_pack_version!,
      attribution_provenance: {
        provider: "openai",
        model: "test-attributor",
        prompt_version: "item_lineage_attribution_v2",
        prompt_instance_hash: "attribution-prompt-instance",
        attribution_attempts: 1,
        batch_count: 1,
        calls: [{
          batch_index: 1,
          target_count: targetPaths.length,
          model: "test-attributor",
          prompt_instance_hash: "attribution-batch-prompt-instance",
          attempts: 1,
        }],
        attributed_at: "2026-08-14T00:00:01Z",
      },
      coverage_summary: {
        total_count: targetPaths.length,
        claimed_count: targetPaths.length,
        unattributed_count: 0,
      },
      claims: targetPaths.map((targetPath, index) => ({
        claim_id: `ILC-${String(index + 1).padStart(3, "0")}`,
        target_path: targetPath,
        attribution_status: "model_claimed",
        rule_ids: [rule.rule_id],
        risk_ids: [],
        evidence_ids: [...rule.evidence_ids].sort(),
        note_ko: "테스트용 모델 주장",
      })),
    };
    const reparsed = normalizeMission(mission);
    expect(reparsed.ok).toBe(true);
    expect(reparsed.data?.item_lineage).toEqual(mission.item_lineage);
    expect(checkMission(mission, context).violations.some((violation) => violation.id === "R27")).toBe(false);
  });

  it("hard-gates current covered mission_v5 while preserving legacy v5 readability", () => {
    const context: CheckContext = {
      speech_act: "request",
      level: "intermediate",
      domain: "work",
      theme_code: "career_workplace",
      topic_code: "work_delivery_address_change",
      mode: "translation",
      source_modality: "written",
      direction: "ko_zh",
    };
    expect(checkMission(SAMPLE_MISSION_V5, context).violations.some((violation) => violation.id === "R31")).toBe(false);

    const current = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    current.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    expect(checkMission(current, context).violations.some((violation) => violation.id === "R31" && violation.level === "fail")).toBe(true);

    current.authoring = {
      schema_version: "mission_authoring_v1",
      stage: "ai_draft",
      lineage_status: "pending",
      repair_attempts: 0,
    };
    expect(checkMission(current, context).violations.filter((violation) => violation.id === "R31")).toEqual([]);

    current.authoring = {
      ...current.authoring,
      stage: "professor_finalized",
      lineage_status: "complete",
    };

    const paths = expectedItemLineageTargetPaths(current);
    const rule = scope.rules[0];
    current.item_lineage = {
      schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
      claim_status: "model_attribution_pending_review",
      realization_pack_id: scope.realization_pack_id!,
      realization_pack_version: scope.realization_pack_version!,
      attribution_provenance: {
        provider: "openai",
        model: "test-attributor",
        prompt_version: CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
        prompt_instance_hash: "a".repeat(64),
        attribution_attempts: 4,
        batch_count: Math.ceil(paths.length / 5),
        calls: Array.from({ length: Math.ceil(paths.length / 5) }, (_, index) => Math.min(5, paths.length - index * 5)).map((targetCount, index) => ({
          batch_index: index + 1,
          target_count: targetCount,
          model: "test-attributor",
          prompt_instance_hash: String(index + 1).repeat(64),
          attempts: 1,
        })),
        attributed_at: "2026-08-15T00:00:01Z",
      },
      coverage_summary: {
        total_count: paths.length,
        claimed_count: paths.length,
        unattributed_count: 0,
      },
      claims: paths.map((targetPath, index) => ({
        claim_id: `ILC-${String(index + 1).padStart(3, "0")}`,
        target_path: targetPath,
        attribution_status: "model_claimed",
        rule_ids: [rule.rule_id],
        risk_ids: [],
        evidence_ids: [...rule.evidence_ids].sort(),
        note_ko: "테스트용 모델 귀속 주장",
      })),
    };
    expect(checkMission(current, context).violations.filter((violation) => violation.id === "R31")).toEqual([]);

    current.item_lineage.claims[0] = {
      ...current.item_lineage.claims[0],
      attribution_status: "model_unattributed",
      rule_ids: [],
      risk_ids: [],
      evidence_ids: [],
      note_ko: "허용 근거에 귀속하지 못한 테스트 주장",
    };
    current.item_lineage.coverage_summary = {
      total_count: paths.length,
      claimed_count: paths.length - 1,
      unattributed_count: 1,
    };
    const withUnattributed = checkMission(current, context).violations;
    expect(withUnattributed.filter((violation) => violation.id === "R31")).toEqual([]);
    expect(withUnattributed.some(
      (violation) => violation.id === "R32" && violation.level === "warning",
    )).toBe(true);

    // 2026-09-09 연구자 결정: 참조 상한(20%) 초과도 구조 모순이 아니므로 R31 fail이 아니라
    // R32 warning(subrule unattributed_over_reference_ratio)으로 교수자 확인에 넘긴다.
    current.item_lineage.claims = current.item_lineage.claims.map((claim) => ({
      ...claim,
      attribution_status: "model_unattributed",
      rule_ids: [],
      risk_ids: [],
      evidence_ids: [],
    }));
    current.item_lineage.coverage_summary = {
      total_count: paths.length,
      claimed_count: 0,
      unattributed_count: paths.length,
    };
    const overRatio = checkMission(current, context).violations;
    expect(overRatio.filter((violation) => violation.id === "R31")).toEqual([]);
    expect(overRatio.some(
      (violation) => violation.id === "R32" && violation.level === "warning" &&
        violation.evidence?.subrule === "unattributed_over_reference_ratio",
    )).toBe(true);
  });
});
