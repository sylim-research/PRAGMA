import { describe, expect, it } from "vitest";

import { publicRepresentativeMission, REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import { DEMO_FIRST_DRAFT, DEMO_REVISED_DRAFT, requestDemoFeedback } from "./representativeDemoFeedback";

describe("representative mission model house", () => {
  it("runs the approved parcel snapshot", () => {
    const runnable = publicRepresentativeMission();
    expect(runnable.scenario_id).toBe(REPRESENTATIVE_MISSION_ID);
    expect(runnable.mission.provenance?.mission_content_hash).toBe("bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095");
  });
  it("returns prepared feedback for the example drafts only", async () => {
    const first = await requestDemoFeedback(null, DEMO_FIRST_DRAFT);
    expect(first.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("too_direct");
    expect(first.feedback?.provenance.model).toBe("gpt-4.1-mini");
    const recheck = await requestDemoFeedback(null, DEMO_REVISED_DRAFT);
    expect(recheck.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("within_band");
    expect((await requestDemoFeedback(null, "你好")).ok).toBe(false);
  });
});
