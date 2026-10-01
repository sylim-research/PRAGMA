import { describe, expect, it } from "vitest";

import { publicRepresentativeMission, REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT, requestDemoFeedback } from "./representativeDemoFeedback";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";
import previousApproved from "../../../docs/research-trail/evidence/2026-09-27-parcel-final-review/approved-final-content.json";

describe("representative mission model house", () => {
  it("runs the approved parcel snapshot", () => {
    const runnable = publicRepresentativeMission();
    expect(runnable.scenario_id).toBe(REPRESENTATIVE_MISSION_ID);
    expect(runnable.mission.provenance?.mission_content_hash).toBe("241470df3049080c5a8e7fd8e776462471d705ed0e19f159ef1f4ed30d153673");
  });
  it("returns prepared feedback for the example drafts only", async () => {
    const first = await requestDemoFeedback(null, DEMO_FIRST_DRAFT);
    expect(first.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("too_direct");
    expect(first.feedback?.provenance.model).toBe("gpt-4.1-mini");
    const recheck = await requestDemoFeedback(null, DEMO_REVISED_DRAFT);
    expect(recheck.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("within_band");
    expect((await requestDemoFeedback(null, "你好")).ok).toBe(false);
  });
  it("keeps the accepted four-field patch synchronized without changing other instructional content", () => {
    const current = structuredClone(REPRESENTATIVE_MISSION_SNAPSHOT.mission_content) as Record<string, any>;
    const previous = previousApproved as Record<string, any>;
    expect(current.mpj_items[4].candidates[3].text).toBe("学姐，社团宣传海报的原文件发我，我只改一下日期。");
    expect(current.mpj_items[1].target).toContain("就交给您写了，我下周五之前需要用到");
    expect(current.mpj_items[1].revision_examples[1]).toContain("下周五之前需要用到");
    expect(current.mpj_items[1].explanation_ko).toContain("`下周五之前需要用到` — 다음 주 금요일까지 필요하다는 기한");
    current.mpj_items[4].candidates[3].text = previous.mpj_items[4].candidates[3].text;
    for (const key of ["target", "revision_examples", "explanation_ko"]) current.mpj_items[1][key] = previous.mpj_items[1][key];
    const instructional = (content: Record<string, unknown>) => Object.fromEntries(Object.entries(content)
      .filter(([key]) => !["authoring", "provenance", "quality_check", "hsk_lexical_audit", "item_lineage"].includes(key)));
    expect(instructional(current)).toEqual(instructional(previous));
    expect(REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.mpj_items[1].revision_examples[0]).toBe(previous.mpj_items[1].revision_examples[0]);
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
