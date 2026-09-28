import { describe, expect, it } from "vitest";

import { publicRepresentativeMission, REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT, requestDemoFeedback } from "./representativeDemoFeedback";

describe("representative mission model house", () => {
  it("runs the approved parcel snapshot", () => {
    const runnable = publicRepresentativeMission();
    expect(runnable.scenario_id).toBe(REPRESENTATIVE_MISSION_ID);
    expect(runnable.mission.provenance?.mission_content_hash).toBe("3b213fbc547ad2e53834f5557ce53ebe7359a39de3e1781d297e2b37abd3e764");
  });
  it("returns prepared feedback for the example drafts only", async () => {
    const first = await requestDemoFeedback(null, DEMO_FIRST_DRAFT);
    expect(first.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("too_direct");
    expect(first.feedback?.provenance.model).toBe("gpt-4.1-mini");
    const recheck = await requestDemoFeedback(null, DEMO_REVISED_DRAFT);
    expect(recheck.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("within_band");
    expect((await requestDemoFeedback(null, "你好")).ok).toBe(false);
  });
  it("keeps the deliberate wrong answers wrong against the approved content", () => {
    const items = publicRepresentativeMission().mission.mpj_items as unknown as Array<Record<string, any>>;
    const recommendation = items.find(item => item.id === 2)!;
    expect(recommendation.accepted_scale_codes).not.toContain(DEMO_MJT_ANSWERS.A2.pick);
    expect(recommendation.reason_choice.options.map((o: { id: string }) => o.id)).toContain(DEMO_MJT_ANSWERS.A2.reasonId);
    expect(recommendation.reason_choice.accepted_id).not.toBe(DEMO_MJT_ANSWERS.A2.reasonId);
    const poster = items.find(item => item.id === 5)!;
    expect(poster.candidates[0].accepted_band_codes).not.toContain(DEMO_MJT_ANSWERS.A5.candidatePicks!["A5-0"]);
  });
});
