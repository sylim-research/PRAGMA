import { describe, expect, it } from "vitest";

import { normalizeQuotedHan } from "@/pages/learner/CanonicalMissionRun";

describe("normalizeQuotedHan", () => {
  it("turns quoted Chinese into chips and keeps the following particle attached", () => {
    expect(normalizeQuotedHan("`想…可以吗?` 로 허락을 구하고")).toBe("`想…可以吗?`로 허락을 구하고");
    expect(normalizeQuotedHan("요청이 '麻烦您帮我保管一下了'로 직접적")).toBe("요청이 `麻烦您帮我保管一下了`로 직접적");
    expect(normalizeQuotedHan("「就这么定了」를 바꾸면")).toBe("`就这么定了`를 바꾸면");
  });
  it("leaves Korean-only quotes alone", () => {
    expect(normalizeQuotedHan("'좋음'이라고 하고")).toBe("'좋음'이라고 하고");
  });
});
