import { describe, expect, it } from "vitest";
import { coreLearnerSceneIssue } from "../../../supabase/functions/_shared/coreSourceRepair";
import { checkMission } from "./missionRules";
import { SAMPLE_MISSION_V5_NATIVE } from "../mission/missionV4Sample";

describe("learner scene review signals", () => {
  it.each([
    "요청을 검토하는 데 부담이 크지 않도록 배려하며 글로 전달합니다.",
    "상대가 부담없이 결정할 수 있도록 정중한 표현을 사용해야 합니다.",
    "상대가 부담 없이 검토할 수 있도록 간단하게 표현해야 한다.",
  ])("flags directions about the answer: %s", (text) => {
    expect(coreLearnerSceneIssue(text)).not.toBeNull();
  });

  it.each([
    "교수님은 아직 자기소개서 검토를 맡기로 하지 않았습니다.",
    "동료가 행사 준비를 도와주며 배려해 주었습니다. 그 일에 감사를 전합니다.",
    "서로 몇 차례 인사한 이웃입니다. 택배를 대신 받아 달라고 부탁합니다.",
  ])("keeps factual context without banning isolated words: %s", (text) => {
    expect(coreLearnerSceneIssue(text)).toBeNull();
  });

  it("checks judgment and production scenes, without turning the signal into a failure", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.mpj_items[0].situation_ko = "이웃에게 부탁합니다. 부담이 크지 않도록 배려하며 글로 전달합니다.";
    mission.production_task.situation_ko = "동료에게 부탁합니다. 정중한 표현을 사용해야 합니다.";
    const result = checkMission(mission, { speech_act: "request", level: "intermediate", domain: "daily", mode: "translation", theme_code: "daily_living", topic_code: "borrow_favor", source_modality: "written" });
    const signals = result.violations.filter((item) => item.id === "R30");
    expect(signals.some((item) => item.message.startsWith("MJT 1"))).toBe(true);
    expect(signals.some((item) => item.message.startsWith("DCT"))).toBe(true);
    expect(signals.every((item) => item.level === "warning")).toBe(true);
  });
});
