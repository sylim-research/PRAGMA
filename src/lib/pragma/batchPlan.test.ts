import { describe, expect, it } from "vitest";
import {
  auditTopicCompatibility,
  auditTopicCoverage,
  buildBatchPlan,
  buildZhKoValidationPlan,
  productionModeCounts,
  FULL_BATCH_QUOTA_495,
  PDR_CONSTRUCT_CELLS,
  summarizePlan,
  ZH_KO_ANCHOR_ACTS,
  ZH_KO_EXPANSION_ACTS,
  ZH_KO_VALIDATION_ACTS,
  ZH_KO_VALIDATION_DELIVERY_CELLS,
} from "@/lib/pragma/batchPlan";
import {
  getScenarioTopic,
  isThemeDomainValid,
  SCENARIO_TOPICS,
  THEME_CODES,
  topicSupportsContext,
  type ScenarioTopic,
} from "@/lib/pragma/scenarioTopics";

describe("topic coverage audit", () => {
  it("excludes retired travel metadata from new production while preserving stored-topic validation", () => {
    expect(THEME_CODES).not.toContain("travel_mobility");
    expect(SCENARIO_TOPICS.some(topic => topic.code === "hotel_request")).toBe(false);
    expect(buildBatchPlan().some(cell => cell.theme_code === ("travel_mobility" as string))).toBe(false);
    expect(getScenarioTopic("hotel_request")?.themeCode).toBe("travel_mobility");
    expect(isThemeDomainValid("travel_mobility", "daily")).toBe(true);
    expect(isThemeDomainValid("travel_mobility", "work")).toBe(false);
  });
  it("has no blocking speech-act/domain gaps after the approved work seeds", () => {
    const audit = auditTopicCoverage();

    expect(audit.missing).toEqual([]);
    expect(audit.wildcardOnly).toEqual([]);
  });

  it("distinguishes a blocking gap from wildcard-only coverage", () => {
    const topics: ScenarioTopic[] = [
      {
        code: "school_wildcard",
        labelKo: "학교 중립 시드",
        themeCode: "campus_study",
        allowedDomains: ["school"],
        situationSeedKo: "학교에서 생기는 상호작용",
      },
    ];

    expect(auditTopicCoverage(["refusal"], ["school", "work"], topics)).toEqual({
      missing: [{ speechAct: "refusal", domain: "work" }],
      wildcardOnly: [{ speechAct: "refusal", domain: "school" }],
    });
  });

  it("builds the current full plan without silent topic fallback", () => {
    const plan = buildBatchPlan();

    expect(plan).not.toHaveLength(0);
    for (const cell of plan) {
      const topic = getScenarioTopic(cell.topic_code);
      expect(topic?.allowedSpeechActs).toContain(cell.speech_act_ui);
    }
  });

  it("has no topic gaps across speech act, P, D, mode, and domain", () => {
    expect(auditTopicCompatibility()).toEqual([]);
  });

  it("keeps role-bound topics out of contradictory P/D cells", () => {
    const professorRequest = getScenarioTopic("deadline_extension");
    const directionHelp = getScenarioTopic("direction_help");
    expect(professorRequest).toBeDefined();
    expect(directionHelp).toBeDefined();

    expect(
      topicSupportsContext(professorRequest!, {
        speechAct: "request",
        domain: "school",
        power: "lower",
        distance: "acquaintance",
        mode: "translation",
      }),
    ).toBe(false);
    expect(
      topicSupportsContext(directionHelp!, {
        speechAct: "request",
        domain: "daily",
        power: "equal",
        distance: "close",
        mode: "stt_interpreting",
      }),
    ).toBe(false);
  });

  it("keeps actor direction and speech-act branches in separate topic seeds", () => {
    const neighborRequest = getScenarioTopic("neighbor_noise");
    const neighborApology = getScenarioTopic("neighbor_noise_apology");
    const feedbackOpposition = getScenarioTopic("comment_feedback_disagreement");
    const contentCompliment = getScenarioTopic("content_strength_compliment");

    expect(neighborRequest?.allowedSpeechActs).toEqual(["request", "complaint"]);
    expect(neighborRequest?.situationSeedKo).toContain("상대 이웃이 낸");
    expect(neighborApology?.allowedSpeechActs).toEqual(["apology"]);
    expect(neighborApology?.situationSeedKo).toContain("화자 본인의 집");
    expect(feedbackOpposition?.allowedSpeechActs).toEqual(["opposition"]);
    expect(contentCompliment?.allowedSpeechActs).toEqual(["compliment"]);
  });
});

describe("absolute production counts", () => {
  it("preserves exact totals including an uneven split and either single mode", () => {
    const counts = {
      beginner_intermediate: productionModeCounts(18, 0),
      intermediate: productionModeCounts(10, 30),
      advanced: productionModeCounts(18, 100),
    };
    const plan = buildBatchPlan({
      perLevel: { beginner_intermediate: 0, intermediate: 0, advanced: 0 },
      interpretingRatio: 0,
      perLevelModeCounts: counts,
    });
    expect(plan).toHaveLength(46);
    expect(plan.filter(cell => cell.level === "beginner_intermediate" && cell.mode === "translation")).toHaveLength(18);
    expect(plan.filter(cell => cell.level === "beginner_intermediate" && cell.mode === "stt_interpreting")).toHaveLength(0);
    expect(plan.filter(cell => cell.level === "intermediate" && cell.mode === "translation")).toHaveLength(7);
    expect(plan.filter(cell => cell.level === "intermediate" && cell.mode === "stt_interpreting")).toHaveLength(3);
    expect(plan.filter(cell => cell.level === "advanced" && cell.mode === "stt_interpreting")).toHaveLength(18);
    expect(plan.filter(cell => cell.level === "advanced" && cell.mode === "translation")).toHaveLength(0);
    expect(productionModeCounts(3, 50)).toEqual({ translation: 1, stt_interpreting: 2 });
    expect(productionModeCounts(0, 100)).toEqual({ translation: 0, stt_interpreting: 0 });
  });
});

describe("construct matrix coverage", () => {
  it("contains all 27 unique P/D/R combinations", () => {
    const unique = new Set(
      PDR_CONSTRUCT_CELLS.map((cell) => `${cell.p}|${cell.d}|${cell.r}`),
    );
    expect(unique.size).toBe(27);
  });

  it("covers all 243 speech-act × P × D × R cells in the 495 plan", () => {
    const plan = buildBatchPlan(FULL_BATCH_QUOTA_495);
    const summary = summarizePlan(plan);

    expect(summary.total).toBe(495);
    expect(summary.emptyActPdrCells).toEqual([]);
    expect(summary.minActPdrCount).toBeGreaterThanOrEqual(2);
  });

  it("does not lock each domain to one power value", () => {
    const plan = buildBatchPlan(FULL_BATCH_QUOTA_495);

    for (const domain of ["daily", "school", "work"] as const) {
      expect(new Set(plan.filter((cell) => cell.domain === domain).map((cell) => cell.pdr_power)))
        .toEqual(new Set(["equal", "higher", "lower"]));
    }
  });

  it("keeps daily·school·work at 1:1:1 inside every level of the 495 plan", () => {
    const plan = buildBatchPlan(FULL_BATCH_QUOTA_495);

    for (const level of ["beginner_intermediate", "intermediate", "advanced"] as const) {
      const inLevel = plan.filter((cell) => cell.level === level);
      const counts = ["daily", "school", "work"].map(
        (domain) => inLevel.filter((cell) => cell.domain === domain).length,
      );
      expect(new Set(counts).size).toBe(1);
    }
  });

  it("rotates all seven job functions only inside work cells", () => {
    const plan = buildBatchPlan(FULL_BATCH_QUOTA_495);
    const workFunctions = new Set(
      plan.filter((cell) => cell.domain === "work").map((cell) => cell.business_function),
    );

    expect(workFunctions).toEqual(new Set([
      "overseas_sales",
      "marketing_pr",
      "customer_partner_support",
      "SCM_logistics",
      "project_coordination",
      "localization_translation",
      "international_collaboration",
    ]));
    expect(plan.filter((cell) => cell.domain !== "work").every(
      (cell) => cell.business_function === null,
    )).toBe(true);
  });
});

describe("zh_ko nine-act validation pilot", () => {
  it("builds the approved 30-cell mixed delivery plan", () => {
    const plan = buildZhKoValidationPlan();
    const summary = summarizePlan(
      plan,
      ZH_KO_VALIDATION_ACTS,
      ZH_KO_VALIDATION_DELIVERY_CELLS,
    );

    expect(plan).toHaveLength(30);
    expect(summary.total).toBe(30);
    expect(summary.byDirection).toEqual({ zh_ko: 30 });
    expect(summary.translation).toBe(15);
    expect(summary.interpreting).toBe(15);
    expect(summary.byLevel).toEqual({
      beginner_intermediate: 6,
      intermediate: 18,
      advanced: 6,
    });
    expect(summary.emptyActLevelCells).toEqual([]);
    expect(summary.emptyActLevelModeCells).toEqual([]);
    expect(summary.minActLevelModeCount).toBe(1);
  });

  it("keeps three anchors across all levels and adds six acts at intermediate", () => {
    const plan = buildZhKoValidationPlan();

    expect(new Set(plan.map((cell) => cell.speech_act_ui))).toEqual(
      new Set(ZH_KO_VALIDATION_ACTS),
    );
    for (const act of ZH_KO_ANCHOR_ACTS) {
      const cells = plan.filter((cell) => cell.speech_act_ui === act);
      expect(cells).toHaveLength(6);
      expect(new Set(cells.map((cell) => cell.level))).toEqual(
        new Set(["beginner_intermediate", "intermediate", "advanced"]),
      );
      expect(new Set(cells.map((cell) => cell.mode))).toEqual(
        new Set(["translation", "stt_interpreting"]),
      );
    }
    for (const act of ZH_KO_EXPANSION_ACTS) {
      const cells = plan.filter((cell) => cell.speech_act_ui === act);
      expect(cells).toHaveLength(2);
      expect(new Set(cells.map((cell) => cell.level))).toEqual(new Set(["intermediate"]));
      expect(new Set(cells.map((cell) => cell.mode))).toEqual(
        new Set(["translation", "stt_interpreting"]),
      );
    }
  });

  it("is deterministic and uses compatible topic seeds", () => {
    const plan = buildZhKoValidationPlan();

    expect(plan).toEqual(buildZhKoValidationPlan());
    for (const cell of plan) {
      const topic = getScenarioTopic(cell.topic_code);
      expect(topic?.allowedSpeechActs).toContain(cell.speech_act_ui);
      expect(
        topicSupportsContext(topic!, {
          speechAct: cell.speech_act_ui,
          domain: cell.domain,
          power: cell.pdr_power,
          distance: cell.pdr_distance,
          mode: cell.mode,
        }),
      ).toBe(true);
    }
  });
});
