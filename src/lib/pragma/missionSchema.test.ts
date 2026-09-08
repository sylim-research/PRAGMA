import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import {
  SAMPLE_MISSION_V4,
  SAMPLE_MISSION_V5,
  SAMPLE_MISSION_V5_NATIVE,
} from "@/lib/mission/missionV4Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { TARGET_FEATURES } from "@/lib/pragma/targetFeatures";
import { CURRENT_MISSION_PROMPT_VERSIONS } from "../../../supabase/functions/_shared/contentRelease";

const context: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const provenance = {
  model: "gpt-4.1",
  prompt_version: "mission_v3_mpj4",
  mission_content_hash: "mission-v3-test",
  generated_at: "2026-07-28T07:30:00Z",
  generation_attempt: 1,
};

function missionV3() {
  const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
  return {
    ...legacy,
    schema_version: "mission_v3" as const,
    mpj_items: legacy.mpj_items.slice(0, 4),
    provenance,
  };
}

describe("mission_v3 MPJ4 contract", () => {
  it("accepts the four-item order and keeps legacy MPJ5 readable", () => {
    const current = normalizeMission(missionV3());
    expect(current.ok).toBe(true);
    expect(current.data?.schema_version).toBe("mission_v3");
    expect(current.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "judge3",
      "fix_choice",
      "reason_conf",
    ]);

    const legacy = normalizeMission(SAMPLE_MISSION_V1);
    expect(legacy.ok).toBe(true);
    expect(legacy.data?.schema_version).toBe("mission_v2");
    expect(legacy.data?.mpj_items).toHaveLength(5);
    expect(legacy.data?.mpj_items[4].type).toBe("multi_judge");
  });

  it("rejects multi_judge and a fifth item in mission_v3", () => {
    const base = normalizeMission(SAMPLE_MISSION_V1).data!;
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: [
          ...base.mpj_items.slice(0, 3),
          base.mpj_items[4],
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: base.mpj_items,
      }).ok,
    ).toBe(false);
  });

  it("applies the new R1 order without weakening legacy checks", () => {
    const valid = checkMission(missionV3(), context);
    expect(
      valid.violations.filter((item) => item.id === "R1" && item.level === "fail"),
    ).toEqual([]);

    const current = missionV3();
    const invalid = checkMission(
      {
        ...current,
        mpj_items: [
          current.mpj_items[1],
          current.mpj_items[0],
          current.mpj_items[2],
          current.mpj_items[3],
        ],
      },
      context,
    );
    expect(
      invalid.violations.some((item) => item.id === "R1" && item.level === "fail"),
    ).toBe(true);
  });
});

const provenanceV4 = {
  ...provenance,
  prompt_version: "mission_v4_mpj4_dct1_context_v3",
  mission_content_hash: "mission-v4-test",
  generated_at: "2026-07-29T00:30:00Z",
};

function missionV4() {
  const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
  const scale = legacy.mpj_items[0];
  const fix = legacy.mpj_items[2];
  const oldReason = legacy.mpj_items[3];
  const oldMulti = legacy.mpj_items[4];
  if (fix.type !== "fix_choice" || oldReason.type !== "reason_conf" || oldMulti.type !== "multi_judge") {
    throw new Error("legacy fixture order changed");
  }
  const anchorPdr = legacy.production_task.pdr;
  return {
    ...legacy,
    schema_version: "mission_v4" as const,
    unit: {
      ...legacy.unit,
      target_feature_version: TARGET_FEATURES.request_mitigation_optionality.version,
      closing_ko: TARGET_FEATURES.request_mitigation_optionality.closing_principle_ko,
    },
    mpj_items: [
      {
        ...scale,
        id: 1,
        channel: "messenger" as const,
        pdr: { p: "equal" as const, d: "close" as const, r: "low" as const },
        situation_ko:
          "같은 프로젝트를 오래 함께한 친한 동료가 이미 최신 파일을 정리해 두었다. 메신저로 파일 하나를 공유해 달라고 가볍게 부탁한다.",
        accepted_scale_codes: ["very_appropriate", "somewhat_appropriate"] as const,
        reference_scale_code: "somewhat_appropriate" as const,
      },
      {
        ...fix,
        id: 2,
        channel: "messenger" as const,
        pdr: anchorPdr,
        situation_ko:
          "거래처 담당자는 일정 변경을 내부 팀과 다시 조율해야 한다. 몇 차례 연락했지만 아직 친하지 않은 상대에게 메신저로 변경을 부탁한다.",
      },
      {
        id: 3,
        type: "reason" as const,
        axis_feature: oldReason.axis_feature,
        channel: "messenger" as const,
        situation_ko:
          "거래처 담당자는 결제일을 바꾸려면 회계팀 승인을 다시 받아야 한다. 몇 차례 업무 연락만 한 상대에게 메신저로 연기를 부탁한다.",
        relation_ko: oldReason.relation_ko,
        pdr: anchorPdr,
        source: oldReason.source,
        preceding_turn: oldReason.preceding_turn,
        target: oldReason.target,
        highlights: oldReason.highlights,
        problem_band_code: "too_direct",
        reasons: [
          { id: "r1", text_ko: "'必须'가 상대의 선택권을 없애는 것이 가장 큰 문제다.", kind: "primary" as const },
          { id: "r2", text_ko: "업무 요청은 언제나 길게 말해야 하기 때문이다.", kind: "pragmatic_misconception" as const },
          { id: "r3", text_ko: "중국어 문법상 동사를 쓸 수 없기 때문이다.", kind: "meaning_grammar_context" as const },
        ],
        accepted_reason_id: "r1",
        explanation_ko: oldReason.explanation_ko,
        recommended_example: oldReason.recommended_example,
      },
      {
        ...oldMulti,
        id: 4,
        channel: "messenger" as const,
        pdr: { ...anchorPdr, r: "high" as const },
        situation_ko:
          "추가 샘플 발송은 상대가 물류 일정을 전면 재조정해야 하는 큰 부탁이다. 몇 차례 연락했지만 친하지 않은 거래처 담당자에게 메신저로 요청한다.",
        candidates: oldMulti.candidates,
      },
    ],
    provenance: provenanceV4,
  };
}

describe("mission_v4 MPJ4 + DCT contract", () => {
  it("keeps the local learner preview on the validated v4 contract", () => {
    const parsed = normalizeMission(SAMPLE_MISSION_V4);
    expect(parsed.ok).toBe(true);
    const checked = checkMission(SAMPLE_MISSION_V4, context);
    expect(checked.violations.filter((item) => item.level === "fail")).toEqual([]);
  });

  it("accepts Scale4 → Judge3+FixChoice → Reason → MultiJudge and preserves older versions", () => {
    const parsed = normalizeMission(missionV4());
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.schema_version).toBe("mission_v4");
    expect(parsed.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "fix_choice",
      "reason",
      "multi_judge",
    ]);

    expect(normalizeMission(missionV3()).ok).toBe(true);
    expect(normalizeMission(SAMPLE_MISSION_V1).ok).toBe(true);
  });

  it("passes deterministic v4 structure rules", () => {
    const checked = checkMission(missionV4(), context);
    expect(checked.violations.filter((item) => item.level === "fail")).toEqual([]);
  });

  it("rejects repeated Judge3/ReasonConf, four-candidate MultiJudge, and missing context", () => {
    const current = missionV4();
    const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
    expect(
      normalizeMission({
        ...current,
        mpj_items: [
          current.mpj_items[0],
          current.mpj_items[1],
          legacy.mpj_items[3],
          current.mpj_items[3],
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...current,
        mpj_items: [
          current.mpj_items[0],
          current.mpj_items[1],
          current.mpj_items[2],
          {
            ...current.mpj_items[3],
            candidates:
              current.mpj_items[3].type === "multi_judge"
                ? current.mpj_items[3].candidates.slice(0, 4)
                : [],
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...current,
        mpj_items: [
          { ...current.mpj_items[0], preceding_turn: undefined },
          ...current.mpj_items.slice(1),
        ],
      }).ok,
    ).toBe(false);
  });

  it("fails ambiguous primary reasons and an uncontrolled PDR contrast", () => {
    const current = missionV4();
    const bad = {
      ...current,
      mpj_items: [
        current.mpj_items[0],
        current.mpj_items[1],
        {
          ...current.mpj_items[2],
          reasons: current.mpj_items[2].type === "reason"
            ? current.mpj_items[2].reasons.map((reason) => ({ ...reason, kind: "primary" as const }))
            : [],
        },
        {
          ...current.mpj_items[3],
          pdr: { p: "speaker_higher", d: "close", r: "high" },
        },
      ],
    };
    const checked = checkMission(bad, context);
    expect(checked.violations.some((item) => item.id === "R4" && item.level === "fail")).toBe(true);
    expect(checked.violations.some((item) => item.id === "R5" && item.level === "fail")).toBe(true);
  });

  it("returns actionable R27 retry details for duplicated MPJ and DCT situations", () => {
    const current = missionV4();
    const duplicateMpjs = checkMission(
      {
        ...current,
        mpj_items: [
          current.mpj_items[0],
          { ...current.mpj_items[1], situation_ko: current.mpj_items[0].situation_ko },
          ...current.mpj_items.slice(2),
        ],
      },
      context,
    );
    expect(
      duplicateMpjs.violations.some(
        (item) =>
          item.id === "R27" &&
          item.level === "fail" &&
          item.message.includes("문항 1·2") &&
          item.message.includes("용건·대상·사건"),
      ),
    ).toBe(true);

    const copiedDct = checkMission(
      {
        ...current,
        mpj_items: [
          current.mpj_items[0],
          { ...current.mpj_items[1], situation_ko: current.production_task.situation_ko },
          ...current.mpj_items.slice(2),
        ],
      },
      context,
    );
    expect(
      copiedDct.violations.some(
        (item) =>
          item.id === "R27" &&
          item.level === "fail" &&
          item.message.includes("문항 2") &&
          item.message.includes("DCT 상황을 그대로 복제"),
      ),
    ).toBe(true);
  });

  it("returns candidate bands, lengths, and a focus-preserving R5 retry instruction", () => {
    const current = missionV4();
    const multi = current.mpj_items[3];
    if (multi.type !== "multi_judge") throw new Error("fixture multi_judge changed");
    const texts = ["줘", "바로 줘", "가능하다면 지금 보내 주실 수 있을까요", "혹시 지금 공유해 주실 수 있을까요", "혹시"];
    const bands = ["too_direct", "too_direct", "within_band", "within_band", "too_indirect"] as const;
    const checked = checkMission(
      {
        ...current,
        mpj_items: [
          ...current.mpj_items.slice(0, 3),
          {
            ...multi,
            candidates: multi.candidates.map((candidate, index) => ({
              ...candidate,
              text: texts[index],
              accepted_band_codes: [bands[index]],
            })),
          },
        ],
      },
      context,
    );
    const violation = checked.violations.find(
      (item) => item.id === "R5" && item.level === "warning" && item.message.includes("길이만으로 완전히 분리"),
    );
    expect(violation?.message).toContain("후보 1[too_direct]=1자");
    expect(violation?.message).toContain("후보 3[within_band]");
    expect(violation?.message).toContain("초점 자원과 대역은 유지");
    expect(violation?.message).toContain("길이 범위를 겹치게");
  });

  it("accepts Scale4 by polarity but requires one reference degree inside that polarity", () => {
    const current = missionV4();
    const scale = current.mpj_items[0];
    const invalid = checkMission(
      {
        ...current,
        mpj_items: [
          {
            ...scale,
            accepted_scale_codes: ["very_appropriate", "somewhat_inappropriate"],
            reference_scale_code: "very_inappropriate",
          },
          ...current.mpj_items.slice(1),
        ],
      },
      context,
    );
    expect(invalid.violations.some((item) => item.id === "R7" && item.level === "fail")).toBe(true);
  });
});

describe("mission_v5 native MPJ5 contract", () => {
  const nativeFixture = () => ({
    ...SAMPLE_MISSION_V5_NATIVE,
    learning_goal: { kind: "speech_act" as const, speech_act: "request" as const },
    contrast_plan: {
      version: "contrast_plan_v1" as const, speech_act: "request" as const,
      mission_goal: "integrated_speech_act" as const,
      item_slots: SAMPLE_MISSION_V5_NATIVE.mpj_items.map(item => ({ item_id: item.id, item_type: item.type,
        item_focus: item.axis_feature, intended_band_profile: "saved" })),
    },
    provenance: {
      ...SAMPLE_MISSION_V5_NATIVE.provenance!,
      prompt_version: CURRENT_MISSION_PROMPT_VERSIONS[0],
    },
  });

  it("accepts native MPJ5 while keeping legacy mission_v5 MPJ4 readable", () => {
    const native = normalizeMission(nativeFixture());
    const legacy = normalizeMission(SAMPLE_MISSION_V5);
    const historicalNative = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    delete historicalNative.diagnostic_dimensions;
    historicalNative.provenance!.prompt_version = "mission_v5_mpj5_minidiscourse_v1";

    expect(native.ok).toBe(true);
    expect(native.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "judge3",
      "fix_choice",
      "reason",
      "multi_judge",
    ]);
    expect(legacy.ok).toBe(true);
    expect(legacy.data?.mpj_items).toHaveLength(4);
    expect(normalizeMission(historicalNative).ok).toBe(true);
  });

  it("passes native order, anchor, and band rules", () => {
    const checked = checkMission(nativeFixture(), context);
    expect(checked.violations.filter(
      (item) => item.level === "fail" && ["R2", "R3", "R4", "R5", "R27"].includes(item.id),
    )).toEqual([]);
  });

  it("keeps catalog 1.0 records readable without silently approving them against 1.1", () => {
    const historical = structuredClone(nativeFixture());
    historical.unit.target_feature_version = "1.0";
    historical.unit.closing_ko =
      "요청은 상대에게 거절할 여지를 얼마나 남기느냐로 무게가 정해집니다. 친밀·저부담이면 직접형도 알맞고, 초면·고부담이면 선택권을 남기는 표현이 어울립니다.";
    const before = structuredClone(historical);
    const parsed = normalizeMission(historical);
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.unit.target_feature_version).toBe("1.0");
    const checked = checkMission(historical, context);
    expect(checked.violations.filter((item) => item.id === "R13" || item.id === "R14")
      .map((item) => item.id)).toEqual(["R13", "R14"]);
    expect(historical).toEqual(before);
  });

  it("accepts four band-pair candidates without legacy roles and omits current native preceding turns", () => {
    const current = structuredClone(nativeFixture());
    current.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    const currentMulti = current.mpj_items[4];
    if (currentMulti.type !== "multi_judge") throw new Error("Expected multi_judge");
    currentMulti.candidates.forEach((candidate) => {
      delete candidate.comparison_role;
    });
    expect(checkMission(current, context).violations.filter(
      (item) => item.level === "fail" && (item.id === "R5" || item.id === "R8"),
    )).toEqual([]);

    const invalid = structuredClone(current);
    invalid.mpj_items[0].preceding_turn = "不需要出现的对方发言。";
    invalid.production_task.preceding_turn = "不需要出现的对方发言。";

    const failures = checkMission(invalid, context).violations.filter((item) => item.level === "fail");
    expect(failures.some((item) => item.id === "R8" && item.message.includes("native MJT5"))).toBe(true);
    expect(failures.some((item) => item.id === "R8" && item.message.includes("production_task"))).toBe(true);
  });

  it("keeps the four-role check for historical native MPJ5", () => {
    const historical = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    historical.provenance!.prompt_version = "mission_v5_mpj5_minidiscourse_v4_concise_learner_flow";
    const multi = historical.mpj_items[4];
    if (multi.type !== "multi_judge") throw new Error("Expected multi_judge");
    multi.candidates[0].comparison_role = "middle";

    expect(checkMission(historical, context).violations.some(
      (item) => item.id === "R5" && item.level === "fail" && item.message.includes("BEST 1"),
    )).toBe(true);
  });

  it("keeps the v8 band-pair contract after the current prompt advances", () => {
    const savedV8 = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    savedV8.provenance!.prompt_version = "mission_v5_mpj5_minidiscourse_v8_relational_feedback";
    const multi = savedV8.mpj_items[4];
    if (multi.type !== "multi_judge") throw new Error("Expected multi_judge");
    multi.candidates.forEach((candidate) => { delete candidate.comparison_role; });
    expect(checkMission(savedV8, context).violations.filter(
      (item) => item.id === "R5" && item.level === "fail",
    )).toEqual([]);

    multi.candidates.forEach((candidate, index) => {
      candidate.accepted_band_codes = [index === 0 ? "within_band" : "too_direct"];
    });
    expect(checkMission(savedV8, context).violations.some(
      (item) => item.id === "R5" && item.level === "fail" && item.message.includes("적정 2·조정 필요 2"),
    )).toBe(true);
  });

  it.each([
    "mission_v5_mpj5_minidiscourse_v15_zhko_bidirectional_lock",
    "mission_v5_mpj5_minidiscourse_v16_natural_scene",
    "another_prompt_with_the_same_saved_contract",
  ])("preserves saved bands and shared Anchor independently of prompt %s", (promptVersion) => {
    const saved = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    saved.provenance!.prompt_version = promptVersion;
    saved.learning_goal = { kind: "speech_act", speech_act: "request" };
    saved.contrast_plan = {
      version: "contrast_plan_v1", speech_act: "request", mission_goal: "integrated_speech_act",
      item_slots: saved.mpj_items.map(item => ({ item_id: item.id, item_type: item.type,
        item_focus: item.axis_feature, intended_band_profile: "saved" })),
    };
    const multi = saved.mpj_items[4];
    if (multi.type !== "multi_judge") throw new Error("Expected multi_judge");
    multi.candidates.forEach(candidate => { delete candidate.comparison_role; });
    const before = structuredClone(saved);
    const failures = () => checkMission(saved, context).violations.filter(v =>
      v.level === "fail" && (v.id === "R5" || v.id === "R27"));
    expect(failures()).toEqual([]);
    expect(saved).toEqual(before);
    saved.mpj_items[2].situation_ko = saved.mpj_items[0].situation_ko;
    expect(failures().some(v => v.id === "R27" && v.message.includes("Anchor A"))).toBe(true);
    multi.candidates.forEach(c => { c.accepted_band_codes = ["too_direct"]; });
    expect(failures().some(v => v.id === "R5")).toBe(true);
  });

  it("requires concise two-sentence scenes and one recommended repair in the current native flow", () => {
    const current = structuredClone(nativeFixture());
    current.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    expect(checkMission(current, context).violations.filter(
      (item) => item.level === "fail" && (item.id === "R3" || item.id === "R27"),
    )).toEqual([]);

    const invalidRepair = structuredClone(current);
    const fix = invalidRepair.mpj_items[2];
    if (fix.type !== "fix_choice") throw new Error("Expected fix_choice");
    fix.corrections[1].is_valid = true;
    expect(checkMission(invalidRepair, context).violations.some(
      (item) => item.id === "R3" && item.level === "fail",
    )).toBe(true);

    const verboseScene = structuredClone(current);
    verboseScene.mpj_items[0].situation_ko += " 추가 설명을 길게 덧붙인다.";
    expect(checkMission(verboseScene, context).violations.some(
      (item) => item.id === "R27" && item.level === "fail" && item.message.includes("정확히 2문장"),
    )).toBe(true);

    const verboseProduction = structuredClone(current);
    verboseProduction.production_task.situation_ko += " 교수자가 승인한 추가 맥락은 그대로 유지한다.";
    expect(checkMission(verboseProduction, context).violations.some(
      (item) => item.id === "R27" && item.level === "warning" && item.message.includes("production_task"),
    )).toBe(true);
  });

  it("requires two acceptable and two adjustment-needed candidates without duplicates", () => {
    for (const acceptableCount of [1, 3]) {
      const current = structuredClone(nativeFixture());
      current.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
      const multi = current.mpj_items[4];
      if (multi.type !== "multi_judge") throw new Error("Expected multi_judge");
      multi.candidates.forEach((candidate, index) => {
        delete candidate.comparison_role;
        candidate.accepted_band_codes = [index < acceptableCount ? "within_band" : "too_direct"];
      });

      expect(checkMission(current, context).violations.some(
        (item) => item.id === "R5" && item.level === "fail"
          && item.message.includes("4후보·적정 2·조정 필요 2"),
      )).toBe(true);
    }

    const duplicate = structuredClone(nativeFixture());
    duplicate.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    const duplicateMulti = duplicate.mpj_items[4];
    if (duplicateMulti.type !== "multi_judge") throw new Error("Expected multi_judge");
    duplicateMulti.candidates[1].text = `${duplicateMulti.candidates[0].text}！`;

    expect(checkMission(duplicate, context).violations.some(
      (item) => item.id === "R5" && item.level === "fail" && item.message.includes("후보 문장이 중복"),
    )).toBe(true);
  });

  it("rejects a native judge outside the anchor or assigned to within_band", () => {
    const current = nativeFixture();
    const judge = current.mpj_items[1];
    const checked = checkMission({
      ...current,
      mpj_items: [
        current.mpj_items[0],
        {
          ...judge,
          pdr: { p: "equal", d: "close", r: "low" },
          accepted_band_codes: ["within_band"],
        },
        ...current.mpj_items.slice(2),
      ],
    }, context);

    expect(checked.violations.filter((item) => item.id === "R2" && item.level === "fail")).toHaveLength(2);
  });

  it("does not allow the current native prompt version on a legacy four-item payload", () => {
    const checked = checkMission({
      ...SAMPLE_MISSION_V5,
      provenance: {
        ...SAMPLE_MISSION_V5.provenance!,
        prompt_version: CURRENT_MISSION_PROMPT_VERSIONS[0],
      },
    }, context);

    expect(checked.violations.some(
      (item) => item.id === "R1" && item.message.includes("MJT5"),
    )).toBe(true);
  });

  it("requires grounded multidimensional coverage only for the current native prompt", () => {
    const missing = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    missing.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    delete missing.diagnostic_dimensions;

    expect(checkMission(missing, context).violations.some(
      (item) => item.id === "R33" && item.level === "fail",
    )).toBe(true);

    const valid = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    valid.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    expect(checkMission(valid, context).violations.filter((item) => item.id === "R33")).toEqual([]);
  });

  it("rejects duplicate dimension codes and evidence concentrated in one location", () => {
    const invalid = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    invalid.provenance!.prompt_version = CURRENT_MISSION_PROMPT_VERSIONS[0];
    invalid.diagnostic_dimensions = [
      {
        code: "force_calibration",
        evidence_refs: ["mpj:1"],
        evidence_ko: "첫 문항 근거",
      },
      {
        code: "force_calibration",
        evidence_refs: ["mpj:1"],
        evidence_ko: "같은 위치를 중복 선언한 근거",
      },
    ];

    const r33 = checkMission(invalid, context).violations.filter((item) => item.id === "R33");
    expect(r33.some((item) => item.message.includes("중복 없는"))).toBe(true);
    expect(r33.some((item) => item.message.includes("최소 두 위치"))).toBe(true);
  });
});
