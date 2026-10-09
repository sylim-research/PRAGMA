import { describe, expect, it } from "vitest";

import { publicRepresentativeMission, REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import {
  DEMO_FIRST_DRAFT,
  DEMO_MJT_ANSWERS,
  DEMO_REVISED_DRAFT,
  RECORDED_FIRST_FEEDBACK,
  RECORDED_RECHECK_FEEDBACK,
  requestDemoFeedback,
} from "./representativeDemoFeedback";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";
import { REVERSE_REPRESENTATIVE_SNAPSHOT } from "./reverseRepresentativeSnapshot";
import { KO_ZH_INTERPRETING_SNAPSHOT, ZH_KO_TRANSLATION_SNAPSHOT } from "./additionalDemoSnapshots";
import { FeedbackSchema } from "@/lib/pragma/feedbackSchema";
import approved from "../../../docs/research-trail/evidence/2026-10-04-representative-storage-demo/approved-snapshot.json";
import recorded from "../../../docs/research-trail/evidence/2026-10-04-representative-storage-demo/recorded-attempt.json";

describe("representative mission model house", () => {
  it("runs the approved parcel-storage snapshot", () => {
    const runnable = publicRepresentativeMission();
    expect(runnable.scenario_id).toBe(REPRESENTATIVE_MISSION_ID);
    expect(REPRESENTATIVE_MISSION_ID).toBe("24fb6841-6868-4e14-8e54-4e946466dc8e");
    expect(runnable.mission.provenance?.mission_content_hash).toBe("0024c9117662c674380b461cd7825e44704166577de73d752f58fa65e86a063b");
  });

  it("is the approved DB content verbatim except the documented learner-facing corrections", () => {
    const corrected = structuredClone(approved);
    corrected.mission_content.mpj_items[1].accepted_scale_codes = ["somewhat_inappropriate", "very_inappropriate"];
    // 2026-10-09: MJT5 explanation reads as commentary on the fix, not a second instruction.
    corrected.mission_content.mpj_items[3].explanation_ko = REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.mpj_items[3].explanation_ko;
    expect(corrected.mission_content.mpj_items[3].explanation_ko).not.toContain("고쳐 보세요");
    expect(REPRESENTATIVE_MISSION_SNAPSHOT).toEqual(corrected);
    const task = REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.production_task;
    expect(task.vocabulary_hints.map((hint) => hint.target)).toEqual(["快递", "保管"]);
    expect(JSON.stringify(task)).not.toContain("代收");
  });

  it("replays only the recorded attempt of the same approved version", async () => {
    expect(recorded.content_hash).toBe(REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.provenance.mission_content_hash);
    expect(DEMO_FIRST_DRAFT).toBe(recorded.first_response);
    expect(DEMO_REVISED_DRAFT).toBe(recorded.revised_response);
    expect(RECORDED_FIRST_FEEDBACK).toEqual(FeedbackSchema.parse(recorded.feedback_rounds[0].feedback));
    expect(RECORDED_RECHECK_FEEDBACK).toEqual(FeedbackSchema.parse(recorded.feedback_rounds[1].feedback));
    const first = await requestDemoFeedback(null, DEMO_FIRST_DRAFT);
    expect(first.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("too_direct");
    expect(first.feedback?.provenance.model).toBe("gpt-4.1-mini");
    const recheck = await requestDemoFeedback(null, DEMO_REVISED_DRAFT);
    expect(recheck.feedback?.verdicts.pragmatic_appropriateness.band_code).toBe("within_band");
    expect((await requestDemoFeedback(null, "你好")).ok).toBe(false);
  });

  it("keeps the designed demo answers in their intended places against the approved keys", () => {
    const items = publicRepresentativeMission().mission.mpj_items as unknown as Array<Record<string, any>>;
    const single = items.find((item) => item.id === 1)!;
    expect(single.reference_scale_code).not.toBe(DEMO_MJT_ANSWERS.A1.pick);
    expect(single.accepted_scale_codes).toContain(DEMO_MJT_ANSWERS.A1.pick); // 허용 판단
    const recommendation = items.find((item) => item.id === 2)!;
    expect(recommendation.reference_scale_code).toBe(DEMO_MJT_ANSWERS.A2.pick);
    expect(recommendation.reason_choice.accepted_id).toBe(DEMO_MJT_ANSWERS.A2.reasonId);
    const poster = items.find((item) => item.id === 5)!;
    expect(poster.candidates[0].accepted_band_codes).not.toContain(DEMO_MJT_ANSWERS.A5.candidatePicks!["A5-0"]); // 유일한 오판
    expect(DEMO_MJT_ANSWERS.A3).toBeUndefined(); // 기준 선택
    const rehearsal = items.find((item) => item.id === 4)!;
    expect(rehearsal.reference_alternatives).not.toContain(DEMO_MJT_ANSWERS.A4.text);
  });

  it("keeps every demo scale key on one side of the appropriate/inappropriate line", () => {
    const sides = { very_appropriate: "a", somewhat_appropriate: "a", somewhat_inappropriate: "i", very_inappropriate: "i" } as Record<string, string>;
    for (const snap of [REPRESENTATIVE_MISSION_SNAPSHOT, REVERSE_REPRESENTATIVE_SNAPSHOT, KO_ZH_INTERPRETING_SNAPSHOT, ZH_KO_TRANSLATION_SNAPSHOT]) {
      for (const item of snap.mission_content.mpj_items as Array<Record<string, any>>) {
        if (item.type !== "scale4") continue;
        expect(new Set(item.accepted_scale_codes.map((code: string) => sides[code])).size).toBe(1);
      }
    }
  });
});
