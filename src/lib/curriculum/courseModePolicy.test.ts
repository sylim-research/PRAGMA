import { describe, expect, it } from "vitest";

import {
  MISSION_WEEK_NOS,
  courseModeSummary,
  courseModePolicyFromLegacyRatio,
  expectedMissionModesForWeek,
  remainingMissionModes,
} from "@/lib/curriculum/courseModePolicy";

describe("강좌 수행 모드 정책", () => {
  it("교과목은 주수 대신 수행 유형을 표시한다", () => {
    expect(courseModeSummary({ courseMode: "mixed", interpretingWeekCount: 3 })).toBe("통번역 반반");
    expect(courseModeSummary({ courseMode: "translation" })).toBe("번역");
    expect(courseModeSummary({ courseMode: "interpreting" })).toBe("통역");
  });

  it("전용 강좌는 같은 모드의 두 완결 미션을 유지한다", () => {
    expect(expectedMissionModesForWeek({ courseMode: "translation" }, 2)).toEqual(["translation", "translation"]);
    expect(expectedMissionModesForWeek({ courseMode: "interpreting" }, 2)).toEqual(["stt_interpreting", "stt_interpreting"]);
  });

  it.each([0, 3, 6, 12])("과거 %i주 값과 관계없이 모든 화행·보완 주차에 번역·통역을 하나씩 둔다", (count) => {
    for (const weekNo of MISSION_WEEK_NOS) {
      expect(expectedMissionModesForWeek({ courseMode: "mixed", interpretingWeekCount: count }, weekNo))
        .toEqual(["translation", "stt_interpreting"]);
    }
  });

  it("OT·클리닉·시험 주차에는 새 미션 슬롯을 만들지 않는다", () => {
    for (const weekNo of [1, 7, 8, 14, 15]) {
      expect(expectedMissionModesForWeek({ courseMode: "mixed" }, weekNo)).toEqual([]);
    }
  });

  it("부분 편성은 남은 모드를 계산하고 같은 모드의 정원 초과는 거부한다", () => {
    const modes = expectedMissionModesForWeek({ courseMode: "mixed" }, 2);
    expect(remainingMissionModes(modes, ["stt_interpreting"])).toEqual(["translation"]);
    expect(remainingMissionModes(modes, ["stt_interpreting", "translation"])).toEqual([]);
    expect(remainingMissionModes(modes, ["translation", "translation"])).toBeNull();
    expect(remainingMissionModes([], ["translation"])).toBeNull();
  });

  it("legacy 비율은 가장 가까운 12주 정수 정책으로만 읽는다", () => {
    expect(courseModePolicyFromLegacyRatio(0)).toEqual({
      courseMode: "translation",
      interpretingWeekCount: 0,
    });
    expect(courseModePolicyFromLegacyRatio(0.3)).toEqual({
      courseMode: "mixed",
      interpretingWeekCount: 4,
    });
    expect(courseModePolicyFromLegacyRatio(1)).toEqual({
      courseMode: "interpreting",
      interpretingWeekCount: 12,
    });
  });
});
