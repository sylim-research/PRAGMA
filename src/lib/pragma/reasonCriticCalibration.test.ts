import { describe, expect, it } from "vitest";
import { calibrateReasonSeverity, REASON_BRANCHES } from "../../../supabase/functions/_shared/reasonCriticCalibration";
import { MISSION_CONSISTENCY_RESPONSE_FORMAT } from "../../../supabase/functions/_shared/missionConsistency";

describe("primary_reason_ambiguity severity follows the critic's ⑨ branch", () => {
  it("keeps real reason defects as fail regardless of the reported severity", () => {
    for (const branch of ["false_premise", "paraphrase_of_primary", "competing_clear", "primary_off_focus", "not_a_reason"]) {
      expect(calibrateReasonSeverity("fail", branch)).toEqual({ severity: "fail", prefix: "" });
      expect(calibrateReasonSeverity("warning", branch)).toEqual({ severity: "fail", prefix: "" });
    }
  });

  it("does not let a secondary distractor surface as a content fail", () => {
    expect(calibrateReasonSeverity("fail", "secondary")).toEqual({ severity: "warning", prefix: "[critic_reason_secondary_calibrated] " });
  });

  it("treats a possible competition as a warning", () => {
    expect(calibrateReasonSeverity("fail", "competing_possible")).toEqual({ severity: "warning", prefix: "" });
  });

  it("downgrades an unclassified fail and marks it", () => {
    expect(calibrateReasonSeverity("fail", "")).toEqual({ severity: "warning", prefix: "[critic_reason_branch_missing] " });
    expect(calibrateReasonSeverity("fail", undefined)).toEqual({ severity: "warning", prefix: "[critic_reason_branch_missing] " });
    expect(calibrateReasonSeverity("warning", "unknown")).toEqual({ severity: "warning", prefix: "" });
  });

  it("asks the consistency audit for the same branch field", () => {
    const item = (MISSION_CONSISTENCY_RESPONSE_FORMAT.json_schema.schema.properties as Record<string, { items: { required: string[]; properties: Record<string, { enum?: string[] }> } }>).reason_findings.items;
    expect(item.required).toContain("reason_branch");
    expect(item.properties.reason_branch.enum).toEqual(["", ...REASON_BRANCHES]);
  });
});
