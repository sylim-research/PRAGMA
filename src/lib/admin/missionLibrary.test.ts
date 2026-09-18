import { describe, expect, it } from "vitest";
import { libraryMissionIsReady } from "./missionLibrary";

const approved = (schema: string, items = 5) => ({
  mission_status: "reviewed",
  mission_schema_version: schema,
  mission_mpj_items: Array.from({ length: items }, () => ({})),
  core_content: { generation: { content_release_id: "pragma_zhko_bidirectional_candidate_20260904_02" } },
});

describe("libraryMissionIsReady", () => {
  // 편성기(composer.ts is_native_mpj5)와 같은 기준: v5·v6 모두 MJT 5문항이면 편성 가능.
  it("counts approved v5 and v6 missions with five MJT items", () => {
    expect(libraryMissionIsReady(approved("mission_v5"))).toBe(true);
    expect(libraryMissionIsReady(approved("mission_v6"))).toBe(true);
  });

  it("excludes old four-item missions", () => {
    expect(libraryMissionIsReady(approved("mission_v5", 4))).toBe(false);
  });
});
