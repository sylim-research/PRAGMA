import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { checkCore, checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import {
  ACTIVE_RULE_IDS,
  QUALITY_RULE_CATALOG,
  QUALITY_RULE_CATEGORIES,
  QUALITY_RULE_IDS_IN_CATALOG,
  RETIRED_MISSION_RULE_IDS,
  RETIRED_QUALITY_RULES,
} from "@/lib/pragma/qualityRuleCatalog";

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

const baseCore = {
  schema_version: "scenario_core_v1",
  situation_ko: "거래처 담당자에게 일정 변경 요청을 글로 작성해 보낸다.",
  relation_ko: "거래처 담당자와 실무자 관계",
  source_modality: "written",
  source_text_ko: "회의를 하루 앞당길 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
  channel: "messenger",
};

describe("품질 점검 규칙 카탈로그 — 설명층과 실행 ID의 대응", () => {
  it("현행 규칙 ID마다 설명이 하나씩 있고 retired 번호는 실행 목록에 없다", () => {
    // 누락 자체는 Record<RuleId, …> 타입이 컴파일 시점에 막는다. 여기서는 순서·집합만 확인한다.
    expect([...QUALITY_RULE_IDS_IN_CATALOG].sort()).toEqual([...ACTIVE_RULE_IDS].sort());
    for (const retired of RETIRED_MISSION_RULE_IDS) {
      expect(ACTIVE_RULE_IDS as readonly string[]).not.toContain(retired);
      expect(RETIRED_QUALITY_RULES[retired].retired_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("7개 설명 범주가 각각 최소 한 규칙을 가진다", () => {
    const used = new Set(Object.values(QUALITY_RULE_CATALOG).map((rule) => rule.category));
    expect([...used].sort()).toEqual([...QUALITY_RULE_CATEGORIES].sort());
  });

  it("신호(signal) 규칙은 설명에 교수자 확인 또는 warning을 명시한다", () => {
    for (const [id, rule] of Object.entries(QUALITY_RULE_CATALOG)) {
      if (rule.nature !== "signal") continue;
      expect(rule.summary_ko, id).toMatch(/warning|교수자 확인/);
    }
  });

  it("실행 결과가 내는 violation.id는 전부 현행 ID 집합 안에 있다", () => {
    const active = new Set<string>(ACTIVE_RULE_IDS);
    const emitted = new Set<string>();

    const brokenMission = structuredClone(SAMPLE_MISSION_V5_NATIVE) as Record<string, unknown>;
    delete brokenMission.provenance;
    const missions: unknown[] = [SAMPLE_MISSION_V5_NATIVE, brokenMission, { schema_version: "mission_v5" }];
    for (const mission of missions) {
      for (const violation of checkMission(mission, context).violations) emitted.add(violation.id);
    }
    const cores: unknown[] = [
      baseCore,
      { ...baseCore, situation_ko: "중국인들은 항상 간접 표현을 좋아한다. 정중하게 요청한다." },
      { ...baseCore, source_modality: "spoken" },
      { schema_version: "scenario_core_v1" },
    ];
    for (const core of cores) {
      for (const violation of checkCore(core, { ...context, require_context_spec: true }).violations) emitted.add(violation.id);
    }

    expect(emitted.size).toBeGreaterThan(5);
    for (const id of emitted) expect(active.has(id), id).toBe(true);
  });
});
