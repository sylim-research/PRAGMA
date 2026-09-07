import { describe, expect, it } from "vitest";

import { CANONICAL_MISSION_PREVIEW } from "./canonicalMissionPreview";

describe("CANONICAL_MISSION_PREVIEW lessonPoints", () => {
  it("keeps one grounded lesson in MPJ1–5 order without revealing the DCT answer", () => {
    const { lessonPoints, quests } = CANONICAL_MISSION_PREVIEW;
    const dct = quests.find((quest) => quest.kind === "dct");

    expect(lessonPoints).toHaveLength(5);
    expect(lessonPoints.map((point) => point.questId)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(lessonPoints.map((point) => point.label)).toEqual([
      "첫인상 판단",
      "상황 비교",
      "고쳐 보기",
      "이유 찾기",
      "BEST·WORST",
    ]);
    for (const point of lessonPoints) {
      expect(point.highlights?.length).toBeGreaterThan(0);
      for (const highlight of point.highlights ?? []) expect(point.text).toContain(highlight);
      expect(point.text).not.toContain("P·D·R");
      expect(point.text.length).toBeLessThanOrEqual(56);
      expect(point.text.match(/→/g)).toHaveLength(1);
      expect(point.text).not.toContain(" / ");
      if (dct) expect(point.text).not.toContain(dct.referenceAnswer);
    }
  });
});
