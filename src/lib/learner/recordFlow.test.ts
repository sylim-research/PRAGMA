import { describe, expect, it } from "vitest";

import { buildChangeMap } from "./recordFlow";

const feedback = (bandCode: string, scope: string) => ({
  verdicts: { semantic_fidelity: "preserved", grammatical_accuracy: "clean", pragmatic_appropriateness: { band_code: bandCode } },
  revision_scope: scope,
  blocks: { feature_ko: "판정 설명" },
});

describe("buildChangeMap — record badge", () => {
  it("shows the mission screen's common status for request feedback and keeps the explanation and focus", () => {
    expect(buildChangeMap(feedback("too_direct", "feature"), "request_mitigation_optionality")).toMatchObject({
      band: { label: "수정 권장" }, scope: "상대에게 주는 인상", feature: "판정 설명",
    });
    expect(buildChangeMap(feedback("within_band", "clear"), "request_mitigation_optionality")).toMatchObject({
      band: { label: "좋음" }, scope: "특별히 고칠 곳 없음",
    });
  });

  it("leaves other speech acts on their own band labels", () => {
    expect(buildChangeMap(feedback("too_blunt", "feature"), "refusal_softening")?.band?.label).toBe("너무 단칼");
  });
});
