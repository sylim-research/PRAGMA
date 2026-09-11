import { describe, expect, it } from "vitest";
import { calibrateReasonFinding, REASON_COMPETITION } from "../../../supabase/functions/_shared/reasonCriticCalibration";
import { MISSION_CONSISTENCY_RESPONSE_FORMAT } from "../../../supabase/functions/_shared/missionConsistency";

const mission = {
  mpj_items: [
    { type: "scale4" },
    { type: "judge3" },
    { type: "fix_choice" },
    { type: "reason", accepted_reason_id: "r2", reasons: [{ id: "r3" }, { id: "r1" }, { id: "r2" }] },
  ],
};
const onDistractor = (severity: "warning" | "fail", facts: Record<string, unknown>) =>
  calibrateReasonFinding(mission, "mpj_items[3].reasons[0]", severity, facts);

describe("primary_reason_ambiguity severity on a distractor follows two facts", () => {
  it("keeps a false premise and a clear competition as fail", () => {
    expect(onDistractor("warning", { reason_observation_present: false, reason_competition: "none" })).toEqual({ severity: "fail", prefix: "[reason_false_premise] " });
    expect(onDistractor("warning", { reason_observation_present: true, reason_competition: "clear" })).toEqual({ severity: "fail", prefix: "[reason_competes_clear] " });
  });

  it("does not let a true, non-competing distractor surface as a content fail", () => {
    expect(onDistractor("fail", { reason_observation_present: true, reason_competition: "none" })).toEqual({ severity: "warning", prefix: "[critic_reason_secondary_calibrated] " });
  });

  it("treats a possible competition as a warning and never blocks on missing facts", () => {
    expect(onDistractor("fail", { reason_observation_present: true, reason_competition: "possible" })).toEqual({ severity: "warning", prefix: "[reason_competes_possible] " });
    expect(onDistractor("fail", {})).toEqual({ severity: "warning", prefix: "[critic_reason_facts_missing] " });
  });

  it("matches a path that continues into the option text", () => {
    expect(calibrateReasonFinding(mission, "mpj_items[3].reasons[1].text_ko", "fail", { reason_observation_present: true, reason_competition: "none" }).severity).toBe("warning");
  });

  it("keeps the critic's severity for the primary option and the item as a whole", () => {
    expect(calibrateReasonFinding(mission, "mpj_items[3].reasons[2]", "fail", { reason_observation_present: true, reason_competition: "none" })).toEqual({ severity: "fail", prefix: "" });
    expect(calibrateReasonFinding(mission, "mpj_items[3].accepted_reason_id", "fail", {})).toEqual({ severity: "fail", prefix: "" });
  });

  it("asks the consistency audit for the same two facts", () => {
    const item = (MISSION_CONSISTENCY_RESPONSE_FORMAT.json_schema.schema.properties as Record<string, { items: { required: string[]; properties: Record<string, { enum?: string[]; type?: unknown }> } }>).reason_findings.items;
    expect(item.required).toEqual(expect.arrayContaining(["reason_observation_present", "reason_competition"]));
    expect(item.properties.reason_competition.enum).toEqual(["", ...REASON_COMPETITION]);
    expect(item.properties.reason_observation_present.type).toEqual(["boolean", "null"]);
  });
});
