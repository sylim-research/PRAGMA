import { describe, expect, it } from "vitest";
import { MissionV6Schema, normalizeLearnerMission, type MissionV6 } from "@/lib/pragma/missionV6";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { SAMPLE_MISSION_V4, SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "./missionV4Sample";
import { SAMPLE_MISSION_V6, SAMPLE_MISSION_V6_REASON_CONTRAST } from "./missionV6Sample";
import { LEARNER_UX_PILOT } from "./learnerUxPilot";
import { buildMissionV6Responses } from "./missionV6Responses";
import { buildMissionAttemptRow } from "./missionAttemptRow";
import { adaptRunnableMissionToCanonical } from "./canonicalMissionRuntime";

const at = "2026-09-14T12:00:00.000Z";
const rawResponses = () => ({
  A1: { pick: "somewhat_appropriate" }, A2: { pick: "very_appropriate" },
  A3: { correctionIds: ["A3-2"] }, A4: { revisedText: "내가 직접 쓴 다른 수정문" },
  // Deliberately shuffled keys and choices different from the reference.
  A5: { candidateJudgments: { "A5-3": "appropriate", "A5-1": "too_direct", "A5-0": "too_indirect", "A5-2": "appropriate" } },
});
const runnable = (mission = SAMPLE_MISSION_V6) => ({ scenario_id: "11111111-1111-4111-8111-111111111111",
  speech_act: "request" as const, learner_level: "intermediate" as const, mission_status: "reviewed", release_gate_mode: "legacy_reviewed",
  direction: mission.direction, mission });
const attempt = (responses = buildMissionV6Responses(SAMPLE_MISSION_V6, rawResponses(), at)) => ({
  mission: SAMPLE_MISSION_V6, scenarioId: runnable().scenario_id, speechAct: "request", level: "intermediate",
  firstResponse: "DCT 최초안", revisedResponse: "DCT 최종안", startedAtIso: at, mpjResponses: responses,
});

describe("v6 inline reason and feedback-only contrast", () => {
  const mission = SAMPLE_MISSION_V6_REASON_CONTRAST;
  it("extends only MJT2 and MJT4; the frozen sample and MJT5 remain unchanged", () => {
    const { reason_choice, ...second } = mission.mpj_items[1];
    const { contrast, ...fourth } = mission.mpj_items[3];
    expect(second).toEqual(SAMPLE_MISSION_V6.mpj_items[1]);
    expect(fourth).toEqual(SAMPLE_MISSION_V6.mpj_items[3]);
    for (const index of [0, 2, 4]) expect(mission.mpj_items[index]).toEqual(SAMPLE_MISSION_V6.mpj_items[index]);
    expect(mission.production_task).toEqual(SAMPLE_MISSION_V6.production_task);
    expect(reason_choice.options).toHaveLength(3);
    const withoutContrast = structuredClone(mission);
    delete withoutContrast.mpj_items[3].contrast;
    expect(MissionV6Schema.safeParse(withoutContrast).success).toBe(true);
    const duplicateId = structuredClone(mission);
    duplicateId.mpj_items[1].reason_choice.options[1].id = reason_choice.options[0].id;
    expect(MissionV6Schema.safeParse(duplicateId).success).toBe(false);
  });
  it.each(["very_appropriate", "somewhat_appropriate", "somewhat_inappropriate", "very_inappropriate"])(
    "preserves every reason choice with %s without a scoring gate", scaleCode => {
      for (const reason of mission.mpj_items[1].reason_choice.options) {
        const input = { ...rawResponses(), A2: { pick: scaleCode, reasonId: reason.id } };
        input.A4.revisedText = "  明天我下课晚，彩排可以改到七点半吗？\n";
        const traces = buildMissionV6Responses(mission, input, at);
        const row = buildMissionAttemptRow({ ...attempt(traces), mission }, "profile", "user", at);
        const restored = JSON.parse(JSON.stringify(row)).context_judgment.responses;
        expect(restored[1]).toEqual({ item_id: 2, item_type: "scale4", completed_at: at, scale_code: scaleCode, reason_id: reason.id });
        expect(restored[3].revised_text).toBe(input.A4.revisedText);
        expect(restored[4].candidate_band_codes).toEqual(["too_indirect", "too_direct", "appropriate", "appropriate"]);
        expect(restored).toHaveLength(5);
        expect(JSON.stringify(restored)).not.toMatch(/reason_kind|contrast|confidence/);
      }
    });
  it("rejects missing or foreign reasons at both mapping and attempt boundaries", () => {
    for (const reasonId of [undefined, "", "foreign-candidate"]) {
      const input = { ...rawResponses(), A2: { pick: "very_appropriate", reasonId } };
      expect(() => buildMissionV6Responses(mission, input, at)).toThrow();
      const oldTraces = buildMissionV6Responses(SAMPLE_MISSION_V6, rawResponses(), at);
      if (reasonId !== undefined) oldTraces[1].reason_id = reasonId;
      expect(() => buildMissionAttemptRow({ ...attempt(oldTraces), mission }, "profile", "user", at)).toThrow();
    }
    const input = { ...rawResponses(), A2: { pick: "very_appropriate", reasonId: "assumed-acceptance" } };
    expect(() => buildMissionV6Responses(SAMPLE_MISSION_V6, input, at)).toThrow();
  });
  it("keeps the first judgment and records a judgment changed after reasons separately", () => {
    const reasonId = mission.mpj_items[1].reason_choice.options[1].id;
    const unchanged = buildMissionV6Responses(mission, { ...rawResponses(), A2: { pick: "somewhat_appropriate", reasonId, revisedPick: "somewhat_appropriate" } }, at);
    expect(unchanged[1]).not.toHaveProperty("revised_scale_code");
    const traces = buildMissionV6Responses(mission, { ...rawResponses(), A2: { pick: "somewhat_appropriate", reasonId, revisedPick: "somewhat_inappropriate" } }, at);
    const restored = JSON.parse(JSON.stringify(buildMissionAttemptRow({ ...attempt(traces), mission }, "profile", "user", at))).context_judgment.responses;
    expect(restored[1]).toEqual({ item_id: 2, item_type: "scale4", completed_at: at,
      scale_code: "somewhat_appropriate", reason_id: reasonId, revised_scale_code: "somewhat_inappropriate" });
  });
  it("rejects a revised judgment that repeats the first, is unknown, or appears without reasons", () => {
    const reasonId = mission.mpj_items[1].reason_choice.options[0].id;
    const traces = buildMissionV6Responses(mission, { ...rawResponses(), A2: { pick: "very_appropriate", reasonId } }, at);
    for (const revised of ["very_appropriate", "invented"]) {
      const mutated = structuredClone(traces); mutated[1].revised_scale_code = revised;
      expect(() => buildMissionAttemptRow({ ...attempt(mutated), mission }, "profile", "user", at)).toThrow();
    }
    const withoutReasons = buildMissionV6Responses(SAMPLE_MISSION_V6, rawResponses(), at);
    withoutReasons[1].revised_scale_code = "very_inappropriate";
    expect(() => buildMissionAttemptRow(attempt(withoutReasons), "profile", "user", at)).toThrow();
  });
});

describe("mission_v6 format and backward compatibility", () => {
  it.each([SAMPLE_MISSION_V4, SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE])("leaves $schema_version normalization identical", mission => {
    const before = JSON.stringify(mission);
    expect(normalizeLearnerMission(mission)).toEqual(normalizeMission(mission));
    expect(JSON.stringify(mission)).toBe(before);
  });
  it("round trips v6 and keeps the legacy generator/review parser closed to it", () => {
    expect(normalizeLearnerMission(JSON.parse(JSON.stringify(SAMPLE_MISSION_V6))).data).toEqual(SAMPLE_MISSION_V6);
    expect(normalizeMission(SAMPLE_MISSION_V6).ok).toBe(false);
  });
  it.each([
    ["old reason item", (m: any) => { m.mpj_items[3] = SAMPLE_MISSION_V5_NATIVE.mpj_items[3]; }],
    ["wrong item order", (m: any) => { [m.mpj_items[0], m.mpj_items[1]] = [m.mpj_items[1], m.mpj_items[0]]; }],
    ["three spectrum candidates", (m: any) => { m.mpj_items[4].candidates.pop(); }],
    ["unknown band", (m: any) => { m.mpj_items[4].candidates[0].accepted_band_codes = ["invented"]; }],
    ["unrelated focal text", (m: any) => { m.production_task.focal_segments[0].text = "not in source"; }],
    ["reference outside accepted scale", (m: any) => { m.mpj_items[0].reference_scale_code = "very_inappropriate"; }],
    ["relabeling old response as a correction", (m: any) => { m.mpj_items[3].reason_id = "old"; }],
  ])("rejects %s", (_, mutate) => {
    const mission = structuredClone(SAMPLE_MISSION_V6); mutate(mission);
    expect(MissionV6Schema.safeParse(mission).success).toBe(false);
  });
  it("keeps frozen sources, targets, references and explanations in the new adapter", () => {
    const view = adaptRunnableMissionToCanonical(runnable());
    expect(view.quests.map(q => q.kind)).toEqual(["scale", "scale", "fix_choice", "free_correction", "spectrum", "dct", "dct_feedback"]);
    view.quests.slice(0, 5).forEach((quest, index) => {
      const original = LEARNER_UX_PILOT.quests[index];
      expect(quest.source).toBe(original.source);
      if ("target" in quest && "target" in original) expect(quest.target).toBe(original.target);
      if ("feedback" in quest && "feedback" in original) expect(quest.feedback).toEqual(original.feedback);
      if (quest.kind === "free_correction" && original.kind === "free_correction") expect(quest.references).toEqual(original.references);
      if (quest.kind === "spectrum" && original.kind === "spectrum") expect(quest.candidates.map(({ id, ...rest }) => rest)).toEqual(original.candidates.map(({ id, ...rest }) => rest));
    });
    expect(view.quests[5].source).toBe(LEARNER_UX_PILOT.quests[5].source);
    expect(view.lessonPoints).toEqual(LEARNER_UX_PILOT.lessonPoints);
    expect(view.learnerContextCopy.A3).toBe("");
  });
  it.each(["ko_zh", "zh_ko"] as const)("adapts language and interpreting metadata for %s", direction => {
    const mission: MissionV6 = { ...SAMPLE_MISSION_V6, direction, production_task: {
      ...SAMPLE_MISSION_V6.production_task, mode: "interpreting", source_modality: "spoken", replay_limit: 2,
    } };
    const view = adaptRunnableMissionToCanonical(runnable(mission));
    expect(view.targetLanguage.code).toBe(direction === "ko_zh" ? "zh" : "ko");
    expect(view.quests[5]).toMatchObject({ kind: "dct", replayLimit: 2, vocabularyHints: [] });
  });
});

describe("v6 unscored response contract", () => {
  it("stores submitted text and four choices in content order without synthetic reason or rank", () => {
    const traces = buildMissionV6Responses(SAMPLE_MISSION_V6, rawResponses(), at);
    expect(traces[3]).toEqual({ item_id: 4, item_type: "free_correction", completed_at: at, revised_text: rawResponses().A4.revisedText });
    expect(traces[4]).toEqual({ item_id: 5, item_type: "multi_judge", completed_at: at,
      candidate_band_codes: ["too_indirect", "too_direct", "appropriate", "appropriate"] });
    expect(traces[2]).not.toHaveProperty("band_code");
    const row = buildMissionAttemptRow(attempt(traces), "profile", "user", at);
    expect(row.context_judgment).toMatchObject({ schema_version: "mpj_response_v2", mission_schema_version: "mission_v6", responses: traces });
    expect(row.first_response).toBe("DCT 최초안"); expect(row.revised_response).toBe("DCT 최종안");
    expect(JSON.stringify(traces)).not.toMatch(/reason_id|reason_kind|confidence|best_candidate_index|worst_candidate_index/);
  });
  it("accepts an unchanged starting translation; no scoring or edit-count gate", () => {
    const input = rawResponses(); input.A4.revisedText = SAMPLE_MISSION_V6.mpj_items[3].target;
    expect(buildMissionV6Responses(SAMPLE_MISSION_V6, input, at)[3].revised_text).toBe(input.A4.revisedText);
  });
  it.each([
    ["missing free response", (r: any) => { delete r.A4; }],
    ["blank free response", (r: any) => { r.A4.revisedText = " \n "; }],
    ["missing candidate", (r: any) => { delete r.A5.candidateJudgments["A5-2"]; }],
    ["unknown choice", (r: any) => { r.A5.candidateJudgments["A5-2"] = "invented"; }],
    ["unknown correction", (r: any) => { r.A3.correctionIds = ["A3-8"]; }],
  ])("rejects %s before saving", (_, mutate) => {
    const responses = rawResponses(); mutate(responses);
    expect(() => buildMissionV6Responses(SAMPLE_MISSION_V6, responses, at)).toThrow();
  });
  it("checks v6 traces again at the attempt boundary and preserves input whitespace", () => {
    const input = rawResponses(); input.A4.revisedText = "  학습자가 제출한 원문  ";
    const traces = buildMissionV6Responses(SAMPLE_MISSION_V6, input, at);
    expect(traces[3].revised_text).toBe(input.A4.revisedText);
    delete traces[3].revised_text;
    expect(() => buildMissionAttemptRow(attempt(traces), "profile", "user", at)).toThrow();
  });
});

describe("v6 beyond request — the skeleton is act-neutral, the judgment axis is not", () => {
  // The same five items with gratitude's axis: the catalog names the bands, so
  // nothing about the item structure moves.
  const asThanks = (): any => {
    const mission = structuredClone(SAMPLE_MISSION_V6) as any;
    mission.learning_goal.speech_act = "thanks";
    mission.unit.target_feature = "gratitude_calibration";
    const band: Record<string, string> = { too_direct: "insufficient", appropriate: "within_band", too_indirect: "excessive" };
    for (const candidate of mission.mpj_items[4].candidates) {
      candidate.accepted_band_codes = candidate.accepted_band_codes.map((code: string) => band[code]);
    }
    return mission;
  };

  it("accepts a non-request act whose bands come from its own feature", () => {
    expect(MissionV6Schema.safeParse(asThanks()).success).toBe(true);
  });

  it("keeps the request exception to request alone", () => {
    expect(MissionV6Schema.safeParse(SAMPLE_MISSION_V6).success).toBe(true);
    const thanks = asThanks();
    thanks.mpj_items[4].candidates[0].accepted_band_codes = ["appropriate"];
    expect(MissionV6Schema.safeParse(thanks).success).toBe(false);
  });

  it.each([
    ["another act's bands", (m: any) => { m.mpj_items[4].candidates[0].accepted_band_codes = ["too_direct"]; }],
    ["a feature the act does not own", (m: any) => { m.unit.target_feature = "request_mitigation_optionality"; }],
    ["an act outside the nine", (m: any) => { m.learning_goal.speech_act = "small_talk"; }],
  ])("rejects %s", (_, mutate) => {
    const mission = asThanks(); mutate(mission);
    expect(MissionV6Schema.safeParse(mission).success).toBe(false);
  });

  it("requires the prior move on the task for acts that answer one", () => {
    const refusal = structuredClone(SAMPLE_MISSION_V6) as any;
    refusal.learning_goal.speech_act = "refusal";
    refusal.unit.target_feature = "refusal_softening";
    const band: Record<string, string> = { too_direct: "too_blunt", appropriate: "within_band", too_indirect: "over_elaborate" };
    for (const candidate of refusal.mpj_items[4].candidates) {
      candidate.accepted_band_codes = candidate.accepted_band_codes.map((code: string) => band[code]);
    }
    expect(MissionV6Schema.safeParse(refusal).success).toBe(false);
    refusal.production_task.preceding_turn = "같이 저녁 먹을래?";
    expect(MissionV6Schema.safeParse(refusal).success).toBe(true);
  });

  it("reads MJT5 choices off the catalog without moving the approved request screen", () => {
    const requestView = adaptRunnableMissionToCanonical(runnable());
    const requestSpectrum = requestView.quests[4];
    expect(requestSpectrum.kind === "spectrum" && requestSpectrum.options).toEqual([
      { id: "too_direct", label: "너무 직접적" },
      { id: "appropriate", label: "상황에 맞음" },
      { id: "too_indirect", label: "지나치게 우회적" },
    ]);
    const thanksView = adaptRunnableMissionToCanonical({
      ...runnable(asThanks() as MissionV6), speech_act: "thanks" as const,
    });
    const thanksSpectrum = thanksView.quests[4];
    expect(thanksSpectrum.kind === "spectrum" && thanksSpectrum.options).toEqual([
      { id: "insufficient", label: "부족함" },
      { id: "within_band", label: "상황에 맞음" },
      { id: "excessive", label: "과함" },
    ]);
  });

  it("checks a learner's judgments against the mission's own bands", () => {
    const thanks = asThanks() as MissionV6;
    const responses = rawResponses();
    responses.A5 = { candidateJudgments: { "A5-0": "insufficient", "A5-1": "within_band", "A5-2": "excessive", "A5-3": "within_band" } };
    expect(buildMissionV6Responses(thanks, responses, at)[4].candidate_band_codes)
      .toEqual(["insufficient", "within_band", "excessive", "within_band"]);
    const requestBands = rawResponses();
    expect(() => buildMissionV6Responses(thanks, requestBands, at)).toThrow();
  });
});
