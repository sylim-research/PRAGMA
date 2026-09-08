import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import {
  RETIRED_MISSION_RULE_IDS,
  checkCore,
  checkMission,
  type CheckContext,
} from "@/lib/pragma/missionRules";

const context: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
  direction: "ko_zh",
};

const violationsFor = (mission: unknown, id: string) =>
  checkMission(mission, context).violations.filter((violation) => violation.id === id);

it("rejects duplicate reason wording despite different IDs and punctuation", () => {
  const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
  const reason = mission.mpj_items[3];
  if (reason.type !== "reason") throw new Error("Expected reason");
  reason.reasons[1].text_ko = reason.reasons[0].text_ko + "  !";
  expect(violationsFor(mission, "R4")).toContainEqual(expect.objectContaining({
    level: "fail", message: expect.stringContaining("이유 선택지 문구가 중복됨"),
  }));
});

describe("mission rule audit regressions", () => {
  it("warns on fully separable R5 length ranges without blocking overlapping ranges", () => {
    const separated = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const separatedMulti = separated.mpj_items[4];
    if (separatedMulti.type !== "multi_judge") throw new Error("Expected multi_judge");

    const separatedLengths = [17, 23, 24, 18];
    separatedMulti.candidates.forEach((candidate, index) => {
      candidate.text = "可".repeat(separatedLengths[index]);
    });
    expect(
      violationsFor(separated, "R5").some(
        (violation) =>
          violation.level === "warning" && violation.message.includes("길이만으로 완전히 분리"),
      ),
    ).toBe(true);

    const overlapped = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const overlappedMulti = overlapped.mpj_items[4];
    if (overlappedMulti.type !== "multi_judge") throw new Error("Expected multi_judge");
    const overlappedLengths = [17, 20, 24, 22];
    overlappedMulti.candidates.forEach((candidate, index) => {
      candidate.text = "可".repeat(overlappedLengths[index]);
    });
    expect(
      violationsFor(overlapped, "R5").some(
        (violation) =>
          violation.level === "warning" && violation.message.includes("길이만으로 완전히 분리"),
      ),
    ).toBe(false);
  });

  it("rejects a Chinese target that contains Hangul instead of accepting one Han character", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const judge = mission.mpj_items[1];
    if (judge.type !== "judge3") throw new Error("Expected judge3");
    judge.target = "请요청";

    expect(
      violationsFor(mission, "R10").some(
        (violation) => violation.level === "fail" && violation.message.includes("중국어가 아님"),
      ),
    ).toBe(true);

    const candidateMission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const multi = candidateMission.mpj_items[4];
    if (multi.type !== "multi_judge") throw new Error("Expected multi_judge");
    multi.candidates[0].text = "请요청";
    expect(
      violationsFor(candidateMission, "R10").some(
        (violation) => violation.level === "fail" && violation.message.includes("한글 혼입"),
      ),
    ).toBe(true);
  });

  it("warns when MPJ source events or judgment candidates are exactly reused", () => {
    const duplicatedSource = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    duplicatedSource.mpj_items[1].source = duplicatedSource.mpj_items[0].source;
    expect(
      violationsFor(duplicatedSource, "R19").some(
        (violation) => violation.level === "warning" && violation.message.includes("source 완전 중복"),
      ),
    ).toBe(true);

    const duplicatedCandidate = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const fix = duplicatedCandidate.mpj_items[2];
    const multi = duplicatedCandidate.mpj_items[4];
    if (fix.type !== "fix_choice" || multi.type !== "multi_judge") {
      throw new Error("Expected fix_choice and multi_judge");
    }
    multi.candidates[0].text = fix.corrections[0].text;
    expect(
      violationsFor(duplicatedCandidate, "R19").some(
        (violation) => violation.level === "warning" && violation.message.includes("판정 후보 완전 중복"),
      ),
    ).toBe(true);
  });

  it("enforces the native R27 X-A-A-A-Y-C topology without rejecting Anchor A sharing", () => {
    const saved = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    saved.contrast_plan = {
      version: "contrast_plan_v1", speech_act: "request", mission_goal: "integrated_speech_act",
      item_slots: saved.mpj_items.map(item => ({ item_id: item.id, item_type: item.type,
        item_focus: item.axis_feature, intended_band_profile: "saved" })),
    };
    expect(violationsFor(saved, "R27")).toEqual([]);

    const splitAnchor = structuredClone(saved);
    splitAnchor.mpj_items[2].situation_ko = "다른 Anchor 사건을 새로 만들었다. 이 문장은 두 번째 설명이다.";
    expect(violationsFor(splitAnchor, "R27")).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "fail", message: expect.stringContaining("[slot:MJT3]") }),
    ]));

    const copiedX = structuredClone(saved);
    copiedX.mpj_items[0].situation_ko = copiedX.mpj_items[1].situation_ko;
    expect(violationsFor(copiedX, "R27")).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "fail", message: expect.stringContaining("[slot:MJT1]") }),
    ]));

    const copiedY = structuredClone(saved);
    copiedY.mpj_items[4].situation_ko = copiedY.mpj_items[0].situation_ko;
    expect(violationsFor(copiedY, "R27")).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "fail", message: expect.stringContaining("[slot:MJT5]") }),
    ]));

    const copiedDct = structuredClone(saved);
    copiedDct.production_task.situation_ko = copiedDct.mpj_items[1].situation_ko;
    expect(violationsFor(copiedDct, "R27")).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "fail", message: expect.stringContaining("[slot:DCT]") }),
    ]));
  });

  it("fails when a recommended repair repeats an explicitly invalid correction", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const fix = mission.mpj_items[2];
    if (fix.type !== "fix_choice") throw new Error("Expected fix_choice");
    const invalidCorrection = fix.corrections.find((correction) => !correction.is_valid);
    if (!invalidCorrection) throw new Error("Expected an invalid correction");
    fix.recommended_example = invalidCorrection.text;

    expect(
      violationsFor(mission, "R21").some(
        (violation) => violation.level === "fail" && violation.message.includes("invalid 교정안"),
      ),
    ).toBe(true);
  });

  it("keeps the superseded R22 number retired instead of silently reusing it", () => {
    expect(RETIRED_MISSION_RULE_IDS).toEqual(["R22"]);
  });

  it("directly exercises the older deterministic guards that remain active", () => {
    const badHighlight = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const scale = badHighlight.mpj_items[0];
    if (scale.type !== "scale4") throw new Error("Expected scale4");
    scale.highlights = ["target에 없는 강조"];
    expect(violationsFor(badHighlight, "R6").some((item) => item.level === "fail")).toBe(true);

    const nationalized = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    nationalized.mpj_items[0].explanation_ko = "중국인들은 일반적으로 이렇게 요청을 받아들인다.";
    expect(violationsFor(nationalized, "R9").some((item) => item.level === "fail")).toBe(true);

    const oneSided = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const oneSidedMulti = oneSided.mpj_items[4];
    if (oneSidedMulti.type !== "multi_judge") throw new Error("Expected multi_judge");
    oneSidedMulti.candidates.forEach((candidate) => {
      candidate.accepted_band_codes = ["too_direct"];
    });
    expect(violationsFor(oneSided, "R12").some((item) => item.level === "warning")).toBe(true);

    const staleFeature = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    staleFeature.unit.target_feature_version = "stale-version";
    expect(violationsFor(staleFeature, "R13").some((item) => item.level === "fail")).toBe(true);

    const inventedLabel = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    inventedLabel.unit.learner_label = "AI가 임의로 만든 라벨";
    expect(violationsFor(inventedLabel, "R14").some((item) => item.level === "fail")).toBe(true);

    const wrongAcceptedBand = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    const wrongFix = wrongAcceptedBand.mpj_items[2];
    if (wrongFix.type !== "fix_choice") throw new Error("Expected fix_choice");
    wrongFix.accepted_band_codes = ["within_band"];
    expect(violationsFor(wrongAcceptedBand, "R18").some((item) => item.level === "fail")).toBe(true);

    const missingProvenance = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    delete missingProvenance.provenance;
    expect(violationsFor(missingProvenance, "R20").some((item) => item.level === "fail")).toBe(true);

    const plannedMismatch = checkMission(SAMPLE_MISSION_V5_NATIVE, {
      ...context,
      planned_target_feature: "request_conditional_preface",
    });
    expect(plannedMismatch.violations.some((item) => item.id === "R24" && item.level === "fail")).toBe(true);

    const wrongChannel = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    wrongChannel.mpj_items[0].channel = "facetoface";
    expect(violationsFor(wrongChannel, "R28").some((item) => item.level === "fail")).toBe(true);
  });

  it("keeps industry metadata out of non-work cores through R17", () => {
    const result = checkCore(
      {
        schema_version: "scenario_core_v1",
        situation_ko: "이웃에게 생활 소음을 줄여 달라는 글을 보낸다.",
        relation_ko: "아파트 이웃 관계",
        source_modality: "written",
        source_text_ko: "밤에는 소리를 조금 줄여 주실 수 있을까요?",
        preceding_turn_zh: null,
        pdr: { p: "equal", d: "acquaintance", r: "mid" },
        channel: "messenger",
      },
      {
        ...context,
        domain: "daily",
        theme_code: "daily_living",
        topic_code: "neighbor_noise",
        industry: "education_research",
      },
    );
    expect(result.violations.some((item) => item.id === "R17" && item.level === "fail")).toBe(true);
  });
});
