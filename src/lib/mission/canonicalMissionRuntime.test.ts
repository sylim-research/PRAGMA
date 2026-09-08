import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import type { RunnableMission } from "@/lib/mission/missionDb";
import { adaptRunnableMissionToCanonical, compactLearnerScenario } from "@/lib/mission/canonicalMissionRuntime";
import { comparisonCandidateLabel } from "./canonicalMissionPreview";

function runnable(): RunnableMission {
  return {
    scenario_id: "86d738b0-1891-4bfe-9b12-f8643ebbb45f",
    speech_act: "request",
    learner_level: "intermediate",
    mission_status: "reviewed",
    release_gate_mode: "legacy_reviewed",
    direction: "ko_zh",
    mission: SAMPLE_MISSION_V5,
  };
}

function asRefusal<T>(mission: T): T {
  return JSON.parse(
    JSON.stringify(mission)
      .split("request_mitigation_optionality").join("refusal_softening")
      .split("too_direct").join("too_blunt")
      .split("too_indirect").join("over_elaborate"),
  ) as T;
}

describe("canonical mission runtime bridge", () => {
  it("keeps legacy mission_v5 readable by splitting its combined judgment and correction", () => {
    const view = adaptRunnableMissionToCanonical(runnable());

    expect(view.scenarioId).toBe("86d738b0-1891-4bfe-9b12-f8643ebbb45f");
    expect(view.speechAct).toBe("요청");
    expect(view.quests.map((quest) => quest.kind)).toEqual([
      "scale",
      "scale",
      "fix_choice",
      "reason",
      "best_worst",
      "dct",
      "dct_feedback",
    ]);
    expect(view.quests.slice(0, 5).map((quest) => quest.id)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(view.lessonPoints).toHaveLength(5);
    expect(view.quests[2]).toMatchObject({ kind: "fix_choice", judgmentQuestId: "A2" });
    if (view.quests[2].kind !== "fix_choice") throw new Error("Expected fix-choice quest");
    expect(view.quests[2].corrections).toHaveLength(3);
    expect(view.quests[2].corrections.filter((candidate) => candidate.valid)).toHaveLength(1);
    expect(view.quests[1].source).toBe(view.quests[2].source);
    if (view.quests[1].kind !== "scale") throw new Error("Expected contrast scale quest");
    expect(view.quests[1].options).toEqual([
      { id: "too_direct", label: "너무 직접적", description: "상황에 비해 단정적" },
      { id: "within_band", label: "현재 상황에 맞음", description: "관계·거리·부담에 맞는 조절" },
      { id: "too_indirect", label: "지나치게 우회적", description: "요청이 흐려짐" },
    ]);
    expect(view.quests[5].source).toBe(SAMPLE_MISSION_V5.production_task.source_text);
    expect(view.lessonPoints.every((point) => point.text.includes("「"))).toBe(true);
    expect(view.lessonPoints.every((point) => point.text.length <= 56)).toBe(true);
    expect(view.lessonPoints.every((point) => (point.text.match(/→/g) ?? []).length === 1)).toBe(true);
    expect(view.lessonPoints.every((point) => !point.text.includes(" / "))).toBe(true);
    expect(view.lessonPoints[4].text).toContain("적정안");
    expect(view.lessonPoints[4].text).not.toContain("조정안");
  });

  it("keeps legacy response-act preceding turns readable", () => {
    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      speech_act: "refusal",
      mission: asRefusal(SAMPLE_MISSION_V5),
    });

    expect(view.quests[0].context.precedingTurn).toBe(SAMPLE_MISSION_V5.mpj_items[0].preceding_turn);
  });

  it("maps native mission_v5 MPJ5 items one-to-one without splitting an item", () => {
    const nativeWithHistoricalTurn = asRefusal(structuredClone(SAMPLE_MISSION_V5_NATIVE));
    nativeWithHistoricalTurn.mpj_items[0].preceding_turn = "화면에 표시하면 안 되는 과거 값";
    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      speech_act: "refusal",
      mission: nativeWithHistoricalTurn,
    });

    expect(view.quests.map((quest) => quest.kind)).toEqual([
      "scale",
      "scale",
      "fix_choice",
      "reason",
      "best_worst",
      "dct",
      "dct_feedback",
    ]);
    expect(view.quests.slice(0, 5).map((quest) => quest.source)).toEqual(
      SAMPLE_MISSION_V5_NATIVE.mpj_items.map((item) => item.source),
    );
    expect(view.quests[2]).toMatchObject({ kind: "fix_choice" });
    expect(view.quests[2]).not.toHaveProperty("judgmentQuestId");
    if (view.quests[2].kind !== "fix_choice") throw new Error("Expected fix-choice quest");
    expect(view.quests[2].corrections).toHaveLength(3);
    expect(view.quests[2].corrections.filter((candidate) => candidate.valid)).toHaveLength(1);
    expect(view.quests.slice(0, 5).every((quest) => quest.context.precedingTurn === undefined)).toBe(true);
    expect(view.quests[3]).toMatchObject({
      kind: "reason",
      prompt: "이 표현은 이 상황에 적절한가요?",
      referenceJudgment: "inappropriate",
    });
    expect(view.quests[4]).toMatchObject({ kind: "best_worst" });
    if (view.quests[4].kind !== "best_worst") throw new Error("Expected best/worst quest");
    expect(view.quests[4].candidates).toHaveLength(4);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "best")).toHaveLength(1);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "worst")).toHaveLength(1);
  });

  it("runs a zh_ko translation with a Korean DCT target without changing the MPJ5 flow", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.direction = "zh_ko";
    mission.production_task.source_text = "方便的话，请把修改意见发给我。";
    mission.production_task.reference_alternatives = [
      { text: "괜찮으시면 수정 의견을 보내 주세요.", note_ko: "요청의 선택 가능성을 유지한다." },
    ];

    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      direction: "zh_ko",
      mission,
    });

    expect(view.direction).toBe("중국어 → 한국어");
    expect(view.sourceLanguage).toEqual({ code: "zh", label: "중국어", badge: "ZH" });
    expect(view.targetLanguage).toEqual({ code: "ko", label: "한국어", badge: "KO" });
    expect(view.quests.map((quest) => quest.kind)).toEqual([
      "scale",
      "scale",
      "fix_choice",
      "reason",
      "best_worst",
      "dct",
      "dct_feedback",
    ]);
    expect(view.quests[5]).toMatchObject({
      kind: "dct",
      source: "方便的话，请把修改意见发给我。",
      prompt: "이 말을 한국어로 옮겨 보세요.",
      referenceAnswer: "괜찮으시면 수정 의견을 보내 주세요.",
    });
  });

  it("runs zh_ko interpreting with Chinese TTS input and Korean STT output metadata", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.direction = "zh_ko";
    mission.production_task.mode = "interpreting";
    mission.production_task.source_modality = "spoken";
    mission.production_task.source_text = "方便的话，请把修改意见发给我。";
    mission.production_task.replay_limit = 2;
    mission.production_task.reference_alternatives = [
      { text: "괜찮으시면 수정 의견을 보내 주세요.", note_ko: "요청의 선택 가능성을 유지한다." },
    ];

    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      direction: "zh_ko",
      mission,
    });

    expect(view.activityMode).toBe("interpreting");
    expect(view.sourceLanguage.code).toBe("zh");
    expect(view.targetLanguage.code).toBe("ko");
    expect(view.quests[5]).toMatchObject({
      kind: "dct",
      prompt: "원발화를 듣고 한국어로 통역해 보세요.",
      replayLimit: 2,
      vocabularyHints: [],
    });
  });

  it("maps the current contrast plan to two acceptable and two adjustment-needed choices", () => {
    const current = structuredClone(SAMPLE_MISSION_V5_NATIVE) as typeof SAMPLE_MISSION_V5_NATIVE & {
      contrast_plan: {
        version: "contrast_plan_v1";
        speech_act: string;
        mission_goal: "integrated_speech_act";
        item_slots: Array<{ item_id: number; item_type: string; item_focus: string; intended_band_profile: string }>;
      };
    };
    current.contrast_plan = {
      version: "contrast_plan_v1",
      speech_act: "request",
      mission_goal: "integrated_speech_act",
      item_slots: current.mpj_items.map((item, index) => ({
        item_id: index + 1,
        item_type: item.type,
        item_focus: item.axis_feature,
        intended_band_profile: "fixture",
      })),
    };
    const view = adaptRunnableMissionToCanonical({ ...runnable(), mission: current });
    const comparison = view.quests[4];
    if (comparison.kind !== "best_worst") throw new Error("Expected comparison quest");
    expect(comparison.prompt).toContain("알맞은 표현 1개와 조정이 필요한 표현 1개");
    expect(comparison.candidates.filter((candidate) => candidate.role === "best")).toHaveLength(2);
    expect(comparison.candidates.filter((candidate) => candidate.role === "worst")).toHaveLength(2);
    expect(comparison.comparisonMode).toBe("band_pair");
    expect(comparisonCandidateLabel(comparison, "best")).toBe("상황에 적절한 표현");
    expect(comparisonCandidateLabel(comparison, "worst")).toBe("조정이 필요한 표현");
    expect(comparisonCandidateLabel({ ...comparison, comparisonMode: "ranked" }, "best")).toBe("BEST · 가장 적절");
  });

  it("projects historical learner scenes to two concise, non-meta sentences", () => {
    const compact = compactLearnerScenario(
      "알고 지내는 후배가 식당 예약 변경을 부탁했다. 글로 작성해 보내며 즉시 반응을 기대하지 않는 기록형 요청이다. 변경을 처리하려면 운영자인 내가 확인해야 한다.",
    );

    expect(compact).toBe("알고 지내는 후배가 식당 예약 변경을 부탁했다. 변경을 처리하려면 운영자인 내가 확인해야 한다.");
    expect(compact).not.toContain("즉시 반응");
  });
});
