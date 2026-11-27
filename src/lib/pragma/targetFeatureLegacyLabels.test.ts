import { describe, expect, it } from "vitest";
import { currentClosingPrinciple, currentFeatureLabel, getTargetFeature } from "./targetFeatures";

describe("legacy catalog wording", () => {
  const apology = getTargetFeature("apology_accountability_repair")!;

  it("reads the old apology label as the current one", () => {
    expect(currentFeatureLabel("책임 인정과 수리")).toBe(apology.learner_label);
    expect(currentFeatureLabel("완화와 선택권")).toBe("완화와 선택권");
    expect(currentFeatureLabel(undefined)).toBeUndefined();
  });

  it("reads the old apology closing principle as the current one", () => {
    const old = apology.closing_principle_ko.replace("필요한 보상을", "필요한 수리를");
    expect(old).not.toBe(apology.closing_principle_ko);
    expect(currentClosingPrinciple(old)).toBe(apology.closing_principle_ko);
  });
});
