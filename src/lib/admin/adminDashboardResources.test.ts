import { describe, expect, it } from "vitest";
import { summarizeDashboardResources, resourceLibraryHref } from "./adminDashboardResources";
import type { DashboardScenarioRow } from "./adminDashboardMetrics";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

const row = (id: string, patch: Partial<DashboardScenarioRow> = {}): DashboardScenarioRow => ({
  scenario_id: id, content_format: "scenario_core_v1", review_status: "needs_review", mission_status: "generated",
  mission_schema_version: "mission_v5", authoring_stage: null, updated_at: null,
  mission_mpj_items: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, type: "scale4", options: [1, 2, 3, 4] })),
  production_task_source: "번역할 원문", content_release_id: CURRENT_CONTENT_RELEASE_ID,
  speech_act: "request", learner_level: "intermediate", mode: "translation", ...patch,
});

describe("dashboard stored resources", () => {
  it("counts historical four-item missions as four and never counts response options", () => {
    const result = summarizeDashboardResources([row("five"), row("four", { mission_mpj_items: [{ type: "scale4" }, { type: "judge3" }, { type: "fix_choice" }, { type: "reason" }] })]);
    expect(result.all).toMatchObject({ missionCount: 2, judgmentCount: 9, productionCount: 2, incompleteCount: 0 });
  });
  it("separates actual composer eligibility from approval and drops replaced editions", () => {
    const result = summarizeDashboardResources([
      row("old", { mission_status: "reviewed", authoring_stage: "professor_finalized" }),
      row("current", { supersedes_scenario_id: "old", mission_status: "reviewed", authoring_stage: "professor_finalized", direction: "zh_ko" }),
      row("draft"),
      row("approval-missing", { mission_status: "reviewed" }),
      row("release-old", { mission_status: "reviewed", authoring_stage: "professor_finalized", content_release_id: "old" }),
      row("core", { mission_status: null, mission_schema_version: null }),
    ]);
    expect(result.all.missionCount).toBe(4);
    expect(result.ready).toMatchObject({ missionCount: 1, judgmentCount: 5, productionCount: 1 });
    for (const counts of Object.values(result.all.counts)) expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(4);
    expect(result.ready.counts.direction).toEqual({ zh_ko: 1 });
  });
  it("does not invent missing items or a production task", () => {
    const result = summarizeDashboardResources([row("broken", { mission_mpj_items: [null, {}, { type: "scale4" }], production_task_source: " " })]);
    expect(result.all).toMatchObject({ judgmentCount: 1, productionCount: 0, incompleteCount: 1 });
  });
  it("links the selected scope and dimension to current library editions", () => {
    expect(resourceLibraryHref("ready", "speech_act", "request")).toBe("/admin/library?view=ready&current=1&act=request");
    expect(resourceLibraryHref("all", "learner_level", "advanced")).toBe("/admin/library?view=missions&current=1&level=advanced");
  });
});
