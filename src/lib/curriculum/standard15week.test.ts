// 공통 표준 15주 골격 dry-run (2026-07-25). 방향2 × 수준3 × 프리셋(전체) 조합에서
// 빈 주차·화행 누락·검증 오류가 없는지 확인한다. 골격은 매개변수 독립(공통)이므로
// 모든 조합이 동일 구조를 내되, 각 조합의 outline으로 검증까지 통과해야 한다.

import { describe, it, expect } from "vitest";
import {
  createStandard15WeekTemplate,
  STANDARD_TARGET_ACTS,
  STANDARD_MIDTERM_WEEK,
  STANDARD_FINAL_WEEK,
} from "@/lib/curriculum/template";
import { createEmptyOutlineDraft } from "@/lib/curriculum/mappers";
import { validateCurriculum } from "@/lib/curriculum/validate";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";
import type { LearnerLevel, LanguageDirection, SpeechActUI } from "@/lib/pragma/enums";

const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const DIRECTIONS: LanguageDirection[] = ["ko_zh", "zh_ko"];
const REGULAR_ACT_WEEKS = [2, 3, 4, 5, 6, 9, 10, 11, 12];
const NO_ACT_WEEKS = [7, 13, 14]; // 13주의 화행은 교강사가 나중에 선택한다.

describe("표준 15주 골격 구조", () => {
  it("15주 · 9화행 각 1회 · 통합주 화행 없음 · OT/중간/기말 위치", () => {
    const weeks = createStandard15WeekTemplate();
    expect(weeks).toHaveLength(15);
    expect(weeks[0].type).toBe("orientation");
    expect(weeks[STANDARD_MIDTERM_WEEK - 1].type).toBe("midterm");
    expect(weeks[STANDARD_FINAL_WEEK - 1].type).toBe("final");

    const acts = REGULAR_ACT_WEEKS.map((n) => weeks[n - 1].speech_act).filter(Boolean) as SpeechActUI[];
    expect(acts).toHaveLength(9);
    expect(new Set(acts).size).toBe(9); // 정확히 1회씩
    expect([...acts].sort()).toEqual([...STANDARD_TARGET_ACTS].sort());

    for (const n of NO_ACT_WEEKS) {
      expect(weeks[n - 1].type).toBe("regular");
      expect(weeks[n - 1].speech_act).toBeNull();
    }
  });
});

describe("30조합 dry-run — 방향2 × 수준3 × 프리셋", () => {
  const combos: { preset: string; level: LearnerLevel; direction: LanguageDirection }[] = [];
  for (const p of COURSE_PRESETS) {
    for (const level of LEVELS) {
      for (const direction of DIRECTIONS) {
        combos.push({ preset: p.preset_code, level, direction });
      }
    }
  }

  it(`조합 수 = 프리셋${COURSE_PRESETS.length} × 수준3 × 방향2`, () => {
    expect(combos.length).toBe(COURSE_PRESETS.length * 3 * 2);
  });

  it("모든 조합에서 검증 오류 0 · 빈 주차 0 · 9화행 누락 0", () => {
    for (const { preset, level, direction } of combos) {
      const outline = {
        ...createEmptyOutlineDraft(),
        title: `dry-${preset}-${level}-${direction}`,
        level,
        language_direction: direction,
        midterm_week: STANDARD_MIDTERM_WEEK,
        final_week: STANDARD_FINAL_WEEK,
        target_speech_acts: [...STANDARD_TARGET_ACTS],
      };
      const weeks = createStandard15WeekTemplate();
      const result = validateCurriculum(outline, weeks);
      if (result.errors.length) {
        console.log(`FAIL ${preset}/${level}/${direction}:`, JSON.stringify(result.errors));
      }
      expect(result.errors).toEqual([]);
      // 빈 주차 없음(15개 전부 존재) + 9화행 배치
      expect(weeks).toHaveLength(15);
      const acts = weeks.filter((w) => w.type === "regular" && w.speech_act).map((w) => w.speech_act);
      expect(new Set(acts).size).toBe(9);
    }
  });
});
